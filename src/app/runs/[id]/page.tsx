import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const STATUS_LABELS: Record<string, string> = {
  in_progress: "in progress",
  completed: "completed",
};

// Мінімальна заглушка сторінки запуску: після запуску шаблону є куди перейти.
// Повна сторінка (прогрес, задачі за секціями, «Mark as done») — група 3 плану impl-run-tasks.
export default async function RunPage({ params }: PageProps<"/runs/[id]">) {
  const supabase = await createClient();

  // getClaims() перевіряє JWT. getSession() для авторизації на сервері не використовуємо.
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) {
    redirect("/login");
  }

  const { id } = await params;
  // RLS: чужий запуск не повертається.
  const { data: run } = await supabase
    .from("runs")
    .select("id, case_name, status")
    .eq("id", id)
    .maybeSingle();
  if (!run) {
    notFound();
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-6 py-16">
      <Link href="/" className="text-sm text-zinc-500 underline">
        Home
      </Link>
      <h1 className="text-2xl font-semibold" data-testid="run-case-name">
        {run.case_name}
      </h1>
      <p className="text-sm text-zinc-500" data-testid="run-status">
        {STATUS_LABELS[run.status] ?? run.status}
      </p>
    </main>
  );
}
