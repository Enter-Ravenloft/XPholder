import { describe, it, expect, beforeEach, afterEach } from "vitest";
import format from "pg-format";
import {
  createTestGuildService,
  newPool,
  newGuildId,
} from "../../tests/integration/helpers.js";
import { guildService } from "./guild.js";
import config from "../config.json";

const { LEVELS } = config;

let ctx;

beforeEach(async () => {
  ctx = await createTestGuildService();
});

afterEach(async () => {
  if (ctx) {
    await ctx.cleanup();
    ctx = null;
  }
});

describe("init / schema setup", () => {
  it("registerServer creates all 10 tables and seeds levels from LEVELS", async () => {
    const { gService, db, schema } = ctx;
    const tablesRes = await db.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = $1 ORDER BY table_name;`,
      [schema]
    );
    const tableNames = tablesRes.rows.map((r) => r.table_name).sort();
    expect(tableNames).toEqual(
      [
        "channels",
        "character_tiers",
        "characters",
        "config",
        "event_dms",
        "event_participants",
        "events",
        "levels",
        "players",
        "roles",
      ].sort()
    );

    expect(Object.keys(gService.levels)).toHaveLength(Object.keys(LEVELS).length);
    expect(gService.levels[1]).toBe(LEVELS["1"]);
    expect(gService.levels[20]).toBe(LEVELS["20"]);
    expect(gService.registered).toBe(true);
    expect(gService.config["moderationRoleId"]).toBe("100");
  });

  it("init() returns early when the schema is unregistered", async () => {
    const pool = newPool();
    const db = { query: (...a) => pool.query(...a) };
    const gService = new guildService(db, newGuildId());
    try {
      await expect(gService.init()).resolves.toBeUndefined();
      expect(gService.registered).toBe(false);
      expect(gService.config).toBeUndefined();
      expect(gService.levels).toBeUndefined();
    } finally {
      await pool.end();
    }
  });
});

describe("config", () => {
  it("updateConfig persists each entry to the config table", async () => {
    const { gService, db, schema } = ctx;
    await gService.updateConfig({
      moderationRoleId: "999",
      approveLevel: 5,
    });

    const rows = await db.query(
      `SELECT name, value FROM ${format.ident(schema)}.config WHERE name IN ('moderationRoleId', 'approveLevel') ORDER BY name;`
    );
    const byName = Object.fromEntries(rows.rows.map((r) => [r.name, r.value]));
    expect(byName.moderationRoleId).toBe("999");
    expect(byName.approveLevel).toBe("5");
  });
});

describe("levels", () => {
  it("updateLevel rewrites xp_to_next and refreshes gService.levels", async () => {
    const { gService } = ctx;
    await gService.updateLevel(1, 12345);
    expect(gService.levels[1]).toBe(12345);

    const fresh = await ctx.db.query(
      `SELECT xp_to_next FROM ${format.ident(ctx.schema)}.levels WHERE level = 1;`
    );
    expect(fresh.rows[0].xp_to_next).toBe(12345);
  });
});

describe("roles", () => {
  it("updateRole inserts a new role when xpBonus >= 0 and role is unknown", async () => {
    const { gService, db, schema } = ctx;
    await gService.updateRole("role-A", 25);
    const rows = await db.query(
      `SELECT xp_bonus FROM ${format.ident(schema)}.roles WHERE role_id = $1;`,
      ["role-A"]
    );
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0].xp_bonus).toBe(25);
  });

  it("updateRole updates xp_bonus when the role already exists", async () => {
    const { gService, db, schema } = ctx;
    await gService.updateRole("role-A", 25);
    // Re-init refreshes the cache so the next updateRole takes the UPDATE branch
    // (`channelId in this.roles`). The update-path cache reload in the source
    // currently writes a sentinel rather than the full map, so we re-init here.
    await gService.init();
    await gService.updateRole("role-A", 50);

    const rows = await db.query(
      `SELECT xp_bonus FROM ${format.ident(schema)}.roles WHERE role_id = $1;`,
      ["role-A"]
    );
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0].xp_bonus).toBe(50);
  });

  it("updateRole deletes the role when xpBonus is negative", async () => {
    const { gService, db, schema } = ctx;
    await gService.updateRole("role-A", 5);
    await gService.init();
    await gService.updateRole("role-A", -1);
    const rows = await db.query(
      `SELECT 1 FROM ${format.ident(schema)}.roles WHERE role_id = $1;`,
      ["role-A"]
    );
    expect(rows.rows).toHaveLength(0);
  });
});

describe("channels", () => {
  it("updateChannel inserts a new channel when xpPerPost >= 0 and channel is unknown", async () => {
    const { gService, db, schema } = ctx;
    await gService.updateChannel("chan-A", 7);
    const rows = await db.query(
      `SELECT xp_per_post FROM ${format.ident(schema)}.channels WHERE channel_id = $1;`,
      ["chan-A"]
    );
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0].xp_per_post).toBe(7);
  });

  it("updateChannel updates xp_per_post when the channel already exists", async () => {
    const { gService, db, schema } = ctx;
    await gService.updateChannel("chan-A", 7);
    await gService.init();
    await gService.updateChannel("chan-A", 14);
    const rows = await db.query(
      `SELECT xp_per_post FROM ${format.ident(schema)}.channels WHERE channel_id = $1;`,
      ["chan-A"]
    );
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0].xp_per_post).toBe(14);
  });

  it("updateChannel deletes the channel when xpPerPost is negative", async () => {
    const { gService, db, schema } = ctx;
    await gService.updateChannel("chan-A", 7);
    await gService.init();
    await gService.updateChannel("chan-A", -1);
    const rows = await db.query(
      `SELECT 1 FROM ${format.ident(schema)}.channels WHERE channel_id = $1;`,
      ["chan-A"]
    );
    expect(rows.rows).toHaveLength(0);
  });
});

describe("characters", () => {
  const baseChar = (idx) => ({
    character_id: `p1-${idx}`,
    character_index: idx,
    name: `Char ${idx}`,
    sheet_url: `https://sheet/${idx}`,
    picture_url: `https://pic/${idx}`,
    player_id: "p1",
    xp: 100 * idx,
  });

  it("insertCharacter + getCharacter round-trips", async () => {
    const { gService } = ctx;
    await gService.insertCharacter(baseChar(1));
    const got = await gService.getCharacter("p1-1");
    expect(got).toMatchObject({
      character_id: "p1-1",
      character_index: 1,
      name: "Char 1",
      sheet_url: "https://sheet/1",
      picture_url: "https://pic/1",
      player_id: "p1",
      xp: 100,
    });
  });

  it("getCharacter returns null when not found", async () => {
    const { gService } = ctx;
    const got = await gService.getCharacter("nope");
    expect(got).toBeNull();
  });

  it("getAllCharacters filters by playerId and orders by character_index", async () => {
    const { gService } = ctx;
    await gService.insertCharacter(baseChar(2));
    await gService.insertCharacter(baseChar(1));
    await gService.insertCharacter({ ...baseChar(1), character_id: "p2-1", player_id: "p2" });
    const rows = await gService.getAllCharacters("p1");
    expect(rows.map((r) => r.character_index)).toEqual([1, 2]);
    expect(rows.every((r) => r.player_id === "p1")).toBe(true);
  });

  it("getAllGuildCharacters returns every character", async () => {
    const { gService } = ctx;
    await gService.insertCharacter(baseChar(1));
    await gService.insertCharacter({ ...baseChar(1), character_id: "p2-1", player_id: "p2" });
    const rows = await gService.getAllGuildCharacters();
    expect(rows.map((r) => r.character_id).sort()).toEqual(["p1-1", "p2-1"]);
  });

  it("updateCharacterInfo overwrites name/sheet_url/picture_url", async () => {
    const { gService } = ctx;
    await gService.insertCharacter(baseChar(1));
    await gService.updateCharacterInfo({
      character_id: "p1-1",
      name: "Renamed",
      sheet_url: "https://new/sheet",
      picture_url: "https://new/pic",
    });
    const got = await gService.getCharacter("p1-1");
    expect(got.name).toBe("Renamed");
    expect(got.sheet_url).toBe("https://new/sheet");
    expect(got.picture_url).toBe("https://new/pic");
    expect(got.xp).toBe(100); // unchanged
  });

  it("updateCharacterXP adds the delta to xp", async () => {
    const { gService } = ctx;
    await gService.insertCharacter(baseChar(1));
    await gService.updateCharacterXP({ character_id: "p1-1" }, 250);
    const got = await gService.getCharacter("p1-1");
    expect(got.xp).toBe(350);
  });

  it("setCharacterXP sets xp absolutely", async () => {
    const { gService } = ctx;
    await gService.insertCharacter(baseChar(1));
    await gService.setCharacterXP({ character_id: "p1-1", xp: 9999 });
    const got = await gService.getCharacter("p1-1");
    expect(got.xp).toBe(9999);
  });

  it("deleteCharacter removes the row", async () => {
    const { gService } = ctx;
    await gService.insertCharacter(baseChar(1));
    await gService.deleteCharacter({ character_id: "p1-1" });
    expect(await gService.getCharacter("p1-1")).toBeNull();
  });
});

