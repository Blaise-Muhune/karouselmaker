import { describe, expect, it } from "vitest";
import {
  parseRequestedImageSlotCountFromNotes,
  resolveDesiredImageSlots,
} from "./resolveImageSlotCount";

describe("parseRequestedImageSlotCountFromNotes", () => {
  it("returns null when notes omit image count", () => {
    expect(parseRequestedImageSlotCountFromNotes(undefined)).toBeNull();
    expect(parseRequestedImageSlotCountFromNotes("focus on beginners")).toBeNull();
  });

  it("parses explicit counts", () => {
    expect(parseRequestedImageSlotCountFromNotes("use 3 images per slide")).toBe(3);
    expect(parseRequestedImageSlotCountFromNotes("4 photos")).toBe(4);
    expect(parseRequestedImageSlotCountFromNotes("2 pics on each slide")).toBe(2);
  });

  it("caps at 4", () => {
    expect(parseRequestedImageSlotCountFromNotes("8 images")).toBe(4);
  });

  it("parses at-least / or-more", () => {
    expect(parseRequestedImageSlotCountFromNotes("at least 3 images")).toBe(3);
    expect(parseRequestedImageSlotCountFromNotes("2 images or more")).toBe(2);
  });

  it("treats qualitative multi as 2", () => {
    expect(parseRequestedImageSlotCountFromNotes("make a collage")).toBe(2);
    expect(parseRequestedImageSlotCountFromNotes("multiple images ok")).toBe(2);
  });
});

describe("resolveDesiredImageSlots", () => {
  it("defaults to 1", () => {
    expect(resolveDesiredImageSlots(1)).toBe(1);
    expect(resolveDesiredImageSlots(0)).toBe(1);
  });

  it("allows 2 for comparison queries without notes", () => {
    expect(resolveDesiredImageSlots(2)).toBe(2);
    expect(resolveDesiredImageSlots(4)).toBe(2);
  });

  it("honors notes for 2+", () => {
    expect(resolveDesiredImageSlots(1, "3 images please")).toBe(3);
    expect(resolveDesiredImageSlots(4, "use 4 photos")).toBe(4);
    expect(resolveDesiredImageSlots(1, "collage style")).toBe(2);
  });
});
