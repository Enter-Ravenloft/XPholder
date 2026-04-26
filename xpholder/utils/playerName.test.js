import { describe, it, expect } from "vitest";
import { playerName } from "./playerName.js";

describe("playerName", () => {
  it("returns null when both displayName and username are missing", () => {
    expect(playerName(null, null)).toBe(null);
    expect(playerName("", "")).toBe(null);
    expect(playerName(undefined, undefined)).toBe(null);
  });

  it("returns the displayName when present", () => {
    expect(playerName("Alice", "alice123")).toBe("Alice");
  });

  it("falls back to username when displayName is empty", () => {
    expect(playerName("", "alice123")).toBe("alice123");
    expect(playerName(null, "alice123")).toBe("alice123");
  });

  it("extracts the contents of leading brackets", () => {
    expect(playerName("[Player] Real Name", null)).toBe("Player");
    expect(playerName("[Bob the Wizard] Tier 4", null)).toBe("Bob the Wizard");
  });

  it("splits on pipe delimiter and takes the first segment", () => {
    expect(playerName("Sarah | Tier 4", null)).toBe("Sarah");
    expect(playerName("Mike ¦ DM", null)).toBe("Mike");
  });

  it("splits on emoji and takes the first segment", () => {
    expect(playerName("Bob ★ Wizard", null)).toBe("Bob");
    expect(playerName("Alice ❤ Healer", null)).toBe("Alice");
  });

  it("strips a trailing parenthesized clause", () => {
    expect(playerName("Alice (UTC-5)", null)).toBe("Alice");
    expect(playerName("Bob (he/him)", null)).toBe("Bob");
  });

  it("strips a trailing superscript suffix", () => {
    expect(playerName("Mike²⁰ wizard", null)).toBe("Mike");
    expect(playerName("Sarah¹⁵ DM", null)).toBe("Sarah");
  });

  it("strips a trailing -tag suffix", () => {
    expect(playerName("Tom-DM", null)).toBe("Tom");
  });

  it("collapses to the first word when the name contains a digit and a space", () => {
    expect(playerName("Jane 4pm", null)).toBe("Jane");
  });

  it("collapses to the first word when the name contains a timezone abbreviation", () => {
    expect(playerName("Alice PST", null)).toBe("Alice");
    expect(playerName("Bob UTC dm", null)).toBe("Bob");
  });

  it("preserves a plain multi-word name with no signals", () => {
    expect(playerName("Bob the Wizard", null)).toBe("Bob the Wizard");
  });
});
