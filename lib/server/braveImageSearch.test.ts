/**
 * Unit tests for Brave image search: quality filter, portrait preservation, URL preference, ranking.
 * Run with: pnpm test (or npx vitest run lib/server/braveImageSearch.test.ts)
 */

import { describe, it, expect } from "vitest";
import {
  getMaxDimension,
  passesMinDimension,
  isLowQualityImageUrl,
  scoreCandidateForRanking,
} from "./braveImageSearch";

describe("braveImageSearch", () => {
  describe("getMaxDimension", () => {
    it("uses max of width and height so portrait (1600x2400) is judged by 2400", () => {
      expect(getMaxDimension(1600, 2400)).toBe(2400);
      expect(getMaxDimension(2400, 1600)).toBe(2400);
    });
    it("returns null when dimensions missing", () => {
      expect(getMaxDimension(null, 100)).toBe(null);
      expect(getMaxDimension(100, null)).toBe(null);
      expect(getMaxDimension(undefined, undefined)).toBe(null);
    });
  });

  describe("passesMinDimension", () => {
    it("rejects when max dimension below 1200", () => {
      expect(passesMinDimension(1199, 1200)).toBe(false);
      expect(passesMinDimension(800, 1200)).toBe(false);
    });
    it("accepts when max dimension >= minDim", () => {
      expect(passesMinDimension(1200, 1200)).toBe(true);
      expect(passesMinDimension(2400, 2400)).toBe(true);
      expect(passesMinDimension(1600, 1600)).toBe(true);
    });
    it("preserves vertical portrait: 1600x2400 passes MIN_DIM 2400 (max is 2400)", () => {
      const maxDim = getMaxDimension(1600, 2400);
      expect(maxDim).toBe(2400);
      expect(passesMinDimension(maxDim, 2400)).toBe(true);
    });
    it("keeps image when dimensions unknown (null)", () => {
      expect(passesMinDimension(null, 2400)).toBe(true);
    });
  });

  describe("isLowQualityImageUrl", () => {
    it("rejects URLs containing thumb, thumbnail, small, avatar, icon", () => {
      expect(isLowQualityImageUrl("https://example.com/thumb/foo.jpg")).toBe(true);
      expect(isLowQualityImageUrl("https://example.com/thumbnail.png")).toBe(true);
      expect(isLowQualityImageUrl("https://example.com/small.jpg")).toBe(true);
      expect(isLowQualityImageUrl("https://example.com/avatar.png")).toBe(true);
      expect(isLowQualityImageUrl("https://example.com/icon.gif")).toBe(true);
      expect(isLowQualityImageUrl("https://example.com/150x150/bar.jpg")).toBe(true);
      expect(isLowQualityImageUrl("https://example.com/300x200.jpg")).toBe(true);
      expect(isLowQualityImageUrl("https://example.com/lowres.png")).toBe(true);
    });
    it("accepts clean full-size-like URLs", () => {
      expect(isLowQualityImageUrl("https://commons.wikimedia.org/wiki/File:Photo.jpg")).toBe(false);
      expect(isLowQualityImageUrl("https://example.com/image.jpg")).toBe(false);
    });
  });

  describe("scoreCandidateForRanking", () => {
    it("prefers higher resolution (log2 max dimension)", () => {
      const low = scoreCandidateForRanking(1200, "example.com");
      const high = scoreCandidateForRanking(2400, "example.com");
      expect(high).toBeGreaterThan(low);
    });
    it("gives bonus for reputable domains (commons, nasa, etc.)", () => {
      const generic = scoreCandidateForRanking(2000, "random-site.com");
      const commons = scoreCandidateForRanking(2000, "commons.wikimedia.org");
      expect(commons).toBeGreaterThan(generic);
    });
    it("penalizes thehorrordome and wallpaper sites", () => {
      const generic = scoreCandidateForRanking(2000, "random-site.com");
      const thehorrordome = scoreCandidateForRanking(2000, "thehorrordome.com");
      expect(thehorrordome).toBeLessThan(generic);
    });
    it("ranking prefers higher-res and reputable over lower-res and penalty", () => {
      const highResReputable = scoreCandidateForRanking(2400, "commons.wikimedia.org");
      const lowResPenalty = scoreCandidateForRanking(1200, "thehorrordome.com");
      expect(highResReputable).toBeGreaterThan(lowResPenalty);
    });
  });
});
