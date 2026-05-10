import { describe, it, expect } from "vitest";
import {
  parseEventEditCustomId,
  computeFieldDiff,
  parseAndValidateModalFields,
  buildEventEditMessage,
  buildEventEditModal,
} from "./eventEditHelpers.js";

describe("parseEventEditCustomId", () => {
  it.each([
    ["event_edit_type:42", { kind: "type", eventId: 42 }],
    ["event_edit_tier:1", { kind: "tier", eventId: 1 }],
    ["event_edit_dm:999", { kind: "dm", eventId: 999 }],
    ["event_edit_rp_channel:42", { kind: "rp_channel", eventId: 42 }],
    ["event_edit_text:42", { kind: "text", eventId: 42 }],
    ["event_edit_modal:42", { kind: "modal", eventId: 42 }],
  ])("parses %s", (customId, expected) => {
    expect(parseEventEditCustomId(customId)).toEqual(expected);
  });

  it.each([
    "event_edit_other:42",
    "event_edit_type:abc",
    "event_edit_type:",
    "event_edit_type",
    "event_edit_:42",
    "wrong_prefix:42",
    "",
  ])("returns null for invalid id %s", (customId) => {
    expect(parseEventEditCustomId(customId)).toBeNull();
  });

  it("returns null for non-string input", () => {
    expect(parseEventEditCustomId(null)).toBeNull();
    expect(parseEventEditCustomId(undefined)).toBeNull();
    expect(parseEventEditCustomId(42)).toBeNull();
  });
});

describe("computeFieldDiff", () => {
  it("returns empty object for identical maps", () => {
    expect(computeFieldDiff({ a: 1, b: 2 }, { a: 1, b: 2 })).toEqual({});
  });

  it("returns only changed keys", () => {
    expect(computeFieldDiff({ a: 1, b: 2 }, { a: 9, b: 2 })).toEqual({ a: 9 });
  });

  it("treats null and undefined as equivalent", () => {
    expect(computeFieldDiff({ a: null }, { a: undefined })).toEqual({});
    expect(computeFieldDiff({ a: undefined }, { a: null })).toEqual({});
  });

  it("treats clearing a value (real → null) as a change", () => {
    expect(computeFieldDiff({ a: 5 }, { a: null })).toEqual({ a: null });
  });

  it("ignores keys not present in submitted", () => {
    expect(computeFieldDiff({ a: 1, b: 2 }, { a: 1 })).toEqual({});
  });
});

