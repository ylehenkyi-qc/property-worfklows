import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buildRunList } from "@/lib/runs/runList";

// Список запусків (AC-TASK-06, AC-TASK-09). Які запуски бачить користувач, вирішує RLS:
// admin — усі, manager — де він менеджер запуску або виконавець хоча б однієї задачі.
export default async function RunsPage() {
  const supabase = await createClient();

  // getClaims() перевіряє JWT. getSession() для авторизації на сервері не використовуємо.
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) {
    redirect("/login");
  }

  const { data: runs, error: runsError } = await supabase
    .from("runs")
    .select("id, case_name, status, created_at")
    .order("created_at", { ascending: false });
  // Помилку не маскуємо порожнім списком: error.tsx покаже «Something went wrong».
  if (runsError) {
    throw new Error("Failed to load runs");
  }

  // Задачі беремо окремим запитом: run_tasks пов'язана з run_sections, а не напряму з runs.
  const runIds = (runs ?? []).map((run) => run.id);
  const { data: tasks, error: tasksError } = runIds.length
    ? await supabase.from("run_tasks").select("run_id, status").in("run_id", runIds)
    : { data: [], error: null };
  if (tasksError) {
    throw new Error("Failed to load run tasks");
  }

  const items = buildRunList(runs ?? [], tasks ?? []);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-16">
      <Link href="/" className="text-sm text-zinc-500 underline">
        Home
      </Link>
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-2xl font-semibold">Runs</h1>
        <Link href="/runs/new" className="text-sm underline">
          New run
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-zinc-500">No runs yet</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={`/runs/${item.id}`}
                className="flex items-baseline justify-between gap-4 rounded border border-zinc-300 px-4 py-3 dark:border-zinc-700"
              >
                <span className="font-medium">{item.caseName}</span>
                <span className="text-sm text-zinc-500">
                  {item.statusLabel} · {item.progress}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