describe("character_tiers", () => {
  it("updateCharacterTier inserts a new tier and refreshes the cache", async () => {
    const { gService } = ctx;
    await gService.updateCharacterTier("tier-role-A", 5, 1, 4);
    expect(gService.characterTiers).toHaveLength(1);
    expect(gService.characterTiers[0]).toMatchObject({
      role_id: "tier-role-A",
      minimum_level: 1,
      maximum_level: 4,
      xp_bonus: 5,
    });
  });

  it("updateCharacterTier updates an existing tier (xp_bonus + bounds)", async () => {
    const { gService } = ctx;
    await gService.updateCharacterTier("tier-role-A", 5, 1, 4);
    // Pass new min/max plus new bonus; the method preserves prior bounds when
    // overrides are 0/below the existing min, but here we explicitly widen.
    await gService.updateCharacterTier("tier-role-A", 7, 2, 10);
    expect(gService.characterTiers).toHaveLength(1);
    expect(gService.characterTiers[0]).toMatchObject({
      role_id: "tier-role-A",
      minimum_level: 2,
      maximum_level: 10,
      xp_bonus: 7,
    });
  });

  it("updateCharacterTier deletes the tier when xpBonus is negative", async () => {
    const { gService } = ctx;
    await gService.updateCharacterTier("tier-role-A", 5, 1, 4);
    await gService.updateCharacterTier("tier-role-A", -1);
    expect(gService.characterTiers).toEqual([]);
  });

  it("fetchCharacterTiers returns all rows", async () => {
    const { gService } = ctx;
    await gService.updateCharacterTier("tier-role-A", 5, 1, 4);
    await gService.updateCharacterTier("tier-role-B", 10, 5, 10);
    const tiers = await gService.fetchCharacterTiers();
    expect(tiers.map((t) => t.role_id).sort()).toEqual(["tier-role-A", "tier-role-B"]);
  });
});

