# Design

## Context

- Специфікація: `openspec/specs/run-launch/spec.md` і `openspec/specs/run-tracking/spec.md`; вимоги й матриця прав — `requirements/product.md`; робочі припущення до відкритих питань Q1–Q4 — `docs/spec-reading.md` (їх тут використовуємо лише як припущення розробника, PM відповіді не давав).
- Стартова схема шаблону: `profiles` з ролями `member`/`admin`, `private.current_app_role()`, тригер `on_auth_user_created` (`supabase/migrations/20261012000000_profiles_and_roles.sql`). `supabase/seed.sql` порожній, `supabase/demo-users.json` містить `member`.
- Код застосунку мінімальний: вхід (`src/app/login/`) і головна сторінка; клієнти Supabase в `src/lib/supabase/`. Авторизація на сервері — лише `supabase.auth.getClaims()`.
- CI: job `app` (lint, typecheck, `npm test`, build) працює без бази; job `db-check` застосовує міграції до одноразової бази (`supabase db start`) і порівнює типи. `ac:coverage` рахує лише непропущені тести з назвою, що починається з AC ID, у `src/**/*.test.ts(x)` і `tests/**/*.test.ts(x)`.
- Перед написанням коду сторінок прочитати відповідний гайд у `node_modules/next/dist/docs/` (AGENTS.md: ця версія Next.js має зміни щодо API).

## Goals / Non-Goals

**Goals:**
- Усі правила зрізу (хто що бачить і позначає, копіювання шаблону, автозавершення) гарантує база, а не лише UI.
- Кожне рішення нижче прив'язане до AC; нових правил поведінки немає.

**Non-Goals:**
- Екран створення й зміни шаблонів (PM лишає це розробнику; у зрізі шаблони готуємо міграцією/сидом).
- Будь-яка поведінка понад вимоги: зміна виконавця, скасування й видалення запуску, скасування позначки «done», обмеження чи дозвіл на позначення необов'язкових задач у завершеному запуску (PM-Q1: не специфікуємо, не обмежуємо).

## Decisions

### D1. Ролі: `manager` / `admin` (AC-RUN-04…06, AC-TASK-01…07)

Окрема міграція за порядком із заголовка стартової міграції: 1) зняти `profiles_role_check`; 2) `update public.profiles set role = 'manager' where role = 'member'`; 3) новий `default 'manager'` колонки `role` (інакше тригер `on_auth_user_created` вставить стару роль і `users:demo` впаде); 4) додати `profiles_role_check check (role in ('manager', 'admin'))`. `supabase/demo-users.json`: `admin@example.test` + `manager1@example.test`, `manager2@example.test` (роль `manager`), усі `*@example.test`. Роль завжди з `profiles.role`, не з `user_metadata`.

### D2. Таблиці (AC-RUN-01, AC-RUN-02, AC-TASK-04)

| Таблиця | Колонки (суть) |
|---|---|
| `templates` | `id`, `name` (унікальна), `created_at` |
| `template_sections` | `id`, `template_id`, `name`, `position` |
| `template_tasks` | `id`, `template_id`, `section_id`, `name`, `required` (boolean), `position` |
| `runs` | `id`, `template_id` (`on delete set null`), `case_name` (check: 1–100 символів, без пробілів по краях), `manager_id` → `profiles`, `status` (`in_progress` / `completed`, default `in_progress`), `created_at` |
| `run_sections` | `id`, `run_id` (cascade), `name`, `position` |
| `run_tasks` | `id`, `run_id` (cascade), `section_id` → `run_sections`, `name`, `required`, `position`, `assignee_id` → `profiles` (not null), `status` (`to_do` / `done`, default `to_do`) |

Запуск **копіює** секції й задачі шаблону в `run_sections` і `run_tasks` (назва, `required`, порядок): зміна шаблону не зачіпає наявні запуски (AC-RUN-02). Кожна задача запуску має рівно одного виконавця (`assignee_id not null`). У UI статуси показуємо як «in progress», «completed», «to do», «done» (як в AC). Альтернатива «запуск посилається на задачі шаблону й зберігає лише знімок змін» відкинута: складніша, і AC-RUN-02 перевірити важче.

Для кожної таблиці: `enable row level security`; `revoke all … from anon, authenticated`; явні `grant`; `service_role` — повний доступ для скриптів.

### D3. Права й RLS (AC-TASK-06, AC-TASK-08, матриця прав)