describe("parseAndValidateModalFields", () => {
  it("parses a fully valid submission", () => {
    const result = parseAndValidateModalFields({
      name: "Test Event",
      start_date: "2026-01-01",
      end_date: "2026-01-15",
      xp_reward: "1000",
      gp_reward: "500",
    });
    expect(result.valid).toBe(true);
    expect(result.parsed).toEqual({
      name: "Test Event",
      start_date: "2026-01-01",
      end_date: "2026-01-15",
      xp_reward: 1000,
      gp_reward: 500,
    });
  });

  it("trims whitespace from each field", () => {
    const result = parseAndValidateModalFields({
      name: "  Test Event  ",
      start_date: " 2026-01-01 ",
      end_date: "",
      xp_reward: "",
      gp_reward: "",
    });
    expect(result.valid).toBe(true);
    expect(result.parsed.name).toBe("Test Event");
    expect(result.parsed.start_date).toBe("2026-01-01");
  });

  it("treats empty optional fields as null", () => {
    const result = parseAndValidateModalFields({
      name: "X",
      start_date: "2026-01-01",
      end_date: "",
      xp_reward: "",
      gp_reward: "",
    });
    expect(result.valid).toBe(true);
    expect(result.parsed.end_date).toBeNull();
    expect(result.parsed.xp_reward).toBeNull();
    expect(result.parsed.gp_reward).toBeNull();
  });

  it("rejects empty name", () => {
    const result = parseAndValidateModalFields({
      name: "   ",
      start_date: "2026-01-01",
      end_date: "",
      xp_reward: "",
      gp_reward: "",
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Name cannot be empty.");
  });

  it("rejects invalid start_date format", () => {
    const result = parseAndValidateModalFields({
      name: "X",
      start_date: "01/01/2026",
      end_date: "",
      xp_reward: "",
      gp_reward: "",
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/start_date/);
  });

  it("rejects invalid end_date when non-empty", () => {
    const result = parseAndValidateModalFields({
      name: "X",
      start_date: "2026-01-01",
      end_date: "not-a-date",
      xp_reward: "",
      gp_reward: "",
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/end_date/);
  });

  it("rejects xp_reward out of range", () => {
    const result = parseAndValidateModalFields({
      name: "X",
      start_date: "2026-01-01",
      end_date: "",
      xp_reward: "9999999",
      gp_reward: "",
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/xp_reward/);
  });

  it("rejects xp_reward as non-integer", () => {
    const result = parseAndValidateModalFields({
      name: "X",
      start_date: "2026-01-01",
      end_date: "",
      xp_reward: "100.5",
      gp_reward: "",
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/xp_reward/);
  });

  it("rejects negative gp_reward", () => {
    const result = parseAndValidateModalFields({
      name: "X",
      start_date: "2026-01-01",
      end_date: "",
      xp_reward: "",
      gp_reward: "-1",
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/gp_reward/);
  });

  it("collects multiple errors at once", () => {
    const result = parseAndValidateModalFields({
      name: "",
      start_date: "bad",
      end_date: "",
      xp_reward: "abc",
      gp_reward: "",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });
});

describe("buildEventEditMessage", () => {
  const fixture = {
    event_id: 42,
    name: "Test Event",
    event_type: "Mission",
    tier: "5-7",
    start_date: new Date("2026-01-01T00:00:00Z"),
    end_date: null,
    xp_reward: null,
    gp_reward: null,
    status: "active",
  };

  it("returns one embed and five action rows", () => {
    const result = buildEventEditMessage(fixture, []);
    expect(result.embeds).toHaveLength(1);
    expect(result.components).toHaveLength(5);
  });

  it("encodes eventId in each component customId", () => {
    const result = buildEventEditMessage(fixture, []);
    const customIds = result.components.map((row) => row.components[0].data.custom_id);
    expect(customIds).toEqual([
      "event_edit_type:42",
      "event_edit_tier:42",
      "event_edit_dm:42",
      "event_edit_rp_channel:42",
      "event_edit_text:42",
    ]);
  });

  it("renders '—' for null end_date and rewards", () => {
    const result = buildEventEditMessage(fixture, []);
    const fields = result.embeds[0].data.fields;
    expect(fields.find((f) => f.name === "End").value).toBe("—");
    expect(fields.find((f) => f.name === "XP Reward").value).toBe("—");
    expect(fields.find((f) => f.name === "GP Reward").value).toBe("—");
  });

  it("renders end_date and rewards when set", () => {
    const event = {
      ...fixture,
      end_date: new Date("2026-02-01T00:00:00Z"),
      xp_reward: 5000,
      gp_reward: 250,
    };
    const result = buildEventEditMessage(event, []);
    const fields = result.embeds[0].data.fields;
    expect(fields.find((f) => f.name === "End").value).toBe("2026-02-01");
    expect(fields.find((f) => f.name === "XP Reward").value).toBe("5000");
    expect(fields.find((f) => f.name === "GP Reward").value).toBe("250");
  });

  it("omits Channel field when no role_play_channel set", () => {
    const result = buildEventEditMessage(fixture, []);
    const fields = result.embeds[0].data.fields;
    expect(fields.find((f) => f.name === "Channel")).toBeUndefined();
  });

  it("renders Channel as a mention when role_play_channel_id is set", () => {
    const event = { ...fixture, role_play_channel_id: "1234567890", role_play_channel_name: "rp-room" };
    const result = buildEventEditMessage(event, []);
    const channelField = result.embeds[0].data.fields.find((f) => f.name === "Channel");
    expect(channelField.value).toBe("<#1234567890>");
  });

  it("falls back to role_play_channel_name when id is missing", () => {
    const event = { ...fixture, role_play_channel_id: null, role_play_channel_name: "rp-room" };
    const result = buildEventEditMessage(event, []);
    const channelField = result.embeds[0].data.fields.find((f) => f.name === "Channel");
    expect(channelField.value).toBe("rp-room");
  });

  it("renders DMs joined with comma; '—' when empty", () => {
    const noDms = buildEventEditMessage(fixture, []);
    expect(noDms.embeds[0].data.fields.find((f) => f.name === "DMs").value).toBe("—");

    const withDms = buildEventEditMessage(fixture, [
      { user_id: "1", username: "Alice", is_primary: true },
      { user_id: "2", username: "Bob", is_primary: false },
    ]);
    expect(withDms.embeds[0].data.fields.find((f) => f.name === "DMs").value).toMatch(/Alice/);
    expect(withDms.embeds[0].data.fields.find((f) => f.name === "DMs").value).toMatch(/Bob/);
  });
});

describe("buildEventEditModal", () => {
  const fixture = {
    event_id: 42,
    name: "Test Event",
    start_date: new Date("2026-01-01T00:00:00Z"),
    end_date: new Date("2026-01-15T00:00:00Z"),
    xp_reward: 1000,
    gp_reward: null,
  };

  it("encodes eventId in modal customId", () => {
    const modal = buildEventEditModal(fixture);
    expect(modal.data.custom_id).toBe("event_edit_modal:42");
  });

  it("includes 5 text inputs (one per action row)", () => {
    const modal = buildEventEditModal(fixture);
    expect(modal.components).toHaveLength(5);
    const inputCustomIds = modal.components.map((row) => row.components[0].data.custom_id);
    expect(inputCustomIds).toEqual(["name", "start_date", "end_date", "xp_reward", "gp_reward"]);
  });

  it("prefills inputs with current values", () => {
    const modal = buildEventEditModal(fixture);
    const values = modal.components.map((row) => row.components[0].data.value);
    expect(values).toEqual(["Test Event", "2026-01-01", "2026-01-15", "1000", ""]);
  });

  it("leaves empty for null end_date and rewards", () => {
    const modal = buildEventEditModal({ ...fixture, end_date: null, xp_reward: null });
    const values = modal.components.map((row) => row.components[0].data.value);
    expect(values[2]).toBe("");
    expect(values[3]).toBe("");
  });

  it("truncates event name to fit 45-char modal title but keeps full name in input", () => {
    const longName = "A".repeat(50);
    const modal = buildEventEditModal({ ...fixture, name: longName });
    expect(modal.data.title.length).toBeLessThanOrEqual(45);
    expect(modal.data.title).toMatch(/\.\.\.$/);
    // The name TextInput should still hold the full untruncated name for editing
    expect(modal.components[0].components[0].data.value).toBe(longName);
  });
});
