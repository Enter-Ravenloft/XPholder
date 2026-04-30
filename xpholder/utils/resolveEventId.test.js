import { describe, it, expect, vi } from "vitest";
import { resolveEventId } from "./resolveEventId.js";

const stubGs = (matches = []) => ({
  searchEventsExact: vi.fn().mockResolvedValue(matches),
});

describe("resolveEventId", () => {
  it("returns parsed id and skips lookup for a clean numeric string", async () => {
    const gs = stubGs();
    const result = await resolveEventId(gs, "42", "active");
    expect(result).toEqual({ eventId: 42, name: null, fromFallback: false });
    expect(gs.searchEventsExact).not.toHaveBeenCalled();
  });

  it("trims surrounding whitespace before parsing", async () => {
    const gs = stubGs();
    const result = await resolveEventId(gs, "  42  ", "active");
    expect(result).toEqual({ eventId: 42, name: null, fromFallback: false });
    expect(gs.searchEventsExact).not.toHaveBeenCalled();
  });

  it("rejects partial-numeric input and falls through to lookup", async () => {
    const gs = stubGs();
    const result = await resolveEventId(gs, "42 hello", "active");
    expect(result).toBeNull();
    expect(gs.searchEventsExact).toHaveBeenCalledWith("42 hello", "active");
  });

  it("returns null for empty string without calling lookup", async () => {
    const gs = stubGs();
    const result = await resolveEventId(gs, "", "active");
    expect(result).toBeNull();
    expect(gs.searchEventsExact).not.toHaveBeenCalled();
  });

  it("returns null for null/undefined input without calling lookup", async () => {
    const gs = stubGs();
    expect(await resolveEventId(gs, null, "active")).toBeNull();
    expect(await resolveEventId(gs, undefined, "active")).toBeNull();
    expect(gs.searchEventsExact).not.toHaveBeenCalled();
  });

  it("returns the matched event when fallback finds exactly one row", async () => {
    const gs = stubGs([{ event_id: 99, name: "My Event" }]);
    const result = await resolveEventId(gs, "My Event", "active");
    expect(result).toEqual({ eventId: 99, name: "My Event", fromFallback: true });
    expect(gs.searchEventsExact).toHaveBeenCalledWith("My Event", "active");
  });

  it("returns null when fallback finds multiple matches", async () => {
    const gs = stubGs([
      { event_id: 1, name: "Arena" },
      { event_id: 2, name: "Arena" },
    ]);
    const result = await resolveEventId(gs, "Arena", "active");
    expect(result).toBeNull();
  });

  it("returns null when fallback finds zero matches", async () => {
    const gs = stubGs([]);
    const result = await resolveEventId(gs, "No Such Event", "active");
    expect(result).toBeNull();
  });

  it("forwards statusFilter through to the lookup", async () => {
    const gs = stubGs();
    await resolveEventId(gs, "X", "completed");
    expect(gs.searchEventsExact).toHaveBeenCalledWith("X", "completed");
  });
});