- Таблиці шаблонів: `grant select` для `authenticated`, політика `select … to authenticated using (true)` (бачать усі manager/admin). Запис — лише `service_role`/міграція: шаблони готує адміністратор поза застосунком (вимоги PM: екран не обов'язковий).
- `runs`, `run_sections`, `run_tasks`: `grant select` для `authenticated`; **insert/update/delete напряму не видаємо** — запис лише через функції D4/D5. Політики `select` (`to authenticated`, `(select auth.uid())`) через хелпер `private.can_see_run(run_id)` (`security definer`, `set search_path = ''`): `true`, якщо роль `admin`, або `runs.manager_id = uid`, або `uid` — виконавець хоча б однієї задачі цього запуску. Хелпер потрібен, щоб політики `runs` і `run_tasks` не посилалися одна на одну (42P17). Для `private.can_see_run`: `revoke execute from public, anon` і `grant execute to authenticated`, бо політики RLS викликаються від імені `authenticated`; `USAGE` на схемі `private` уже є (стартова міграція).
- Тому виконавець бачить усі задачі запуску, де має хоча б одну свою (припущення PM), а сторонній менеджер не бачить запуск зовсім (AC-TASK-06).
- Політики пишемо на кожну надану операцію (тут лише `select`); решта операцій заборонена відсутністю grant.
- RLS на `profiles` не послаблюємо.

### D4. Запуск шаблону: `launch_run` (AC-RUN-01…09)

Одна функція Postgres, бо supabase-js не має транзакцій. Схема: `public.launch_run(p_template_id uuid, p_case_name text, p_assignments jsonb default '[]')` — `security invoker`, лише делегує у `private.launch_run(...)` (`security definer`, `set search_path = ''`); `revoke execute from public, anon`; `grant execute to authenticated` на public-обгортку і на private-реалізацію (обгортка `security invoker` викликає її від імені користувача). Повертає `uuid` запуску. Кроки:

1. Назва: `btrim` (робоче припущення Q3, PM не відповів); порожня → виняток `Enter a case name` (AC-RUN-03); довша за 100 символів → `Case name must be at most 100 characters` (AC-RUN-07). Тексти повідомлень — дослівно з AC.
2. Створити `runs` (`manager_id = auth.uid()`, статус `in_progress`) — будь-який manager чи admin (AC-RUN-05, AC-RUN-06).
3. Скопіювати секції й задачі (AC-RUN-01, AC-RUN-02), усі задачі `to_do`.
4. Виконавець кожної задачі — з `p_assignments` (`[{template_task_id, assignee_id}]`), інакше `auth.uid()` (AC-RUN-04, AC-RUN-08, AC-RUN-09). Захисні перевірки (задача належить шаблону, виконавець — manager/admin) дають технічну помилку; її текст вимогами не визначено, у UI недосяжна, бо вибір обмежений списком D6.

Pre-валідація назви дублюється в TypeScript (`validateCaseName`) заради форми; авторитет — база. Альтернатива «тільки server action робить кілька insert» відкинута: не атомарна.

### D5. Позначення задачі й автозавершення: `mark_task_done` (AC-TASK-01, 02, 03, 04, 07)

`public.mark_task_done(p_task_id uuid)` — `security invoker`, делегує в `private.mark_task_done` (`security definer`, `set search_path = ''`); `revoke execute from public, anon`; `grant execute to authenticated` на public-обгортку і на private-реалізацію (обгортка `security invoker` викликає її від імені користувача). Кроки в одній транзакції:

1. Заблокувати рядок задачі й запуску (`for update`), щоб паралельні позначки не розійшлися в статусі запуску.
2. Дозволено, якщо `auth.uid()` — виконавець задачі, або менеджер запуску, або роль `admin` (AC-TASK-01, 02, 07). Інакше виняток з текстом `Only the task's assignee, the run manager, or an administrator can mark a task as done` (AC-TASK-03), код `42501`; задача лишається `to_do`.
3. Уже `done` — нічого не змінювати (припущення PM: повторна позначка нічого не змінює).
4. `status = 'done'`; потім, якщо невиконаних `required` задач у запуску немає, `runs.status = 'completed'` (AC-TASK-04). Необов'язкові задачі статус запуску не змінюють. Функція не дивиться на статус запуску при позначенні, тобто нічого не вирішує про необов'язкові задачі після завершення (PM-Q1 лишається відкритим).

AC-TASK-03 досяжний через UI: кнопка «Mark as done» стоїть на кожній задачі «to do» для будь-кого, хто бачить запуск (співвиконавець бачить чужі задачі), а право перевіряє база.

### D6. Вибір виконавця (AC-RUN-04; робоче припущення Q1)

`public.list_assignable_users()` — `security invoker`, делегує в `private.list_assignable_users()` (`security definer`), повертає лише `id` і `email` користувачів з роллю `manager` або `admin` (без ролі й іншого профілю). `revoke execute from public, anon`; `grant execute to authenticated` на public-обгортку і на private-реалізацію (обгортка `security invoker` викликає її від імені користувача). Використовується у формі запуску й для підпису виконавця на сторінці запуску (мапа `assignee_id → email`). Доступ розширювати без відповіді PM (solomchaak/property-workflows-spec#5) не будемо.

### D7. Сторінки й server actions (AC-RUN-03, AC-RUN-07, AC-TASK-03, 05, 06, 08, 09)

Тексти інтерфейсу — англійською, повідомлення з AC дослівно.

| Маршрут | Що робить |
|---|---|
| `/runs` | Список запусків (RLS): назва випадку, статус («in progress» / «completed»), прогрес «N of M done» (AC-TASK-06, AC-TASK-09); новіші першими; порожній список — короткий напис «No runs yet» (формулювання не від PM) |
| `/runs/new` | Форма: шаблон, назва випадку, виконавець для кожної задачі (за замовчуванням — я); server action `launchRun` викликає `rpc('launch_run')`; помилки валідації показує дослівно (AC-RUN-03, AC-RUN-07); успіх → `/runs/[id]` |
| `/runs/[id]` | Прогрес «N of M done», статус запуску, задачі згруповані за секціями в порядку шаблону (робоче припущення Q4), статус кожної задачі («done» / «to do») і виконавець (AC-TASK-05, AC-TASK-08); кнопка «Mark as done» → server action `markTaskDone` → `rpc('mark_task_done')`; відмову показує дослівним повідомленням AC-TASK-03 |
| `/runs/[id]` для чужого запуску | `notFound()` → сторінка «Run not found» (робоче припущення Q2) |

Головна сторінка отримує посилання на `/runs` і `/runs/new`. Авторизація на сервері — лише `getClaims()`; без нього редірект на `/login`. Чистий код (прогрес, валідація назви, групування за секціями, відображення помилок функцій) — в `src/lib/runs/`, щоб його тестувати без бази.

### D8. Сид шаблону (AC-RUN-01, AC-RUN-02, AC-RUN-04…06, AC-RUN-08, AC-RUN-09)

Міграція з `insert … on conflict do nothing` і фіксованими UUID створює шаблон «Tenant move-in»: 2 секції, 5 задач, з них 3 обов'язкові (дані синтетичні). Це відповідає прикладу AC; кожен шаблон має ≥ 1 обов'язкову задачу (припущення PM). UI створення шаблонів не робимо; `supabase/seed.sql` лишається порожнім (у хмарі сид не виконується без `--include-seed`).

### D9. Тести (усі AC)

- Назва кожного тесту — `it("AC-…: …")`; файли `*.test.ts(x)` у `src/` або `tests/`; перевірки лише через `expect`.
- Рівень застосунку (виконується в CI job `app` без бази): `validateCaseName` (AC-RUN-03, AC-RUN-07), `formatProgress` і групування (AC-TASK-05, AC-TASK-08, AC-TASK-09), server actions із підміною `@/lib/supabase/server` (передача параметрів у `rpc`, показ дослівних повідомлень: AC-RUN-03, AC-RUN-07, AC-TASK-03), не-знайдений запуск → «Run not found».
- Рівень бази (правила в Postgres: AC-RUN-01, 02, 04, 05, 06, 08, 09; AC-TASK-01, 02, 04, 06, 07): тести `tests/db/*.test.ts` через `@supabase/supabase-js` проти локального стеку (`supabase start`, Docker) із синтетичними користувачами; запускаються лише там, де середовище дозволяє, через `describe.skipIf(!process.env.…)`. Негативні випадки без AC ID — звичайні назви.
- Рядок AC у `docs/conformance.md` стає «реалізовано» лише з непропущеним тестом (`ac:coverage`).

## Risks / Trade-offs

- [DB-тести пропускаються в CI `app` (немає бази), а `ac:coverage` не рахує пропущені тести] → правила, що живуть лише в Postgres (RLS, `launch_run`, `mark_task_done`), підтверджуються локально. У матриці «реалізовано» ставимо лише для AC з непропущеним тестом на рівні застосунку: AC-RUN-03, AC-RUN-07, AC-TASK-05, AC-TASK-08, AC-TASK-09 і повідомлення відмови AC-TASK-03 — там, де тест справді перевіряє поведінку. Решта AC правил, що живуть у Postgres, лишаються «відкладено (DB-тести не запускаються в CI)». Зміну CI (`.github/`) до здачі не плануємо; це окреме рішення після неї.
- [Робочі припущення Q1–Q4 PM не підтвердив] → ізольовано: D6 (Q1), D7 «Run not found» (Q2), `btrim` у D4 (Q3), групування за секціями в D3/D7 (Q4); відповідь PM змінює лише ці місця.
- [Дублювання правила назви у TS і SQL] → SQL — авторитет; TS-перевірка лише для зручності форми, обидві покриті тестами.
- [Definer-функції — поверхня безпеки] → лише в схемі `private`, `set search_path = ''`, `execute` відкликано в `public`/`anon`; публічні обгортки — `security invoker`.
- [Нова міграція ролей торкається наявних користувачів] → `update member → manager` до нового `check`; деструктивних операцій немає, але в описі PR позначити ризик.

## Migration Plan

1. Нові файли міграцій лише через `npx supabase migration new <назва>`; мітка новіша за `origin/main` (`node scripts/check-migration-order.mjs`); застосовані файли не редагуємо. Одна міграція на зміну: ролі → таблиці з RLS і сид шаблону → функції (`launch_run`, `list_assignable_users`) → `mark_task_done`.
2. Типи БД: `database.types.ts` із Summary прогону `db-check` (або `npm run db:types`).
3. Застосування в базу — лише CI `db-deploy` після merge у `main`. Відкат — новою міграцією-виправленням, не редагуванням застосованої.
4. Після merge: `npm run users:demo` (admin + два manager) і, за потреби, ручний запуск CI з `include_seed`.
