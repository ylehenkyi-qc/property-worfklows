"use client"; // Error boundaries мають бути Client Components

import { useEffect } from "react";

// Помилка завантаження запусків: показуємо коротке повідомлення замість хибного порожнього стану.
export default function RunsError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-6 py-16">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <button
        type="button"
        onClick={() => retry()}
        className="self-start rounded border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
      >
        Try again
      </button>
    </main>
  );
}
