import { describe, it, expect } from "vitest";
import {
  parseAddPcCustomId,
  buildAddPcMessage,
} from "./eventAddPcHelpers.js";

describe("parseAddPcCustomId", () => {
  it.each([
    ["event_add_pc_user:42", { kind: "user", eventId: 42, playerId: null }],
    ["event_add_pc_user:42:n3", { kind: "user", eventId: 42, playerId: null }],
    ["event_add_pc_char:42:1234567890", { kind: "char", eventId: 42, playerId: "1234567890" }],
    ["event_add_pc_done:42", { kind: "done", eventId: 42, playerId: null }],
  ])("parses %s", (customId, expected) => {
    expect(parseAddPcCustomId(customId)).toEqual(expected);
  });

  it.each([
    "event_add_pc_user:42:extra",     // user must NOT have a playerId segment
    "event_add_pc_done:42:extra",     // done must NOT have a playerId segment
    "event_add_pc_char:42",           // char REQUIRES a playerId segment
    "event_add_pc_other:42",          // unknown kind
    "event_add_pc_user:abc",          // non-numeric eventId
    "event_add_pc_char:42:abc",       // non-numeric playerId
    "event_add_pc_user:",             // empty eventId
    "wrong_prefix:42",                // wrong prefix
    "",                               // empty string
  ])("returns null for invalid id %s", (customId) => {
    expect(parseAddPcCustomId(customId)).toBeNull();
  });

  it("returns null for non-string input", () => {
    expect(parseAddPcCustomId(null)).toBeNull();
    expect(parseAddPcCustomId(undefined)).toBeNull();
    expect(parseAddPcCustomId(42)).toBeNull();
  });
});

describe("buildAddPcMessage", () => {
  const eventFixture = {
    event_id: 42,
    name: "Test Event",
    event_type: "Mission",
    tier: "5-7",
    status: "active",
  };

  it("returns one embed plus 2 components when no player is selected", () => {
    const result = buildAddPcMessage(eventFixture, [], [], null, []);
    expect(result.embeds).toHaveLength(1);
    expect(result.components).toHaveLength(2);
    const customIds = result.components.map((row) => row.components[0].data.custom_id);
    expect(customIds).toEqual([
      "event_add_pc_user:42:n0",
      "event_add_pc_done:42",
    ]);
  });

  it("returns one embed plus 3 components when a player is selected with available characters", () => {
    const availableChars = [
      { character_id: "111-1", character_index: 1, name: "Alice" },
      { character_id: "111-2", character_index: 2, name: "Bob" },
    ];
    const result = buildAddPcMessage(eventFixture, [], [], "111", availableChars);
    expect(result.embeds).toHaveLength(1);
    expect(result.components).toHaveLength(3);
    const customIds = result.components.map((row) => row.components[0].data.custom_id);
    expect(customIds).toEqual([
      "event_add_pc_user:42:n0",
      "event_add_pc_char:42:111",
      "event_add_pc_done:42",
    ]);
  });

  it("renders 'None' for empty participants", () => {
    const result = buildAddPcMessage(eventFixture, [], [], null, []);
    const fields = result.embeds[0].data.fields;
    expect(fields.find((f) => f.name.startsWith("Participants")).value).toBe("None");
  });

  it("renders bulleted 'Name (Lvl X)' for participants", () => {
    const participants = [
      { character_name: "Alice", starting_level: 5 },
      { character_name: "Bob", starting_level: 6 },
    ];
    const result = buildAddPcMessage(eventFixture, participants, [], null, []);
    const fields = result.embeds[0].data.fields;
    expect(fields.find((f) => f.name.startsWith("Participants")).value).toBe("• Alice (Lvl 5)\n• Bob (Lvl 6)");
  });

  it("varies UserSelect customId nonce by participant count", () => {
    const noPart = buildAddPcMessage(eventFixture, [], [], null, []);
    expect(noPart.components[0].components[0].data.custom_id).toBe("event_add_pc_user:42:n0");

    const twoPart = buildAddPcMessage(eventFixture, [
      { character_name: "Alice", starting_level: 5 },
      { character_name: "Bob", starting_level: 6 },
    ], [], null, []);
    expect(twoPart.components[0].components[0].data.custom_id).toBe("event_add_pc_user:42:n2");
  });

  it("populates StringSelect options from availableCharacters using character_index as value", () => {
    const availableChars = [
      { character_id: "111-1", character_index: 1, name: "Alice" },
      { character_id: "111-2", character_index: 2, name: "Bob" },
    ];
    const result = buildAddPcMessage(eventFixture, [], [], "111", availableChars);
    const charSelect = result.components[1].components[0];
    expect(charSelect.options.map((o) => o.data)).toEqual([
      { label: "Alice", value: "1" },
      { label: "Bob", value: "2" },
    ]);
  });

  it("renders event name in the title", () => {
    const result = buildAddPcMessage(eventFixture, [], [], null, []);
    expect(result.embeds[0].data.title).toBe("Add PCs to Test Event");
  });

  it("decorates death rows with 💀 (Death) in the main participants field", () => {
    const active = [
      { character_name: "Alice", starting_level: 5, removal_reason: null },
      { character_name: "Bob", starting_level: 7, removal_reason: "death" },
    ];
    const result = buildAddPcMessage(eventFixture, active, [], null, []);
    const fields = result.embeds[0].data.fields;
    const participantsField = fields.find((f) => f.name.startsWith("Participants"));
    expect(participantsField.value).toContain("Bob 💀 (Death)");
    expect(participantsField.value).toContain("Alice");
  });

  it("renders a conditional Dropped field when there are dropped participants", () => {
    const active = [{ character_name: "Alice", starting_level: 5, removal_reason: null }];
    const dropped = [{ character_name: "Cory", starting_level: 3, removal_reason: "dropped" }];
    const result = buildAddPcMessage(eventFixture, active, dropped, null, []);
    const fields = result.embeds[0].data.fields;
    const droppedField = fields.find((f) => f.name.startsWith("Dropped"));
    expect(droppedField).toBeDefined();
    expect(droppedField.name).toBe("Dropped (1)");
    expect(droppedField.value).toContain("Cory");
  });
});
