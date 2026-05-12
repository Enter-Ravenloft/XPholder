import { describe, it, expect } from "vitest";
import { formatParticipantName } from "./participantRender.js";

describe("formatParticipantName", () => {
  it("returns plain name when removal_reason is null", () => {
    expect(formatParticipantName({ character_name: "Alice", removal_reason: null })).toBe("Alice");
  });

  it("returns plain name when removal_reason is 'dropped'", () => {
    expect(formatParticipantName({ character_name: "Alice", removal_reason: "dropped" })).toBe("Alice");
  });

  it("returns name with 💀 (Death) suffix when removal_reason is 'death'", () => {
    expect(formatParticipantName({ character_name: "Alice", removal_reason: "death" })).toBe("Alice 💀 (Death)");
  });
});
