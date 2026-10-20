-- Позначення задачі виконаною й автозавершення запуску (design.md зміни impl-run-tasks, D5).
-- Публічна обгортка — security invoker; реалізація — security definer у private з set search_path = ''.
-- revoke execute from public, anon; grant execute to authenticated на обгортку й реалізацію
-- (обгортка security invoker викликає реалізацію від імені користувача).
-- AC: AC-TASK-01, AC-TASK-02, AC-TASK-03, AC-TASK-04, AC-TASK-07.
--
-- Статус запуску при позначенні не перевіряємо: поведінку необов'язкових задач після завершення запуску
-- вимоги не специфікують (відкрите питання PM-Q1 вимоги solomchaak/property-workflows-spec#3).

create or replace function private.mark_task_done(p_task_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_run_id  uuid;
  v_manager uuid;
  v_assignee uuid;
  v_status  text;
begin
  if v_uid is null then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select t.run_id into v_run_id from public.run_tasks as t where t.id = p_task_id;
  if not found then
    raise exception 'Task not found' using errcode = 'P0002';
  end if;

  -- Спершу блокуємо запуск (одним порядком для всіх викликів), потім задачу: паралельні позначки в одному запуску
  -- виконуються по черзі й кожна бачить уже зафіксовані позначки попередніх.
  select r.manager_id into v_manager from public.runs as r where r.id = v_run_id for update;

  select t.assignee_id, t.status into v_assignee, v_status
  from public.run_tasks as t where t.id = p_task_id for update;

  -- AC-TASK-01, AC-TASK-02, AC-TASK-07: виконавець задачі, менеджер запуску або admin.
  -- AC-TASK-03: інакше відмова з дослівним повідомленням, задача лишається «to_do».
  -- Видимість запуску не вимагаємо: співвиконавець бачить усі задачі запуску й може натиснути кнопку на чужій.
  if v_uid is distinct from v_assignee
     and v_uid is distinct from v_manager
     and coalesce(private.current_app_role(), '') <> 'admin' then
    raise exception 'Only the task''s assignee, the run manager, or an administrator can mark a task as done'
      using errcode = '42501';
  end if;

  -- Повторна позначка нічого не змінює.
  if v_status = 'done' then
    return;
  end if;

  update public.run_tasks set status = 'done' where id = p_task_id;

  -- AC-TASK-04: запуск «completed», коли всі обов'язкові задачі «done»; необов'язкові статус запуску не змінюють.
  if not exists (
    select 1 from public.run_tasks as t
    where t.run_id = v_run_id and t.required and t.status <> 'done'
  ) then
    update public.runs set status = 'completed' where id = v_run_id and status <> 'completed';
  end if;
end;
$$;

create or replace function public.mark_task_done(p_task_id uuid)
returns void
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.mark_task_done(p_task_id);
$$;

revoke execute on function private.mark_task_done(uuid) from public, anon;
grant execute on function private.mark_task_done(uuid) to authenticated;
revoke execute on function public.mark_task_done(uuid) from public, anon;
grant execute on function public.mark_task_done(uuid) to authenticated;
