// Повідомлення форми запуску шаблону. Помилки з бази й форми передаємо між запитами кодом, а не текстом:
// так у сторінку не потрапляє довільний текст з адреси.
import {
  CASE_NAME_EMPTY_MESSAGE,
  CASE_NAME_TOO_LONG_MESSAGE,
} from "./validateCaseName";

export const LAUNCH_ERRORS = {
  name_empty: CASE_NAME_EMPTY_MESSAGE,
  name_too_long: CASE_NAME_TOO_LONG_MESSAGE,
  // Технічна відмова (текст вимогами не визначено): недосяжна зі звичайної форми.
  failed: "Could not launch the run",
} as const;

export type LaunchErrorCode = keyof typeof LAUNCH_ERRORS;

// Код помилки за текстом винятку launch_run; невідомий текст — технічна відмова.
export function launchErrorCode(message: string): LaunchErrorCode {
  if (message === CASE_NAME_EMPTY_MESSAGE) return "name_empty";
  if (message === CASE_NAME_TOO_LONG_MESSAGE) return "name_too_long";
  return "failed";
}

export function isLaunchErrorCode(value: unknown): value is LaunchErrorCode {
  return typeof value === "string" && Object.hasOwn(LAUNCH_ERRORS, value);
}
