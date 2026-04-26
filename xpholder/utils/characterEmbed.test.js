import { describe, it, expect } from "vitest";
import { getProgressionBar, getEmbedLevelSettings } from "./characterEmbed.js";
import config from "../config.json";

const { XPHOLDER_COLOUR, XPHOLDER_LEVEL_UP_COLOUR } = config;

describe("getProgressionBar", () => {
  it("renders an empty bar at 0%", () => {
    const result = getProgressionBar(0, 100);
    expect(result).toContain("0% Complete");
    expect(result).not.toContain("█");
  });

  it("renders a full bar at 100%", () => {
    const result = getProgressionBar(100, 100);
    expect(result).toContain("100% Complete");
    expect(result).toContain("█".repeat(15));
    expect(result).not.toContain("-");
  });

  it("renders a partially-filled bar at 33%", () => {
    const result = getProgressionBar(33, 100);
    expect(result).toContain("33% Complete");
    // 33/100 * 15 = 4.95 → rounds to 5 bars; 0.67 * 15 = 10.05 → rounds to 10 dashes
    expect(result).toMatch(/█{5}-{10}/);
  });

  it("wraps the bar in a Discord code block", () => {
    const result = getProgressionBar(0, 100);
    expect(result.startsWith("```|")).toBe(true);
    expect(result.endsWith("```")).toBe(true);
  });
});

describe("getEmbedLevelSettings", () => {
  it("returns a plain Level field and base color when level is unchanged", () => {
    const result = getEmbedLevelSettings({ level: "5" }, { level: "5" });
    expect(result.levelField).toEqual({ inline: true, name: "Level", value: "5" });
    expect(result.color).toBe(XPHOLDER_COLOUR);
  });

  it("returns a Level Up! field and the level-up color when level changed", () => {
    const result = getEmbedLevelSettings({ level: "6" }, { level: "5" });
    expect(result.levelField).toEqual({
      inline: true,
      name: "Level Up!",
      value: "5 --> **6**",
    });
    expect(result.color).toBe(XPHOLDER_LEVEL_UP_COLOUR);
  });
});
