import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isLaunchErrorCode, LAUNCH_ERRORS } from "@/lib/runs/launchErrors";
import { launchRun } from "./actions";

const inputClass =
  "rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900";

// Запуск шаблону: крок 1 — вибір шаблону (GET), крок 2 — назва випадку й виконавці задач (AC-RUN-01…09).
export default async function NewRunPage({ searchParams }: PageProps<"/runs/new">) {
  const supabase = await createClient();

  // getClaims() перевіряє JWT. getSession() для авторизації на сервері не використовуємо.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) {
    redirect("/login");
  }

  const { template, error } = await searchParams;
  const errorMessage = isLaunchErrorCode(error) ? LAUNCH_ERRORS[error] : undefined;

  const { data: templates } = await supabase
    .from("templates")
    .select("id, name")
    .order("name");
  const selected = templates?.find((t) => t.id === template);

  const sections = selected
    ? ((
        await supabase
          .from("template_sections")
          .select("id, name, position")
          .eq("template_id", selected.id)
          .order("position")
      ).data ?? [])
    : [];
  const tasks = selected
    ? ((
        await supabase
          .from("template_tasks")
          .select("id, name, position, section_id")
          .eq("template_id", selected.id)
          .order("position")
      ).data ?? [])
    : [];

  // Виконавця можна обрати з manager/admin: лише id і email (без ролі й іншого профілю).
  const { data: users } = selected
    ? await supabase.rpc("list_assignable_users")
    : { data: null };
  const otherUsers = (users ?? []).filter((u) => u.id !== claims.sub);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-16">
      <Link href="/" className="text-sm text-zinc-500 underline">
        Home
      </Link>
      <h1 className="text-2xl font-semibold">New run</h1>

      <form method="get" action="/runs/new" className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Template
          <select name="template" defaultValue={selected?.id ?? ""} className={inputClass}>
            <option value="" disabled>
              Choose a template
            </option>
            {(templates ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="self-start rounded border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
        >
          Choose template
        </button>
      </form>

      {selected ? (
        <form action={launchRun} className="flex flex-col gap-6">
          <input type="hidden" name="template_id" value={selected.id} />
          <label className="flex flex-col gap-1 text-sm">
            Case name
            <input name="case_name" type="text" className={inputClass} />
          </label>

          {sections.map((section) => (
            <fieldset key={section.id} className="flex flex-col gap-3">
              <legend className="text-sm font-medium">{section.name}</legend>
              {tasks
                .filter((task) => task.section_id === section.id)
                .map((task) => (
                  <label key={task.id} className="flex flex-col gap-1 text-sm">
                    {task.name}
                    <select
                      name={`assignee_${task.id}`}
                      defaultValue=""
                      className={inputClass}
                    >
                      <option value="">Me</option>
                      {otherUsers.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.email}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
            </fieldset>
          ))}

          {errorMessage ? (
            <p role="alert" className="text-sm text-red-600">
              {errorMessage}
            </p>
          ) : null}
          <button
            type="submit"
            className="self-start rounded bg-foreground px-4 py-2 font-medium text-background"
          >
            Launch
          </button>
        </form>
      ) : null}
    </main>
  );
}
