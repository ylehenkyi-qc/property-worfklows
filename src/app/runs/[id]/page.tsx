import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { groupTasksBySection } from "@/lib/runs/groupTasksBySection";
import { assigneeLabel, runStatusLabel, taskStatusLabel } from "@/lib/runs/labels";
import { formatRunProgress } from "@/lib/runs/progress";

// Сторінка запуску (AC-TASK-05, AC-TASK-08): прогрес, статус, задачі за секціями зі статусом, обов'язковістю й виконавцем.
// Чужий запуск RLS не повертає — сторінка «Run not found». Кнопка «Mark as done» — група 2 плану.
export default async function RunPage({ params }: PageProps<"/runs/[id]">) {
  const supabase = await createClient();

  // getClaims() перевіряє JWT. getSession() для авторизації на сервері не використовуємо.
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) {
    redirect("/login");
  }

  const { id } = await params;
  const { data: run } = await supabase
    .from("runs")
    .select("id, case_name, status")
    .eq("id", id)
    .maybeSingle();
  if (!run) {
    notFound();
  }

  const { data: sections } = await supabase
    .from("run_sections")
    .select("id, name, position")
    .eq("run_id", run.id);
  const { data: tasks } = await supabase
    .from("run_tasks")
    .select("id, name, position, required, status, assignee_id, section_id")
    .eq("run_id", run.id);
  // Виконавців підписуємо email із вузької функції: ролі й решти профілю менеджер не бачить.
  const { data: users } = await supabase.rpc("list_assignable_users");

  const allTasks = tasks ?? [];
  const groups = groupTasksBySection(sections ?? [], allTasks);

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
                <span className="text-zinc-500">
                  {taskStatusLabel(task.status)} · {assigneeLabel(task.assignee_id, users ?? [])}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
