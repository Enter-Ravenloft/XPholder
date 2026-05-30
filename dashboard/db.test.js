import { describe, it, expect } from "vitest";
import { levelFromXp, bucketCharactersByLevel } from "./db.js";

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

describe("bucketCharactersByLevel", () => {
  // Brackets covering levels 1-2, 3-4, 5+
  const BRACKETS = [
    { label: "1-2", min: 1, max: 2 },
    { label: "3-4", min: 3, max: 4 },
    { label: "5-5", min: 5, max: 5 },
  ];

  it("assigns each character to the bracket containing its level", () => {
    const result = bucketCharactersByLevel(
      [
        { character_id: "a", xp: 0 },     // level 1
        { character_id: "b", xp: 450 },   // level 3
        { character_id: "c", xp: 1000 },  // level 5
      ],
      BRACKETS,
      FIXTURE_THRESHOLDS
    );

    expect([...result["1-2"]]).toEqual(["a"]);
    expect([...result["3-4"]]).toEqual(["b"]);
    expect([...result["5-5"]]).toEqual(["c"]);
  });

  it("deduplicates the same character_id appearing multiple times", () => {
    const result = bucketCharactersByLevel(
      [
        { character_id: "a", xp: 0 },
        { character_id: "a", xp: 0 },
        { character_id: "a", xp: 0 },
      ],
      BRACKETS,
      FIXTURE_THRESHOLDS
    );

    expect(result["1-2"].size).toBe(1);
  });

  it("drops characters whose level lies outside every bracket", () => {
    const narrowBrackets = [{ label: "3-4", min: 3, max: 4 }];

    const result = bucketCharactersByLevel(
      [
        { character_id: "below", xp: 0 },     // level 1
        { character_id: "inside", xp: 450 },  // level 3
        { character_id: "above", xp: 1000 },  // level 5
      ],
      narrowBrackets,
      FIXTURE_THRESHOLDS
    );

    expect([...result["3-4"]]).toEqual(["inside"]);
    expect(Object.keys(result)).toEqual(["3-4"]);
  });
});
