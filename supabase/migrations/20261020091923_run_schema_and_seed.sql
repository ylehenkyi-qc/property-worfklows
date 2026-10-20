-- Шаблони процесів і їхні запуски (design.md зміни impl-run-tasks, D2, D3, D8).
-- Правила: RLS на кожній таблиці; revoke all from anon, authenticated; явні grant; політики to authenticated;
-- запуски (runs, run_sections, run_tasks) authenticated лише читає — запис через функції (launch_run тощо).
-- AC: AC-RUN-01, AC-RUN-02 (запуск зберігає копію секцій і задач), AC-TASK-06 (видимість запусків).

-- ── Шаблони (готує адміністратор поза застосунком: міграція, сид, service_role) ─────────────
create table public.templates (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  created_at timestamptz not null default now()
);

create table public.template_sections (
  id          uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.templates (id) on delete cascade,
  name        text not null,
  position    integer not null,
  unique (template_id, position),
  unique (id, template_id)
);

create table public.template_tasks (
  id          uuid primary key default gen_random_uuid(),
  template_id uuid not null,
  section_id  uuid not null,
  name        text not null,
  required    boolean not null default false,
  position    integer not null,
  unique (section_id, position),
  -- задача й її секція належать одному шаблону
  foreign key (section_id, template_id)
    references public.template_sections (id, template_id) on delete cascade
);

-- ── Запуски: копія секцій і задач шаблону на момент запуску ────────────────────────────────
create table public.runs (
  id          uuid primary key default gen_random_uuid(),
  template_id uuid references public.templates (id) on delete set null,
  case_name   text not null,
  manager_id  uuid not null references public.profiles (id),
  status      text not null default 'in_progress',
  created_at  timestamptz not null default now(),
  constraint runs_status_check check (status in ('in_progress', 'completed')),
  -- 1–100 символів, без пробілів по краях (назву з пробілів обрізає launch_run)
  constraint runs_case_name_check
    check (char_length(case_name) between 1 and 100 and case_name = btrim(case_name))
);

create table public.run_sections (
  id       uuid primary key default gen_random_uuid(),
  run_id   uuid not null references public.runs (id) on delete cascade,
  name     text not null,
  position integer not null,
  unique (run_id, position),
  unique (id, run_id)
);

create table public.run_tasks (
  id          uuid primary key default gen_random_uuid(),
  run_id      uuid not null,
  section_id  uuid not null,
  name        text not null,
  required    boolean not null,
  position    integer not null,
  -- рівно один виконавець у кожної задачі
  assignee_id uuid not null references public.profiles (id),
  status      text not null default 'to_do',
  constraint run_tasks_status_check check (status in ('to_do', 'done')),
  unique (section_id, position),
  -- задача й її секція належать одному запуску
  foreign key (section_id, run_id)
    references public.run_sections (id, run_id) on delete cascade
);

create index template_sections_template_id_idx on public.template_sections (template_id);
create index template_tasks_template_id_idx on public.template_tasks (template_id);
create index runs_manager_id_idx on public.runs (manager_id);
create index run_sections_run_id_idx on public.run_sections (run_id);
create index run_tasks_run_id_idx on public.run_tasks (run_id);
create index run_tasks_assignee_id_idx on public.run_tasks (assignee_id);

-- ── RLS і права ─────────────────────────────────────────────────────────────────────────
alter table public.templates enable row level security;
alter table public.template_sections enable row level security;
alter table public.template_tasks enable row level security;
alter table public.runs enable row level security;
alter table public.run_sections enable row level security;
alter table public.run_tasks enable row level security;

revoke all on table public.templates from anon, authenticated;
revoke all on table public.template_sections from anon, authenticated;
revoke all on table public.template_tasks from anon, authenticated;
revoke all on table public.runs from anon, authenticated;
revoke all on table public.run_sections from anon, authenticated;
revoke all on table public.run_tasks from anon, authenticated;

-- authenticated лише читає; insert/update/delete напряму не видаємо.
grant select on table public.templates to authenticated;
grant select on table public.template_sections to authenticated;
grant select on table public.template_tasks to authenticated;
grant select on table public.runs to authenticated;
grant select on table public.run_sections to authenticated;
grant select on table public.run_tasks to authenticated;

-- Серверні скрипти (секретний ключ) працюють як service_role.
grant select, insert, update, delete on table public.templates to service_role;
grant select, insert, update, delete on table public.template_sections to service_role;
grant select, insert, update, delete on table public.template_tasks to service_role;
grant select, insert, update, delete on table public.runs to service_role;
grant select, insert, update, delete on table public.run_sections to service_role;
grant select, insert, update, delete on table public.run_tasks to service_role;

-- ── Хелпер видимості запуску (AC-TASK-06) ───────────────────────────────────────────────
-- security definer читає runs і run_tasks в обхід RLS: політики runs і run_tasks не посилаються одна на одну (42P17).
-- Бачить запуск: admin, або менеджер запуску, або виконавець хоча б однієї задачі запуску.
create or replace function private.can_see_run(p_run_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(private.current_app_role(), '') = 'admin'
    or exists (
      select 1 from public.runs as r
      where r.id = p_run_id and r.manager_id = (select auth.uid())
    )
    or exists (
      select 1 from public.run_tasks as t
      where t.run_id = p_run_id and t.assignee_id = (select auth.uid())
    );
$$;

-- Політики RLS викликаються від імені authenticated, тож потрібен execute; USAGE на схемі private уже є.
revoke execute on function private.can_see_run(uuid) from public, anon;
grant execute on function private.can_see_run(uuid) to authenticated;

-- ── Політики (окремо на кожну надану операцію — лише select) ───────────────────────────────
create policy templates_select_authenticated
  on public.templates for select to authenticated using (true);

create policy template_sections_select_authenticated
  on public.template_sections for select to authenticated using (true);

create policy template_tasks_select_authenticated
  on public.template_tasks for select to authenticated using (true);

create policy runs_select_visible
  on public.runs for select to authenticated
  using (private.can_see_run(id));

create policy run_sections_select_visible
  on public.run_sections for select to authenticated
  using (private.can_see_run(run_id));

create policy run_tasks_select_visible
  on public.run_tasks for select to authenticated
  using (private.can_see_run(run_id));

-- ── Сид шаблону «Tenant move-in»: 2 секції, 5 задач, 3 обов'язкові (дані синтетичні) ──────────
insert into public.templates (id, name)
values ('a0000000-0000-4000-8000-000000000001', 'Tenant move-in')
on conflict (id) do nothing;

insert into public.template_sections (id, template_id, name, position)
values
  ('a0000000-0000-4000-8000-000000000011', 'a0000000-0000-4000-8000-000000000001', 'Before move-in', 1),
  ('a0000000-0000-4000-8000-000000000012', 'a0000000-0000-4000-8000-000000000001', 'Move-in day', 2)
on conflict (id) do nothing;

insert into public.template_tasks (id, template_id, section_id, name, required, position)
values
  ('a0000000-0000-4000-8000-000000000101', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000011', 'Inspect the apartment', true, 1),
  ('a0000000-0000-4000-8000-000000000102', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000011', 'Collect the signed lease', true, 2),
  ('a0000000-0000-4000-8000-000000000103', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000011', 'Send welcome information', false, 3),
  ('a0000000-0000-4000-8000-000000000104', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000012', 'Hand over the keys', true, 1),
  ('a0000000-0000-4000-8000-000000000105', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000012', 'Record meter readings', false, 2)
on conflict (id) do nothing;