describe("players", () => {
  it("upsertPlayer inserts a new player and getPlayer returns it", async () => {
    const { gService } = ctx;
    await gService.upsertPlayer("p1", "alice", "Alice", 0);
    const player = await gService.getPlayer("p1");
    expect(player).toMatchObject({
      player_id: "p1",
      username: "alice",
      display_name: "Alice",
      is_member: true,
      inactive_days: 0,
    });
    expect(player.last_seen).toBeInstanceOf(Date);
  });

  it("upsertPlayer overwrites username/display_name/is_member on conflict", async () => {
    const { gService } = ctx;
    await gService.upsertPlayer("p1", "alice", "Alice", 30);
    await gService.upsertPlayer("p1", "alice2", "Alice Two", 0);
    const player = await gService.getPlayer("p1");
    expect(player.username).toBe("alice2");
    expect(player.display_name).toBe("Alice Two");
    expect(player.is_member).toBe(true);
    expect(player.inactive_days).toBe(0);
  });

  it("markAbsentMembers flips is_member off for ids not in the present set", async () => {
    const { gService } = ctx;
    await gService.upsertPlayer("p1", "alice", "Alice", 0);
    await gService.upsertPlayer("p2", "bob", "Bob", 0);
    await gService.upsertPlayer("p3", "carol", "Carol", 0);
    await gService.markAbsentMembers(["p1", "p3"]);
    expect((await gService.getPlayer("p1")).is_member).toBe(true);
    expect((await gService.getPlayer("p2")).is_member).toBe(false);
    expect((await gService.getPlayer("p3")).is_member).toBe(true);
  });
});

