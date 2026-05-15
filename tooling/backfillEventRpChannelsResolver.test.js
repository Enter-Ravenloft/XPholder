import { describe, it, expect } from "vitest";
import { resolveChannelId } from "./backfillEventRpChannelsResolver.js";

describe("resolveChannelId", () => {
  const snapshot = {
    "ems-quarterdeck": "111",
    "mission-11": "222",
    "the-cellar": "333",
  };
  const aliases = {
    "old-quarterdeck": "111",
    "mission-eleven": "222",
  };

  it("returns the alias-mapped id when the name appears in aliases", () => {
    expect(resolveChannelId({ name: "old-quarterdeck", snapshot, aliases })).toBe("111");
  });

  it("falls back to snapshot when no alias matches", () => {
    expect(resolveChannelId({ name: "the-cellar", snapshot, aliases })).toBe("333");
  });

  it("matches snapshot case-insensitively", () => {
    expect(resolveChannelId({ name: "EMS-QuarterDeck", snapshot, aliases })).toBe("111");
  });

  it("returns null when neither snapshot nor aliases match", () => {
    expect(resolveChannelId({ name: "unknown-room", snapshot, aliases })).toBeNull();
  });

  it("prefers aliases over snapshot when both have an entry", () => {
    const aliasOverride = { ...aliases, "the-cellar": "999" };
    expect(resolveChannelId({ name: "the-cellar", snapshot, aliases: aliasOverride })).toBe("999");
  });

  it("returns null for empty or missing name", () => {
    expect(resolveChannelId({ name: "", snapshot, aliases })).toBeNull();
    expect(resolveChannelId({ name: null, snapshot, aliases })).toBeNull();
    expect(resolveChannelId({ name: undefined, snapshot, aliases })).toBeNull();
  });
});
