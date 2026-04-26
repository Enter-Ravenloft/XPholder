import { describe, it, expect } from "vitest";
import { isValidYmd } from "./validation.js";

describe("isValidYmd", () => {
  it("accepts a well-formed valid date", () => {
    expect(isValidYmd("2026-04-25")).toBe(true);
    expect(isValidYmd("2000-01-01")).toBe(true);
    expect(isValidYmd("2024-02-29")).toBe(true); // leap year
  });

  it("rejects wrong delimiters", () => {
    expect(isValidYmd("2026/04/25")).toBe(false);
    expect(isValidYmd("2026.04.25")).toBe(false);
  });

  it("rejects wrong digit counts", () => {
    expect(isValidYmd("26-04-25")).toBe(false);
    expect(isValidYmd("2026-4-25")).toBe(false);
    expect(isValidYmd("2026-04-5")).toBe(false);
  });

  it("rejects impossible months", () => {
    expect(isValidYmd("2026-13-01")).toBe(false);
    expect(isValidYmd("2026-00-01")).toBe(false);
  });

  it("rejects impossible days for the given month", () => {
    expect(isValidYmd("2026-02-30")).toBe(false);
    expect(isValidYmd("2025-02-29")).toBe(false); // not a leap year
    expect(isValidYmd("2026-04-31")).toBe(false);
  });

  it("rejects empty and non-date strings", () => {
    expect(isValidYmd("")).toBe(false);
    expect(isValidYmd("not a date")).toBe(false);
  });
});
