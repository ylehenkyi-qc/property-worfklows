import { describe, expect, it } from "vitest";
import { groupTasksBySection } from "./groupTasksBySection";
import { assigneeLabel, runStatusLabel, taskStatusLabel } from "./labels";

const sections = [
  { id: "s2", name: "Move-in day", position: 2 },
  { id: "s1", name: "Before move-in", position: 1 },
];

const tasks = [
  { id: "t5", name: "Record meter readings", position: 2, section_id: "s2", status: "to_do" },
  { id: "t2", name: "Collect the signed lease", position: 2, section_id: "s1", status: "done" },
  { id: "t4", name: "Hand over the keys", position: 1, section_id: "s2", status: "to_do" },
  { id: "t1", name: "Inspect the apartment", position: 1, section_id: "s1", status: "done" },
  { id: "t3", name: "Send welcome information", position: 3, section_id: "s1", status: "to_do" },
];

describe("groupTasksBySection", () => {
  it("AC-TASK-08: показує статус «done» або «to do» для кожної з 5 задач запуску", () => {
    const groups = groupTasksBySection(sections, tasks);
    const shown = groups.flatMap((g) => g.tasks.map((t) => [t.id, taskStatusLabel(t.status)]));

    expect(shown).toEqual([
      ["t1", "done"],
      ["t2", "done"],
      ["t3", "to do"],
      ["t4", "to do"],
      ["t5", "to do"],
    ]);
  });

  it("секції йдуть за position, задачі всередині секції теж", () => {
    const groups = groupTasksBySection(sections, tasks);

    expect(groups.map((g) => g.section.name)).toEqual(["Before move-in", "Move-in day"]);
    expect(groups[0].tasks.map((t) => t.id)).toEqual(["t1", "t2", "t3"]);
    expect(groups[1].tasks.map((t) => t.id)).toEqual(["t4", "t5"]);
  });

  it("секція без задач лишається в списку з порожніми задачами", () => {
    expect(groupTasksBySection([{ id: "s1", position: 1 }], [])).toEqual([
      { section: { id: "s1", position: 1 }, tasks: [] },
    ]);
  });

  it("не змінює вхідні масиви", () => {
    const before = tasks.map((t) => t.id);
    groupTasksBySection(sections, tasks);

    expect(tasks.map((t) => t.id)).toEqual(before);
    expect(sections.map((s) => s.id)).toEqual(["s2", "s1"]);
  });
});

describe("labels", () => {
  it("підписує статуси запуску й задачі так, як в AC", () => {
    expect(runStatusLabel("in_progress")).toBe("in progress");
    expect(runStatusLabel("completed")).toBe("completed");
    expect(taskStatusLabel("to_do")).toBe("to do");
    expect(taskStatusLabel("done")).toBe("done");
  });

  it("підпис виконавця — email із list_assignable_users", () => {
    expect(assigneeLabel("u1", [{ id: "u1", email: "manager1@example.test" }])).toBe(
      "manager1@example.test",
    );
  });

  it("невідомого виконавця або email null підписує «—»", () => {
    expect(assigneeLabel("u2", [{ id: "u1", email: "manager1@example.test" }])).toBe("—");
    expect(assigneeLabel("u1", [{ id: "u1", email: null }])).toBe("—");
  });
});
