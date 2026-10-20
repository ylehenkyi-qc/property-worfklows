-- Запуск шаблону й вибір виконавця (design.md зміни impl-run-tasks, D4, D6).
-- Публічні обгортки — security invoker (supabase.rpc бачить лише public); реалізація — security definer у private
-- з set search_path = ''. revoke execute from public, anon; grant execute to authenticated на обгортку й реалізацію
-- (обгортка security invoker викликає реалізацію від імені користувача).
-- AC: AC-RUN-01…AC-RUN-09.

-- ── Вибір виконавця: лише id і email manager/admin, без ролі й іншого профілю ───────────────
create or replace function private.list_assignable_users()
returns table (id uuid, email text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.email
  from public.profiles as p
  where p.role in ('manager', 'admin')
  order by p.email;
$$;

create or replace function public.list_assignable_users()
returns table (id uuid, email text)
language sql
stable
security invoker
set search_path = ''
as $$
  select u.id, u.email from private.list_assignable_users() as u;
$$;

revoke execute on function private.list_assignable_users() from public, anon;
grant execute on function private.list_assignable_users() to authenticated;
revoke execute on function public.list_assignable_users() from public, anon;
grant execute on function public.list_assignable_users() to authenticated;

-- ── Запуск шаблону ──────────────────────────────────────────────────────────────────────
-- p_assignments: [{"template_task_id": "<uuid>", "assignee_id": "<uuid>"}, …] — лише задає виконавця задачі.
-- run_tasks створюється рівно по одному на кожну template_task шаблону (цикл по задачах шаблону).
-- Помилки валідації назви мають дослівні тексти з AC; решта помилок — технічні (текст вимогами не визначено,
-- у UI недосяжні: вибір виконавця обмежений списком list_assignable_users).
create or replace function private.launch_run(
  p_template_id uuid,
  p_case_name text,
  p_assignments jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid         uuid := (select auth.uid());
  v_name        text;
  v_assignments jsonb := coalesce(p_assignments, '[]'::jsonb);
  v_assign      jsonb := '{}'::jsonb;  -- template_task_id → assignee_id
  v_elem        jsonb;
  v_tt_id       uuid;
  v_assignee    uuid;
  v_run_id      uuid;
  v_section     record;
  v_task        record;
  v_new_section uuid;
begin
  if v_uid is null or private.current_app_role() is null then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  -- AC-RUN-03, AC-RUN-07: назва обрізається (робоче припущення Q3), порожня й задовга відхиляються.
  v_name := btrim(coalesce(p_case_name, ''));
  if v_name = '' then
    raise exception 'Enter a case name' using errcode = '22023';
  end if;
  if char_length(v_name) > 100 then
    raise exception 'Case name must be at most 100 characters' using errcode = '22023';
  end if;

  if not exists (select 1 from public.templates as t where t.id = p_template_id) then
    raise exception 'Template not found' using errcode = 'P0002';
  end if;

  -- Усі перевірки призначень — до створення запуску.
  if jsonb_typeof(v_assignments) <> 'array' then
    raise exception 'Invalid assignments' using errcode = '22023';
  end if;

  for v_elem in select e.value from jsonb_array_elements(v_assignments) as e loop
    v_tt_id := (v_elem ->> 'template_task_id')::uuid;
    v_assignee := (v_elem ->> 'assignee_id')::uuid;

    if v_tt_id is null or v_assignee is null then
      raise exception 'Invalid assignment' using errcode = '22023';
    end if;
    -- повторний template_task_id
    if (v_assign ->> (v_tt_id::text)) is not null then
      raise exception 'Duplicate template_task_id in assignments' using errcode = '22023';
    end if;
    -- задача належить цьому шаблону
    if not exists (
      select 1 from public.template_tasks as tt
      where tt.id = v_tt_id and tt.template_id = p_template_id
    ) then
      raise exception 'Task does not belong to the template' using errcode = '22023';
    end if;
    -- виконавець — manager або admin
    if not exists (
      select 1 from public.profiles as p
      where p.id = v_assignee and p.role in ('manager', 'admin')
    ) then
      raise exception 'Assignee must be a manager or an administrator' using errcode = '22023';
    end if;

    v_assign := v_assign || jsonb_build_object(v_tt_id::text, v_assignee::text);
  end loop;

  -- AC-RUN-01, AC-RUN-05, AC-RUN-06: запуск «in progress», менеджер запуску — той, хто запустив.
  insert into public.runs (template_id, case_name, manager_id)
  values (p_template_id, v_name, v_uid)
  returning id into v_run_id;

  -- AC-RUN-01, AC-RUN-02: копія секцій і задач; усі задачі «to_do».
  -- AC-RUN-04, AC-RUN-08, AC-RUN-09: виконавець — з призначення, інакше менеджер запуску.
  for v_section in
    select s.id, s.name, s.position
    from public.template_sections as s
    where s.template_id = p_template_id
    order by s.position
  loop
    insert into public.run_sections (run_id, name, position)
    values (v_run_id, v_section.name, v_section.position)
    returning id into v_new_section;

    for v_task in
      select t.id, t.name, t.required, t.position
      from public.template_tasks as t
      where t.section_id = v_section.id
      order by t.position
    loop
      insert into public.run_tasks (run_id, section_id, name, required, position, assignee_id)
      values (
        v_run_id, v_new_section, v_task.name, v_task.required, v_task.position,
        coalesce((v_assign ->> (v_task.id::text))::uuid, v_uid)
      );
    end loop;
  end loop;

  return v_run_id;
end;
$$;

create or replace function public.launch_run(
  p_template_id uuid,
  p_case_name text,
  p_assignments jsonb default '[]'::jsonb
)
returns uuid
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.launch_run(p_template_id, p_case_name, p_assignments);
$$;

revoke execute on function private.launch_run(uuid, text, jsonb) from public, anon;
grant execute on function private.launch_run(uuid, text, jsonb) to authenticated;
revoke execute on function public.launch_run(uuid, text, jsonb) from public, anon;
grant execute on function public.launch_run(uuid, text, jsonb) to authenticated;
