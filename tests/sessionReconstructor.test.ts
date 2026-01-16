import { describe, it, expect } from "bun:test";
import {
  reconstructSessionTiming,
  hasTimingInfo,
  getTimingSource,
} from "../src/sessionReconstructor";
import type { Session } from "../src/types";

describe("sessionReconstructor", () => {
  const makeSession = (overrides: Partial<Session> = {}): Session => ({
    date: "2026-01-15",
    sessionNumber: 1,
    project: "Test Project",
    theme: "Test Theme",
    timezone: "America/Los_Angeles",
    commits: [],
    outcomes: ["Did stuff"],
    learnings: [],
    sourceFile: "/test/2026-01-15.md",
    ...overrides,
  });

  describe("reconstructSessionTiming", () => {
    it("should preserve existing timing annotations", () => {
      const startTime = new Date("2026-01-15T10:30:00");
      const endTime = new Date("2026-01-15T12:00:00");

      const session = makeSession({ startTime, endTime });
      const result = reconstructSessionTiming(session);

      expect(result.startTime).toEqual(startTime);
      expect(result.endTime).toEqual(endTime);
    });

    it("should return unchanged session when no commits and no timing", () => {
      const session = makeSession();
      const result = reconstructSessionTiming(session);

      expect(result.startTime).toBeUndefined();
      expect(result.endTime).toBeUndefined();
    });

    it("should handle sessions with commits but non-existent repo", () => {
      const session = makeSession({
        commits: ["abc1234"],
      });
      const result = reconstructSessionTiming(session, {
        repoPath: "/nonexistent/repo",
      });

      // Should return unchanged since repo doesn't exist
      expect(result.startTime).toBeUndefined();
      expect(result.endTime).toBeUndefined();
    });
  });

  describe("hasTimingInfo", () => {
    it("should return true when both start and end times exist", () => {
      const session = makeSession({
        startTime: new Date("2026-01-15T10:00:00"),
        endTime: new Date("2026-01-15T12:00:00"),
      });

      expect(hasTimingInfo(session)).toBe(true);
    });

    it("should return false when times are missing", () => {
      const session = makeSession();
      expect(hasTimingInfo(session)).toBe(false);
    });

    it("should return false when only start time exists", () => {
      const session = makeSession({
        startTime: new Date("2026-01-15T10:00:00"),
      });
      expect(hasTimingInfo(session)).toBe(false);
    });
  });

  describe("getTimingSource", () => {
    it("should return 'annotation' for times with zero seconds", () => {
      const session = makeSession({
        startTime: new Date("2026-01-15T10:30:00"),
        endTime: new Date("2026-01-15T12:00:00"),
      });

      expect(getTimingSource(session)).toBe("annotation");
    });

    it("should return 'commits' for times with non-zero seconds", () => {
      const session = makeSession({
        startTime: new Date("2026-01-15T10:30:45"),
        endTime: new Date("2026-01-15T12:15:23"),
      });

      expect(getTimingSource(session)).toBe("commits");
    });

    it("should return 'none' when no timing info", () => {
      const session = makeSession();
      expect(getTimingSource(session)).toBe("none");
    });
  });
});
