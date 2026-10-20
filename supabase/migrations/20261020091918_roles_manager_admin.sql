-- Ролі застосунку: manager і admin (замість member і admin зі стартової міграції).
-- Порядок важливий (див. заголовок 20261012000000_profiles_and_roles.sql):
--   1) знімаємо старий profiles_role_check — він не пропустить UPDATE на нову роль (23514);
--   2) переводимо наявні дані member → manager;
--   3) новий default колонки role: інакше тригер on_auth_user_created вставить 'member',
--      і кожен createUser (npm run users:demo) впаде на новому constraint;
--   4) додаємо новий profiles_role_check.
-- Ризик: змінює дані profiles (member → manager); деструктивних операцій (drop/truncate) немає.
-- AC: AC-RUN-04, AC-RUN-05, AC-RUN-06 (ролі manager і admin; роль — з profiles.role).

alter table public.profiles drop constraint profiles_role_check;

update public.profiles set role = 'manager' where role = 'member';

alter table public.profiles alter column role set default 'manager';

alter table public.profiles
  add constraint profiles_role_check check (role in ('manager', 'admin'));
