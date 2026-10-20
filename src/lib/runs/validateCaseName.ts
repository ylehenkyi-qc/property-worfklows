// Перевірка назви випадку перед запуском шаблону (AC-RUN-03, AC-RUN-07).
// Правило дублює launch_run у базі (там воно авторитетне): тут лише для зручності форми.
export const CASE_NAME_MAX_LENGTH = 100;
export const CASE_NAME_EMPTY_MESSAGE = "Enter a case name";
export const CASE_NAME_TOO_LONG_MESSAGE = "Case name must be at most 100 characters";

export type CaseNameResult = { ok: true; value: string } | { ok: false; error: string };

// Як btrim у Postgres: обрізаємо лише пробіли по краях, не будь-який whitespace.
export function validateCaseName(input: string): CaseNameResult {
  const value = input.replace(/^ +| +$/g, "");
  if (value === "") {
    return { ok: false, error: CASE_NAME_EMPTY_MESSAGE };
  }
  // Довжина в символах (як char_length), а не в UTF-16 одиницях.
  if ([...value].length > CASE_NAME_MAX_LENGTH) {
    return { ok: false, error: CASE_NAME_TOO_LONG_MESSAGE };
  }
  return { ok: true, value };
}
