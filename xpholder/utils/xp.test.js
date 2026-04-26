import { describe, it, expect } from "vitest";
import { calculateXp } from "./xp.js";

const LEVELS = { "1": 300, "2": 600, "3": 1800, "4": 3800, "5": 7500 };

describe("calculateXp", () => {
  describe("set_level", () => {
    it("returns the cumulative XP needed to start the requested level", () => {
      expect(calculateXp("set_level", { xp: 0 }, LEVELS, 1)).toBe(0);
      expect(calculateXp("set_level", { xp: 0 }, LEVELS, 2)).toBe(300);
      expect(calculateXp("set_level", { xp: 0 }, LEVELS, 3)).toBe(900); // 300 + 600
      expect(calculateXp("set_level", { xp: 0 }, LEVELS, 4)).toBe(2700); // 300 + 600 + 1800
    });

    it("ignores the character's current xp", () => {
      expect(calculateXp("set_level", { xp: 9999 }, LEVELS, 2)).toBe(300);
    });
  });

  describe("set_xp", () => {
    it("returns the literal value", () => {
      expect(calculateXp("set_xp", { xp: 999 }, LEVELS, 1234)).toBe(1234);
    });
  });

  describe("give_xp", () => {
    it("adds value to the character's current xp", () => {
      expect(calculateXp("give_xp", { xp: 500 }, LEVELS, 200)).toBe(700);
      expect(calculateXp("give_xp", { xp: 0 }, LEVELS, 100)).toBe(100);
    });
  });
});
