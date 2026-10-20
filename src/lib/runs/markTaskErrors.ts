// Повідомлення про помилку позначення задачі. Між запитами передаємо код, а не текст:
// так у сторінку не потрапляє довільний текст з адреси.
export const MARK_TASK_FORBIDDEN_MESSAGE =
  "Only the task's assignee, the run manager, or an administrator can mark a task as done";

export const MARK_TASK_ERRORS = {
  forbidden: MARK_TASK_FORBIDDEN_MESSAGE, // AC-TASK-03
  // Технічна відмова (текст вимогами не визначено).
  failed: "Could not mark the task as done",
} as const;

export type MarkTaskErrorCode = keyof typeof MARK_TASK_ERRORS;

// Відмову за правами mark_task_done розпізнаємо за кодом 42501 і дослівним текстом винятку:
// інша 42501 (наприклад, «Not authorized» чи відсутній execute) — технічна відмова, а не AC-TASK-03.
export function markTaskErrorCode(error: { code?: string; message?: string }): MarkTaskErrorCode {
  if (error.code === "42501" && error.message === MARK_TASK_FORBIDDEN_MESSAGE) {
    return "forbidden";
  }
  return "failed";
}

export function isMarkTaskErrorCode(value: unknown): value is MarkTaskErrorCode {
  return typeof value === "string" && Object.hasOwn(MARK_TASK_ERRORS, value);
}
