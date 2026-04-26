import { describe, it, expect } from "vitest";
import {
  getActiveCharacterNumber,
  getLevelInfo,
  getRoleMultiplier,
  getTier,
  getXp,
} from "./getters.js";

const LEVELS = { "1": 300, "2": 600, "3": 1800, "4": 3800, "5": 7500 };

describe("getActiveCharacterNumber", () => {
  const config = {
    characterCount: 3,
    character1RoleId: "role1",
    character2RoleId: "role2",
    character3RoleId: "role3",
  };

  it("defaults to 1 when no character role is present", () => {
    expect(getActiveCharacterNumber(config, ["someOther"])).toBe(1);
  });

  it("returns the character index for the matching role", () => {
    expect(getActiveCharacterNumber(config, ["role2"])).toBe(2);
    expect(getActiveCharacterNumber(config, ["role3"])).toBe(3);
  });

  it("returns the lowest matching index when multiple character roles are present", () => {
    expect(getActiveCharacterNumber(config, ["role3", "role1"])).toBe(1);
  });
});

describe("getLevelInfo", () => {
  it("reports level 1 progress for low XP", () => {
    expect(getLevelInfo(LEVELS, 0)).toEqual({ level: "1", levelXp: 0, xpToNext: 300 });
    expect(getLevelInfo(LEVELS, 200)).toEqual({ level: "1", levelXp: 200, xpToNext: 300 });
  });

  it("rolls over to the next level at the threshold", () => {
    expect(getLevelInfo(LEVELS, 300)).toEqual({ level: "2", levelXp: 0, xpToNext: 600 });
  });

  it("reports level 3 progress mid-level", () => {
    // 300 (lvl1) + 600 (lvl2) = 900 to start lvl 3; +500 of progress in lvl 3
    expect(getLevelInfo(LEVELS, 1400)).toEqual({ level: "3", levelXp: 500, xpToNext: 1800 });
  });

  it("clamps to level 20 once all defined levels are exhausted", () => {
    const total = 300 + 600 + 1800 + 3800 + 7500;
    expect(getLevelInfo(LEVELS, total + 1).level).toBe("20");
  });
});

describe("getRoleMultiplier", () => {
  const guildRoles = { roleA: 2, roleB: 3, freeze: 0 };

  it("returns 1 when the player has no relevant roles", () => {
    expect(getRoleMultiplier("highest", guildRoles, ["unrelated"])).toBe(1);
    expect(getRoleMultiplier("sum", guildRoles, ["unrelated"])).toBe(1);
  });

  describe("highest mode", () => {
    it("returns the highest bonus among the player's matching roles", () => {
      expect(getRoleMultiplier("highest", guildRoles, ["roleA", "roleB"])).toBe(3);
    });

    it("short-circuits to 0 when the player has any zero-bonus role (xp freeze)", () => {
      expect(getRoleMultiplier("highest", guildRoles, ["roleB", "freeze"])).toBe(0);
      expect(getRoleMultiplier("highest", guildRoles, ["freeze", "roleB"])).toBe(0);
    });
  });

  describe("sum mode", () => {
    it("sums all matching bonuses on top of the base of 1", () => {
      expect(getRoleMultiplier("sum", guildRoles, ["roleA", "roleB"])).toBe(6); // 1 + 2 + 3
    });

    it("short-circuits to 0 when freeze is present", () => {
      expect(getRoleMultiplier("sum", guildRoles, ["roleA", "freeze"])).toBe(0);
    });
  });
});

describe("getTier", () => {
  it("maps WotC level brackets to tiers", () => {
    expect(getTier(1)).toEqual({ tier: 1, nextTier: 2 });
    expect(getTier(4)).toEqual({ tier: 1, nextTier: 2 });
    expect(getTier(5)).toEqual({ tier: 2, nextTier: 3 });
    expect(getTier(10)).toEqual({ tier: 2, nextTier: 3 });
    expect(getTier(11)).toEqual({ tier: 3, nextTier: 4 });
    expect(getTier(16)).toEqual({ tier: 3, nextTier: 4 });
    expect(getTier(17)).toEqual({ tier: 4, nextTier: 4 });
    expect(getTier(20)).toEqual({ tier: 4, nextTier: 4 });
  });
});

describe("getXp", () => {
  it("flat formula ignores word count", () => {
    expect(getXp(100, 2, 5, 100, "flat")).toBe(10); // 5 * 2
  });

  it("linear formula scales with word count", () => {
    // (5 + 100/100) * 2 = 12
    expect(getXp(100, 2, 5, 100, "linear")).toBe(12);
  });

  it("exponential formula compounds with word count", () => {
    // (5 + 1) * (1 + 1) * 2 = 24
    expect(getXp(100, 2, 5, 100, "exponential")).toBe(24);
  });

  // Documents existing behaviour. Backlog item: this should throw or return a
  // sentinel rather than silently returning 0.
  it("returns 0 silently for an unknown formula", () => {
    expect(getXp(100, 2, 5, 100, "unrecognized")).toBe(0);
  });
});
