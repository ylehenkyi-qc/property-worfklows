// Прогрес запуску «N of M done»: N — задачі зі статусом «done», M — усі задачі запуску, обов'язкові чи ні
// (AC-TASK-05, AC-TASK-09).
export function formatProgress(done: number, total: number): string {
  return `${done} of ${total} done`;
}

export function countDone(tasks: readonly { status: string }[]): number {
  return tasks.filter((task) => task.status === "done").length;
}

export function formatRunProgress(tasks: readonly { status: string }[]): string {
  return formatProgress(countDone(tasks), tasks.length);
}
