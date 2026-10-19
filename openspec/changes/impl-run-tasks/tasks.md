# Tasks

Кожна група — окремий PR «Реалізація» (`task/<коротко>`); галочки групи ставимо в її PR. Перед кодом сторінок читаємо гайд у `node_modules/next/dist/docs/`. Міграції — лише новими файлами через `npx supabase migration new`, мітка новіша за `origin/main` (`node scripts/check-migration-order.mjs`). Перед комітом: `npm run lint`, `npm run typecheck`, `npm test`.

## 1. Схема, ролі, RLS, сид шаблону і запуск шаблону

- [ ] 1.1 Міграція ролей `manager`/`admin` за порядком із заголовка стартової міграції (зняти `profiles_role_check` → `update member → manager` → новий `default 'manager'` → новий `profiles_role_check`); оновити `supabase/demo-users.json` (admin + `manager1@example.test`, `manager2@example.test`); перевірка: `db-check` зелений, `npm run users:demo` створює трьох користувачів.
- [ ] 1.2 Міграція таблиць `templates`, `template_sections`, `template_tasks`, `runs`, `run_sections`, `run_tasks` (RLS, `revoke all … from anon, authenticated`, явні `grant select`, політики `select` через `private.can_see_run`, без прямого запису для `authenticated`) і сид шаблону «Tenant move-in» (2 секції, 5 задач, 3 обов'язкові, `on conflict do nothing`); перевірка: `db-check` зелений, шаблон є в базі.
- [ ] 1.3 Міграція функцій `launch_run` (обрізання пробілів, повідомлення `Enter a case name` і `Case name must be at most 100 characters`, копія секцій і задач шаблону в запуск, виконавець за замовчуванням — менеджер запуску) і `list_assignable_users` (лише `id` і `email`); публічні обгортки `security invoker`, реалізація `security definer` у `private` з `set search_path = ''`; перевірка: `db-check` зелений, DB-тест запуску проходить локально.
- [ ] 1.4 Оновити `src/lib/supabase/database.types.ts` з Summary `db-check`; чисті функції в `src/lib/runs/` (`validateCaseName`); перевірка: `npm run typecheck`.
- [ ] 1.5 Форма `/runs/new` і server action `launchRun` (вибір шаблону, назви випадку, виконавця для кожної задачі зі списку `list_assignable_users`, дослівні повідомлення помилок), посилання з головної сторінки; перевірка: ручний запуск «Tenant move-in» під manager і під admin у `npm run dev`.
- [ ] 1.6 Тести: `it("AC-RUN-…: …")` для кожного AC групи на рівні застосунку (`validateCaseName`, `launchRun` із підміненим `@/lib/supabase/server`) і DB-тести `tests/db/` там, де середовище дозволяє; перевірка: `npm test` зелений.
- [ ] 1.7 ADR `docs/decisions/0001-run-model.md` (модель даних, копіювання шаблону в запуск, права й RLS, функції як єдиний шлях запису) з AC ID; перевірка: файл за шаблоном `docs/decisions/README.md`.
- [ ] 1.8 Рядки AC-RUN-01…09 у `docs/conformance.md`: «реалізовано» — лише з непропущеним тестом на рівні застосунку (AC-RUN-03, AC-RUN-07), решта (правила в Postgres, зокрема AC-RUN-02) — «відкладено (DB-тести не запускаються в CI)»; перевірка: `npm run ac:coverage` без NO-ROW і MISSING.

Done when: AC-RUN-01, AC-RUN-02, AC-RUN-03, AC-RUN-04, AC-RUN-05, AC-RUN-06, AC-RUN-07, AC-RUN-08, AC-RUN-09

## 2. Позначення задач і автозавершення запуску

- [ ] 2.1 Міграція `mark_task_done` (публічна обгортка `security invoker` + `private` `security definer` з `set search_path = ''`): право виконавця, менеджера запуску або `admin`, повідомлення `Only the task's assignee, the run manager, or an administrator can mark a task as done`, ідемпотентність, блокування рядків, перерахунок статусу запуску `completed`, коли всі обов'язкові задачі `done`; перевірка: `db-check` зелений, DB-тест проходить локально.
- [ ] 2.2 Server action `markTaskDone` і кнопка «Mark as done» на кожній задачі «to do» (бачить усі, хто бачить запуск; право перевіряє база), показ повідомлення про відмову; перевірка: ручна перевірка під виконавцем, менеджером запуску, адміністратором і стороннім співвиконавцем.
- [ ] 2.3 Оновити типи `database.types.ts`; тести `it("AC-TASK-…: …")` для AC групи (дії з підміненим клієнтом: дослівне повідомлення відмови, виклик `rpc`) і DB-тести `tests/db/` там, де середовище дозволяє; перевірка: `npm test` зелений.
- [ ] 2.4 Рядки AC-TASK-01, 02, 03, 04, 07 у `docs/conformance.md` («реалізовано» для AC-TASK-03 лише якщо тест справді перевіряє поведінку; решта — «відкладено (DB-тести не запускаються в CI)»); перевірка: `npm run ac:coverage`.

Done when: AC-TASK-01, AC-TASK-02, AC-TASK-03, AC-TASK-04, AC-TASK-07

## 3. Список і сторінка запуску

- [ ] 3.1 Сторінка `/runs`: список запусків за RLS (admin — усі; manager — де він менеджер запуску або виконавець), новіші першими, статус і прогрес «N of M done», порожній стан «No runs yet»; перевірка: ручна перевірка під двома менеджерами й адміністратором.
- [ ] 3.2 Сторінка `/runs/[id]`: прогрес, статус запуску, задачі згруповані за секціями в порядку шаблону, статус «done» / «to do» і виконавець кожної задачі; чужий запуск → `notFound()` із текстом «Run not found»; перевірка: ручна перевірка під виконавцем і стороннім менеджером.
- [ ] 3.3 Чисті функції `formatProgress` і групування за секціями в `src/lib/runs/`; тести `it("AC-TASK-…: …")` для AC групи і DB-тест видимості запусків `tests/db/` там, де середовище дозволяє; перевірка: `npm test` зелений.
- [ ] 3.4 Рядки AC-TASK-05, 06, 08, 09 у `docs/conformance.md` («реалізовано» для AC-TASK-05, 08, 09 з непропущеним тестом на рівні застосунку; AC-TASK-06 — «відкладено (DB-тести не запускаються в CI)»); перевірка: `npm run ac:coverage` без MISSING, `npm run build` показує `ƒ Proxy (Middleware)`.

Done when: AC-TASK-05, AC-TASK-06, AC-TASK-08, AC-TASK-09

## Workflow follow-up

- Archive зміни (`npx openspec archive impl-run-tasks -y`) — в останньому PR зрізу (група 3).
- Після відповідей PM на solomchaak/property-workflows-spec#4, #5, #6, #7 — окрема зміна специфікації, потім перевірити код і тести за новим текстом.
