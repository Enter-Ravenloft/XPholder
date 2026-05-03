import { describe, it, expect } from "vitest";
import { levelFromXp } from "./db.js";

// A 5-level fixture: level 1 = [0, 100), level 2 = [100, 300),
// level 3 = [300, 600), level 4 = [600, 1000), level 5 = [1000, ...).
// Cumulative thresholds = [0, 100, 300, 600, 1000].
const FIXTURE_THRESHOLDS = [0, 100, 300, 600, 1000];

describe("levelFromXp", () => {
  it("returns 1 for xp at the floor", () => {
    expect(levelFromXp(0, FIXTURE_THRESHOLDS)).toBe(1);
  });

  it("returns 1 for xp just below the level-2 threshold", () => {
    expect(levelFromXp(99, FIXTURE_THRESHOLDS)).toBe(1);
  });

  it("returns 2 exactly at the level-2 threshold", () => {
    expect(levelFromXp(100, FIXTURE_THRESHOLDS)).toBe(2);
  });

  it("returns the correct level for mid-bucket xp", () => {
    expect(levelFromXp(450, FIXTURE_THRESHOLDS)).toBe(3);
  });

  it("returns the top fixture level for xp at its threshold", () => {
    expect(levelFromXp(1000, FIXTURE_THRESHOLDS)).toBe(5);
  });

  it("returns the top fixture level for xp far above its threshold", () => {
    expect(levelFromXp(1_000_000, FIXTURE_THRESHOLDS)).toBe(5);
  });

  it("caps at level 20 for an over-long thresholds array", () => {
    // 21 thresholds → level 21 would be reachable without the cap.
    const longThresholds = Array.from({ length: 21 }, (_, i) => i * 100);
    expect(levelFromXp(2_000_000, longThresholds)).toBe(20);
  });
});
