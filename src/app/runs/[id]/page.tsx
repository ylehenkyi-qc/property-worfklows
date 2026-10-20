import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { groupTasksBySection } from "@/lib/runs/groupTasksBySection";
import { assigneeLabel, runStatusLabel, taskStatusLabel } from "@/lib/runs/labels";
import { isMarkTaskErrorCode, MARK_TASK_ERRORS } from "@/lib/runs/markTaskErrors";
import { formatRunProgress } from "@/lib/runs/progress";
import { markTaskDone } from "./actions";

// Сторінка запуску (AC-TASK-05, AC-TASK-08): прогрес, статус, задачі за секціями зі статусом, обов'язковістю й виконавцем.
// Чужий запуск RLS не повертає — сторінка «Run not found». Кнопка «Mark as done» (AC-TASK-01, 02, 03, 07) стоїть на кожній
// задачі «to do» для всіх, хто бачить запуск; право позначати перевіряє база.
export default async function RunPage({ params, searchParams }: PageProps<"/runs/[id]">) {
  const supabase = await createClient();

  // getClaims() перевіряє JWT. getSession() для авторизації на сервері не використовуємо.
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) {
    redirect("/login");
  }

  const { id } = await params;
  const { error } = await searchParams;
  const errorMessage = isMarkTaskErrorCode(error) ? MARK_TASK_ERRORS[error] : undefined;
  const { data: run, error: runError } = await supabase
    .from("runs")
    .select("id, case_name, status")
    .eq("id", id)
    .maybeSingle();
  if (runError) {
    throw new Error("Failed to load the run");
  }
  if (!run) {
    notFound();
  }

  // Незалежні запити — паралельно. Виконавців підписуємо email із вузької функції:
  // ролі й решти профілю менеджер не бачить.
  const [sectionsResult, tasksResult, usersResult] = await Promise.all([
    supabase.from("run_sections").select("id, name, position").eq("run_id", run.id),
    supabase
      .from("run_tasks")
      .select("id, name, position, required, status, assignee_id, section_id")
      .eq("run_id", run.id),
    supabase.rpc("list_assignable_users"),
  ]);
  if (sectionsResult.error) throw new Error("Failed to load run sections");
  if (tasksResult.error) throw new Error("Failed to load run tasks");
  if (usersResult.error) throw new Error("Failed to load assignees");

  const sections = sectionsResult.data;
  const tasks = tasksResult.data;
  const users = usersResult.data;

  const allTasks = tasks;
  const groups = groupTasksBySection(sections, allTasks);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-16">
      <Link href="/runs" className="text-sm text-zinc-500 underline">
        Runs
      </Link>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold" data-testid="run-case-name">
          {run.case_name}
        </h1>
        <p className="text-sm text-zinc-500">
          <span data-testid="run-status">{runStatusLabel(run.status)}</span>
          {" · "}
          <span data-testid="run-progress">{formatRunProgress(allTasks)}</span>
        </p>
      </div>

      {errorMessage ? (
        <p role="alert" className="text-sm text-red-600">
          {errorMessage}
        </p>
      ) : null}

      {groups.map(({ section, tasks: sectionTasks }) => (
        <section key={section.id} className="flex flex-col gap-2">
          <h2 className="text-sm font-medium">{section.name}</h2>
          <ul className="flex flex-col gap-2">
            {sectionTasks.map((task) => (
              <li
                key={task.id}
                data-testid="run-task"
                className="flex items-baseline justify-between gap-4 rounded border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
              >
                <span>
                  {task.name}
                  <span className="ml-2 text-zinc-500">
                    {task.required ? "required" : "optional"}
                  </span>
                </span>
                <span className="flex items-baseline gap-3 text-zinc-500">
                  {taskStatusLabel(task.status)} · {assigneeLabel(task.assignee_id, users)}
                  {task.status === "to_do" ? (
                    <form action={markTaskDone.bind(null, task.id, run.id)}>
                      <button
                        type="submit"
                        className="rounded border border-zinc-300 px-3 py-1 text-xs text-foreground dark:border-zinc-700"
                      >
                        Mark as done
                      </button>
                    </form>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
