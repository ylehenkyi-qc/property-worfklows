import Link from "next/link";

// Запуск не знайдено або його не видно користувачеві (RLS): однакова відповідь, щоб не розкривати чужі запуски.
export default function RunNotFound() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-6 py-16">
      <h1 className="text-2xl font-semibold">Run not found</h1>
      <Link href="/runs" className="text-sm text-zinc-500 underline">
        Runs
      </Link>
    </main>
  );
}
