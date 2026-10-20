// Задачі запуску, згруповані за секціями: секції за position, задачі всередині за position
// (робоче припущення Q4: запуск копіює секції шаблону й показує задачі згрупованими в порядку шаблону).
export type SectionLike = { id: string; position: number };
export type TaskLike = { section_id: string; position: number };

export function groupTasksBySection<S extends SectionLike, T extends TaskLike>(
  sections: readonly S[],
  tasks: readonly T[],
): { section: S; tasks: T[] }[] {
  return [...sections]
    .sort((a, b) => a.position - b.position)
    .map((section) => ({
      section,
      tasks: tasks
        .filter((task) => task.section_id === section.id)
        .sort((a, b) => a.position - b.position),
    }));
}