describe("events", () => {
  async function makeEvent(overrides = {}) {
    const { gService } = ctx;
    return gService.createEvent(
      overrides.name || "Test Event",
      overrides.eventType || "session",
      overrides.tier || "1",
      overrides.startDate || "2026-01-01",
      overrides.dmUserId || "dm-1",
      overrides.dmUsername || "DM One"
    );
  }

  it("createEvent + getEvent round-trips and auto-adds the primary DM", async () => {
    const { gService } = ctx;
    const eventId = await makeEvent({ name: "Boss Fight" });
    const event = await gService.getEvent(eventId);
    expect(event).toMatchObject({
      event_id: eventId,
      name: "Boss Fight",
      event_type: "session",
      tier: "1",
      status: "active",
    });
    const dms = await gService.getEventDms(eventId);
    expect(dms).toHaveLength(1);
    expect(dms[0]).toMatchObject({ user_id: "dm-1", is_primary: true });
  });

  it("getEvent returns null for unknown event_id", async () => {
    const { gService } = ctx;
    expect(await gService.getEvent(99999)).toBeNull();
  });

  it("getEvents returns all events when no status filter is passed, newest first", async () => {
    const { gService } = ctx;
    const a = await makeEvent({ name: "A" });
    const b = await makeEvent({ name: "B" });
    const events = await gService.getEvents();
    const ids = events.map((e) => e.event_id);
    // Both present; newest (b) first by created_at DESC
    expect(ids[0]).toBe(b);
    expect(ids).toContain(a);
  });

  it("getEvents filters by status when one is passed", async () => {
    const { gService } = ctx;
    const a = await makeEvent({ name: "A" });
    const b = await makeEvent({ name: "B" });
    await gService.endEvent(a, "2026-02-01", 100, 50);
    const active = await gService.getEvents("active");
    expect(active.map((e) => e.event_id)).toEqual([b]);
    const completed = await gService.getEvents("completed");
    expect(completed.map((e) => e.event_id)).toEqual([a]);
  });

  it("endEvent flips status, sets end_date and rewards", async () => {
    const { gService } = ctx;
    const id = await makeEvent();
    await gService.endEvent(id, "2026-02-15", 200, 75);
    const event = await gService.getEvent(id);
    expect(event.status).toBe("completed");
    expect(event.xp_reward).toBe(200);
    expect(event.gp_reward).toBe(75);
    // end_date is a Date; assert by formatting
    expect(event.end_date.toISOString().slice(0, 10)).toBe("2026-02-15");
  });

  it("deleteEvent removes the row (and its participants/dms via cascade)", async () => {
    const { gService } = ctx;
    const id = await makeEvent();
    await gService.addEventParticipant(id, "char-1", "p1", "Char One", 1, 0);
    await gService.deleteEvent(id);
    expect(await gService.getEvent(id)).toBeNull();
    expect(await gService.getEventParticipants(id)).toEqual([]);
    expect(await gService.getEventDms(id)).toEqual([]);
  });

  it("searchEvents escapes literal %, _, and \\ in the search term", async () => {
    const { gService } = ctx;
    await makeEvent({ name: "abc%def" });
    await makeEvent({ name: "abc_def" });
    await makeEvent({ name: "abcXdef" }); // would match unescaped _ wildcard
    await makeEvent({ name: "abc\\def" });

    // Literal %: should match only "abc%def"
    const pctHits = await gService.searchEvents("abc%");
    expect(pctHits.map((e) => e.name)).toEqual(["abc%def"]);

    // Literal _: should match only "abc_def"
    const undHits = await gService.searchEvents("abc_");
    expect(undHits.map((e) => e.name)).toEqual(["abc_def"]);

    // Literal \: should match only "abc\def"
    const bsHits = await gService.searchEvents("abc\\");
    expect(bsHits.map((e) => e.name)).toEqual(["abc\\def"]);
  });

  it("searchEventsExact returns case-insensitive exact-name matches scoped to status", async () => {
    const { gService } = ctx;

    // create three events: two named "Arena" (one active, one completed), and "arena 2" (a near-match)
    const arenaActiveId = await gService.createEvent("Arena", "Mission", "5-7", "2026-01-01", "111", "dm-one");
    const arenaCompletedId = await gService.createEvent("Arena", "Mission", "5-7", "2026-01-02", "222", "dm-two");
    await gService.endEvent(arenaCompletedId, "2026-01-03");
    await gService.createEvent("arena 2", "Mission", "5-7", "2026-01-04", "333", "dm-three");

    const activeMatches = await gService.searchEventsExact("arena", "active");
    expect(activeMatches.map((r) => r.event_id)).toEqual([arenaActiveId]);

    const completedMatches = await gService.searchEventsExact("ARENA", "completed");
    expect(completedMatches.map((r) => r.event_id)).toEqual([arenaCompletedId]);

    // duplicate names within the same status should all return
    const dup1 = await gService.createEvent("Arena", "Mission", "5-7", "2026-01-05", "444", "dm-four");
    const allActive = await gService.searchEventsExact("arena", "active");
    expect(allActive.map((r) => r.event_id).sort()).toEqual([arenaActiveId, dup1].sort());

    // missing search returns empty
    const none = await gService.searchEventsExact("Nope", "active");
    expect(none).toEqual([]);
  });

  it("updateEvent applies whitelisted columns and silently ignores unknown ones", async () => {
    const { gService } = ctx;
    const id = await makeEvent({ name: "Original" });
    await gService.updateEvent(id, {
      name: "Renamed",
      xp_reward: 500,
      malicious_col: "DROP TABLE events;",
    });
    const event = await gService.getEvent(id);
    expect(event.name).toBe("Renamed");
    expect(event.xp_reward).toBe(500);
    // Other fields unchanged
    expect(event.event_type).toBe("session");
  });

  it("updateEvent is a no-op when no whitelisted column is supplied", async () => {
    const { gService } = ctx;
    const id = await makeEvent({ name: "Original" });
    await gService.updateEvent(id, { malicious_col: 1 });
    const event = await gService.getEvent(id);
    expect(event.name).toBe("Original");
  });

  describe("getActiveEventForCharacter", () => {
    it("returns the event row when the character is in an active event", async () => {
      const { gService } = ctx;
      const eventId = await makeEvent({ name: "Boss Fight", tier: "5-7" });
      await gService.addEventParticipant(eventId, "char-1", "p1", "Char One", 3, 0);

      const result = await gService.getActiveEventForCharacter("char-1");
      expect(result).toMatchObject({
        event_id: eventId,
        name: "Boss Fight",
        tier: "5-7",
      });
    });

    it("returns null when the character is not in any event", async () => {
      const { gService } = ctx;
      const result = await gService.getActiveEventForCharacter("nobody");
      expect(result).toBeNull();
    });

    it("returns null when the character is only in a completed event", async () => {
      const { gService } = ctx;
      const eventId = await makeEvent({ name: "Old Quest" });
      await gService.addEventParticipant(eventId, "char-2", "p1", "Char Two", 3, 0);
      await gService.endEvent(eventId, "2026-02-01", 100, 50);

      const result = await gService.getActiveEventForCharacter("char-2");
      expect(result).toBeNull();
    });
  });

  describe("role-play channel", () => {
    it("createEvent with channel id and name round-trips both", async () => {
      const { gService } = ctx;
      const eventId = await gService.createEvent(
        "Channel Test",
        "Mission",
        "5-7",
        "2026-05-10",
        "u1",
        "User1",
        "1234567890",
        "test-channel"
      );
      const event = await gService.getEvent(eventId);
      expect(event.role_play_channel_id).toBe("1234567890");
      expect(event.role_play_channel_name).toBe("test-channel");
    });

    it("createEvent without channel leaves both columns null", async () => {
      const { gService } = ctx;
      const eventId = await gService.createEvent(
        "No Channel",
        "Mission",
        "5-7",
        "2026-05-10",
        "u1",
        "User1"
      );
      const event = await gService.getEvent(eventId);
      expect(event.role_play_channel_id).toBeNull();
      expect(event.role_play_channel_name).toBeNull();
    });

    it("updateEvent updates both channel columns together", async () => {
      const { gService } = ctx;
      const eventId = await gService.createEvent(
        "Update Test",
        "Mission",
        "5-7",
        "2026-05-10",
        "u1",
        "User1"
      );
      await gService.updateEvent(eventId, {
        role_play_channel_id: "9999",
        role_play_channel_name: "renamed-channel",
      });
      const event = await gService.getEvent(eventId);
      expect(event.role_play_channel_id).toBe("9999");
      expect(event.role_play_channel_name).toBe("renamed-channel");
    });
  });

  describe("renameCharacterParticipations", () => {
    it("rewrites snapshots that match (character_id, oldName)", async () => {
      const { gService } = ctx;
      const eventId = await makeEvent({ name: "Quest A" });
      await gService.addEventParticipant(eventId, "char-1", "p1", "Foo", 3, 0);

      await gService.renameCharacterParticipations("char-1", "Foo", "Bar");

      const participants = await gService.getEventParticipants(eventId);
      expect(participants).toHaveLength(1);
      expect(participants[0].character_name).toBe("Bar");
    });

    it("doesn't touch rows whose character_name doesn't match oldName", async () => {
      const { gService } = ctx;
      const eventA = await makeEvent({ name: "Quest A" });
      const eventB = await makeEvent({ name: "Quest B" });
      // Same character_id, different snapshot names — e.g. a retired-then-recreated PC
      await gService.addEventParticipant(eventA, "char-1", "p1", "Foo", 3, 0);
      await gService.addEventParticipant(eventB, "char-1", "p1", "Baz", 3, 0);

      await gService.renameCharacterParticipations("char-1", "Foo", "Bar");

      const aParticipants = await gService.getEventParticipants(eventA);
      const bParticipants = await gService.getEventParticipants(eventB);
      expect(aParticipants[0].character_name).toBe("Bar");
      expect(bParticipants[0].character_name).toBe("Baz");
    });

    it("is a no-op for a character_id with zero participations", async () => {
      const { gService } = ctx;
      // No participants inserted; method should not throw.
      await expect(
        gService.renameCharacterParticipations("char-nobody", "Foo", "Bar")
      ).resolves.toBeUndefined();
    });
  });

  describe("removal_reason", () => {
    it("dropEventParticipant sets removal_reason='dropped'", async () => {
      const { gService } = ctx;
      const eventId = await makeEvent({ name: "Drop Test" });
      await gService.addEventParticipant(eventId, "p1-1", "p1", "PC One", 3, 0);
      await gService.dropEventParticipant(eventId, "p1-1");
      const all = await gService.getEventParticipants(eventId);
      expect(all).toHaveLength(1);
      expect(all[0].removal_reason).toBe("dropped");
    });

    it("markEventParticipantDeath sets removal_reason='death'", async () => {
      const { gService } = ctx;
      const eventId = await makeEvent({ name: "Death Test" });
      await gService.addEventParticipant(eventId, "p1-1", "p1", "PC One", 3, 0);
      await gService.markEventParticipantDeath(eventId, "p1-1");
      const all = await gService.getEventParticipants(eventId);
      expect(all[0].removal_reason).toBe("death");
    });

    it("removeEventParticipant still DELETEs the row (regression)", async () => {
      const { gService } = ctx;
      const eventId = await makeEvent({ name: "Remove Test" });
      await gService.addEventParticipant(eventId, "p1-1", "p1", "PC One", 3, 0);
      await gService.removeEventParticipant(eventId, "p1-1");
      const all = await gService.getEventParticipants(eventId);
      expect(all).toHaveLength(0);
    });

    it("getActiveEventParticipants includes active and death, excludes dropped", async () => {
      const { gService } = ctx;
      const eventId = await makeEvent({ name: "Active Filter Test" });
      await gService.addEventParticipant(eventId, "p1-1", "p1", "Active PC", 3, 0);
      await gService.addEventParticipant(eventId, "p1-2", "p1", "Dropped PC", 3, 0);
      await gService.addEventParticipant(eventId, "p1-3", "p1", "Dead PC", 3, 0);
      await gService.dropEventParticipant(eventId, "p1-2");
      await gService.markEventParticipantDeath(eventId, "p1-3");

      const active = await gService.getActiveEventParticipants(eventId);
      const names = active.map((p) => p.character_name).sort();
      expect(names).toEqual(["Active PC", "Dead PC"]);
    });

    it("getDroppedEventParticipants returns only dropped rows", async () => {
      const { gService } = ctx;
      const eventId = await makeEvent({ name: "Dropped Filter Test" });
      await gService.addEventParticipant(eventId, "p1-1", "p1", "Active PC", 3, 0);
      await gService.addEventParticipant(eventId, "p1-2", "p1", "Dropped PC", 3, 0);
      await gService.dropEventParticipant(eventId, "p1-2");

      const dropped = await gService.getDroppedEventParticipants(eventId);
      expect(dropped).toHaveLength(1);
      expect(dropped[0].character_name).toBe("Dropped PC");
    });

    it("retarget: drop then death moves back into active (last-write-wins)", async () => {
      const { gService } = ctx;
      const eventId = await makeEvent({ name: "Retarget Test" });
      await gService.addEventParticipant(eventId, "p1-1", "p1", "PC One", 3, 0);
      await gService.dropEventParticipant(eventId, "p1-1");

      let active = await gService.getActiveEventParticipants(eventId);
      expect(active).toHaveLength(0);

      await gService.markEventParticipantDeath(eventId, "p1-1");
      active = await gService.getActiveEventParticipants(eventId);
      expect(active).toHaveLength(1);
      expect(active[0].removal_reason).toBe("death");
    });

    it("removeEventParticipant DELETEs a dropped row entirely", async () => {
      const { gService } = ctx;
      const eventId = await makeEvent({ name: "Remove After Drop Test" });
      await gService.addEventParticipant(eventId, "p1-1", "p1", "PC One", 3, 0);
      await gService.dropEventParticipant(eventId, "p1-1");
      await gService.removeEventParticipant(eventId, "p1-1");

      const all = await gService.getEventParticipants(eventId);
      expect(all).toHaveLength(0);
    });
  });
});

