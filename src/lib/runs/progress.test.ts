import { describe, expect, it } from "vitest";
import { countDone, formatProgress, formatRunProgress } from "./progress";

const tasks = (statuses: string[]) => statuses.map((status) => ({ status }));

describe("progress", () => {
  it("AC-TASK-05: у запуску з 5 задач, 2 з яких «done», прогрес — «2 of 5 done»", () => {
    const run = tasks(["done", "done", "to_do", "to_do", "to_do"]);

    expect(formatRunProgress(run)).toBe("2 of 5 done");
    expect(formatProgress(countDone(run), run.length)).toBe("2 of 5 done");
  });

  it("рахує всі задачі запуску, обов'язкові чи ні", () => {
    expect(formatProgress(1, 5)).toBe("1 of 5 done");
  });

  it("запуск без задач має прогрес «0 of 0 done»", () => {
    expect(formatRunProgress([])).toBe("0 of 0 done");
  });

  it("до done не рахує задачі «to do»", () => {
    expect(countDone(tasks(["to_do", "to_do"]))).toBe(0);
  });
});
