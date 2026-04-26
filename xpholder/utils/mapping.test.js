import { describe, it, expect } from "vitest";
import {
  mergeListOfObjects,
  chunkArray,
  splitObjectToList,
  listOfObjsToObj,
} from "./mapping.js";

describe("mergeListOfObjects", () => {
  it("returns an empty object for an empty list", () => {
    expect(mergeListOfObjects([])).toEqual({});
  });

  it("returns a single object's contents unchanged", () => {
    expect(mergeListOfObjects([{ a: 1, b: 2 }])).toEqual({ a: 1, b: 2 });
  });

  it("merges keys from multiple objects", () => {
    expect(mergeListOfObjects([{ a: 1 }, { b: 2 }, { c: 3 }])).toEqual({ a: 1, b: 2, c: 3 });
  });

  it("later objects overwrite earlier ones on key collision", () => {
    expect(mergeListOfObjects([{ a: 1 }, { a: 2 }])).toEqual({ a: 2 });
  });
});

describe("chunkArray", () => {
  it("returns an empty array when input is empty", () => {
    expect(chunkArray([], 3)).toEqual([]);
  });

  it("partitions evenly when length is a multiple of chunkSize", () => {
    expect(chunkArray([1, 2, 3, 4, 5, 6], 3)).toEqual([[1, 2, 3], [4, 5, 6]]);
  });

  it("includes a final short chunk when length is not a multiple", () => {
    expect(chunkArray([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("returns a single full-length chunk when chunkSize exceeds length", () => {
    expect(chunkArray([1, 2], 5)).toEqual([[1, 2]]);
  });

  it("works with chunkSize of 1", () => {
    expect(chunkArray([1, 2, 3], 1)).toEqual([[1], [2], [3]]);
  });
});

describe("splitObjectToList", () => {
  it("returns an empty list for an empty object", () => {
    expect(splitObjectToList({})).toEqual([]);
  });

  it("converts each entry into its own one-key object", () => {
    expect(splitObjectToList({ a: 1, b: 2 })).toEqual([{ a: 1 }, { b: 2 }]);
  });
});

describe("listOfObjsToObj", () => {
  it("returns an empty object for an empty list", () => {
    expect(listOfObjsToObj([], "k", "v")).toEqual({});
  });

  it("indexes the list into a map keyed by `key`, valued by `value`", () => {
    const rows = [
      { name: "alice", age: 30 },
      { name: "bob", age: 40 },
    ];
    expect(listOfObjsToObj(rows, "name", "age")).toEqual({ alice: 30, bob: 40 });
  });

  it("later entries with a duplicate key overwrite earlier ones", () => {
    const rows = [
      { k: "a", v: 1 },
      { k: "a", v: 2 },
    ];
    expect(listOfObjsToObj(rows, "k", "v")).toEqual({ a: 2 });
  });
});