describe("event_participants", () => {
  async function makeEvent() {
    const { gService } = ctx;
    return gService.createEvent("Event", "session", "1", "2026-01-01", "dm-1", "DM One");
  }

  it("addEventParticipant + getEventParticipants round-trips", async () => {
    const { gService } = ctx;
    const eventId = await makeEvent();
    await gService.addEventParticipant(eventId, "char-1", "p1", "Char One", 3, 1500);
    const rows = await gService.getEventParticipants(eventId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      event_id: eventId,
      character_id: "char-1",
      player_id: "p1",
      character_name: "Char One",
      starting_level: 3,
      starting_xp: 1500,
    });
  });

  it("removeEventParticipant removes only the matching (event, character) pair", async () => {
    const { gService } = ctx;
    const eventId = await makeEvent();
    await gService.addEventParticipant(eventId, "char-1", "p1", "Char One", 1, 0);
    await gService.addEventParticipant(eventId, "char-2", "p2", "Char Two", 1, 0);
    const removed = await gService.removeEventParticipant(eventId, "char-1");
    expect(removed.character_id).toBe("char-1");
    const remaining = await gService.getEventParticipants(eventId);
    expect(remaining.map((r) => r.character_id)).toEqual(["char-2"]);
  });

  it("removeEventParticipant returns null when there is no match", async () => {
    const { gService } = ctx;
    const eventId = await makeEvent();
    const result = await gService.removeEventParticipant(eventId, "no-such");
    expect(result).toBeNull();
  });
});

