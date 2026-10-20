// Підписи статусів (як в AC: «in progress» / «completed», «to do» / «done») і виконавця.
const RUN_STATUS_LABELS: Record<string, string> = {
  in_progress: "in progress",
  completed: "completed",
};

const TASK_STATUS_LABELS: Record<string, string> = {
  to_do: "to do",
  done: "done",
};

export function runStatusLabel(status: string): string {
  return RUN_STATUS_LABELS[status] ?? status;
}

export function taskStatusLabel(status: string): string {
  return TASK_STATUS_LABELS[status] ?? status;
}

// Підпис виконавця: email із list_assignable_users, інакше «—» (без імені, ролі й іншого профілю).
export function assigneeLabel(
  assigneeId: string,
  users: readonly { id: string; email: string | null }[],
): string {
  return users.find((user) => user.id === assigneeId)?.email ?? "—";
}
