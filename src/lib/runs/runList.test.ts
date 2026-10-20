import { describe, expect, it } from "vitest";
import { buildRunList } from "./runList";

const run = (id: string, createdAt: string, status = "in_progress") => ({
  id,
  case_name: `Case ${id}`,
  status,
  created_at: createdAt,
});

describe("buildRunList", () => {
  it("AC-TASK-09: запуск із 5 задач, 2 «done», показано з прогресом «2 of 5 done»", () => {
    const tasks = ["done", "done", "to_do", "to_do", "to_do"].map((status) => ({
      run_id: "r1",
      status,
    }));

    const [item] = buildRunList([run("r1", "2026-10-19T10:00:00Z")], tasks);

    expect(item.progress).toBe("2 of 5 done");
    expect(item.caseName).toBe("Case r1");
  });

  it("новіші запуски йдуть першими", () => {
    const list = buildRunList(
      [run("old", "2026-10-18T10:00:00Z"), run("new", "2026-10-19T10:00:00Z")],
      [],
    );

    expect(list.map((item) => item.id)).toEqual(["new", "old"]);
  });

  it("прогрес кожного запуску рахує лише його задачі", () => {
    const list = buildRunList(
      [run("r1", "2026-10-19T10:00:00Z"), run("r2", "2026-10-18T10:00:00Z")],
      [
        { run_id: "r1", status: "done" },
        { run_id: "r2", status: "to_do" },
        { run_id: "r2", status: "to_do" },
      ],
    );

    expect(list.map((item) => item.progress)).toEqual(["1 of 1 done", "0 of 2 done"]);
  });

  it("показує статус запуску як в AC", () => {
    const [item] = buildRunList([run("r1", "2026-10-19T10:00:00Z", "completed")], []);

    expect(item.statusLabel).toBe("completed");
  });

  it("порожній список лишається порожнім", () => {
    expect(buildRunList([], [])).toEqual([]);
  });
});