describe("event_dms", () => {
  async function makeEvent() {
    const { gService } = ctx;
    return gService.createEvent("Event", "session", "1", "2026-01-01", "dm-1", "DM One");
  }

  it("addEventDm + getEventDms returns the new DM and orders primary first", async () => {
    const { gService } = ctx;
    const eventId = await makeEvent();
    await gService.addEventDm(eventId, "dm-2", "DM Two", false);
    const dms = await gService.getEventDms(eventId);
    expect(dms.map((d) => d.user_id)).toEqual(["dm-1", "dm-2"]);
    expect(dms[0].is_primary).toBe(true);
    expect(dms[1].is_primary).toBe(false);
  });

  it("removeEventDm deletes by (event, user) and returns the removed row", async () => {
    const { gService } = ctx;
    const eventId = await makeEvent();
    await gService.addEventDm(eventId, "dm-2", "DM Two", false);
    const removed = await gService.removeEventDm(eventId, "dm-2");
    expect(removed.user_id).toBe("dm-2");
    const dms = await gService.getEventDms(eventId);
    expect(dms.map((d) => d.user_id)).toEqual(["dm-1"]);
  });

  it("removeEventDm returns null when no DM matches", async () => {
    const { gService } = ctx;
    const eventId = await makeEvent();
    const result = await gService.removeEventDm(eventId, "nobody");
    expect(result).toBeNull();
  });

  it("setPrimaryDm resets is_primary on every other DM for the event and upserts the target", async () => {
    const { gService } = ctx;
    const eventId = await makeEvent();
    await gService.addEventDm(eventId, "dm-2", "DM Two", false);
    await gService.setPrimaryDm(eventId, "dm-2", "DM Two Renamed");

    const dms = await gService.getEventDms(eventId);
    const byUser = Object.fromEntries(dms.map((d) => [d.user_id, d]));
    expect(byUser["dm-1"].is_primary).toBe(false);
    expect(byUser["dm-2"].is_primary).toBe(true);
    expect(byUser["dm-2"].username).toBe("DM Two Renamed");
  });

  it("setPrimaryDm inserts the target if they were not already a DM", async () => {
    const { gService } = ctx;
    const eventId = await makeEvent();
    await gService.setPrimaryDm(eventId, "dm-3", "DM Three");

    const dms = await gService.getEventDms(eventId);
    const byUser = Object.fromEntries(dms.map((d) => [d.user_id, d]));
    expect(byUser["dm-1"].is_primary).toBe(false);
    expect(byUser["dm-3"]).toMatchObject({ is_primary: true, username: "DM Three" });
  });
});
