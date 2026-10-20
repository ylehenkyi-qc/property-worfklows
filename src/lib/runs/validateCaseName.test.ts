import { describe, expect, it } from "vitest";
import { validateCaseName } from "./validateCaseName";

describe("validateCaseName", () => {
  it("AC-RUN-03: порожня назва відхиляється з повідомленням «Enter a case name»", () => {
    expect(validateCaseName("")).toEqual({ ok: false, error: "Enter a case name" });
  });

  it("AC-RUN-03: назва лише з пробілів вважається порожньою", () => {
    expect(validateCaseName("     ")).toEqual({ ok: false, error: "Enter a case name" });
  });

  it("AC-RUN-07: назва у 101 символ відхиляється з повідомленням «Case name must be at most 100 characters»", () => {
    expect(validateCaseName("a".repeat(101))).toEqual({
      ok: false,
      error: "Case name must be at most 100 characters",
    });
  });

  it("AC-RUN-07: назва рівно у 100 символів проходить", () => {
    const name = "a".repeat(100);
    expect(validateCaseName(name)).toEqual({ ok: true, value: name });
  });

  it("обрізає пробіли по краях і повертає обрізану назву", () => {
    expect(validateCaseName("  Apartment 12, move-in  ")).toEqual({
      ok: true,
      value: "Apartment 12, move-in",
    });
  });

  it("довжину рахує після обрізання пробілів", () => {
    expect(validateCaseName(` ${"a".repeat(100)} `)).toEqual({ ok: true, value: "a".repeat(100) });
  });

  it("довжину рахує в символах, а не в UTF-16 одиницях", () => {
    // 100 символів поза базовою площиною — 200 одиниць UTF-16.
    expect(validateCaseName("😀".repeat(100)).ok).toBe(true);
    expect(validateCaseName("😀".repeat(101)).ok).toBe(false);
  });
});
