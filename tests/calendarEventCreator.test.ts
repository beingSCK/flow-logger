import { describe, it, expect } from "bun:test";
import {
  sessionToCalendarEvent,
  sessionsToCalendarEvents,
  FLOW_COLOR_ID,
  calculateDuration,
  getEventSummary,
} from "../src/calendarEventCreator";
import type { Session } from "../src/types";

describe("calendarEventCreator", () => {
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

  describe("sessionToCalendarEvent", () => {
    it("should convert session with timing to calendar event", () => {
      const session = makeSession({
        startTime: new Date("2026-01-15T10:30:00"),
        endTime: new Date("2026-01-15T12:00:00"),
      });

      const event = sessionToCalendarEvent(session);

      expect(event).not.toBeNull();
      expect(event!.summary).toBe("Flow: Test Project - Test Theme");
      expect(event!.colorId).toBe(FLOW_COLOR_ID);
      expect(event!.start.timeZone).toBe("America/Los_Angeles");
      expect(event!.end.timeZone).toBe("America/Los_Angeles");
    });

    it("should return null for session without timing", () => {
      const session = makeSession();
      const event = sessionToCalendarEvent(session);

      expect(event).toBeNull();
    });

    it("should handle session with no theme", () => {
      const session = makeSession({
        theme: "(no theme)",
        startTime: new Date("2026-01-15T10:30:00"),
        endTime: new Date("2026-01-15T12:00:00"),
      });

      const event = sessionToCalendarEvent(session);

      expect(event).not.toBeNull();
      expect(event!.summary).toBe("Flow: Test Project - Session 1");
    });

    it("should include outcomes in description", () => {
      const session = makeSession({
        startTime: new Date("2026-01-15T10:30:00"),
        endTime: new Date("2026-01-15T12:00:00"),
        outcomes: ["Built feature", "Fixed bug"],
      });

      const event = sessionToCalendarEvent(session);

      expect(event).not.toBeNull();
      expect(event!.description).toContain("**Outcomes:**");
      expect(event!.description).toContain("Built feature");
      expect(event!.description).toContain("Fixed bug");
    });

    it("should include commits in description", () => {
      const session = makeSession({
        startTime: new Date("2026-01-15T10:30:00"),
        endTime: new Date("2026-01-15T12:00:00"),
        commits: ["abc1234", "def5678"],
      });

      const event = sessionToCalendarEvent(session);

      expect(event).not.toBeNull();
      expect(event!.description).toContain("**Commits:**");
      expect(event!.description).toContain("abc1234, def5678");
    });
  });

  describe("sessionsToCalendarEvents", () => {
    it("should convert multiple sessions", () => {
      const sessions = [
        makeSession({
          sessionNumber: 1,
          startTime: new Date("2026-01-15T10:30:00"),
          endTime: new Date("2026-01-15T12:00:00"),
        }),
        makeSession({
          sessionNumber: 2,
          startTime: new Date("2026-01-15T14:00:00"),
          endTime: new Date("2026-01-15T16:00:00"),
        }),
      ];

      const { events, skipped } = sessionsToCalendarEvents(sessions);

      expect(events.length).toBe(2);
      expect(skipped.length).toBe(0);
    });

    it("should skip sessions without timing", () => {
      const sessions = [
        makeSession({
          sessionNumber: 1,
          startTime: new Date("2026-01-15T10:30:00"),
          endTime: new Date("2026-01-15T12:00:00"),
        }),
        makeSession({ sessionNumber: 2 }), // No timing
      ];

      const { events, skipped } = sessionsToCalendarEvents(sessions);

      expect(events.length).toBe(1);
      expect(skipped.length).toBe(1);
    });
  });

  describe("calculateDuration", () => {
    it("should calculate duration in minutes", () => {
      const session = makeSession({
        startTime: new Date("2026-01-15T10:00:00"),
        endTime: new Date("2026-01-15T12:30:00"),
      });

      const duration = calculateDuration(session);

      expect(duration).toBe(150); // 2.5 hours = 150 minutes
    });

    it("should return null for session without timing", () => {
      const session = makeSession();
      const duration = calculateDuration(session);

      expect(duration).toBeNull();
    });
  });

  describe("getEventSummary", () => {
    it("should generate readable summary", () => {
      const session = makeSession({
        startTime: new Date("2026-01-15T10:30:00"),
        endTime: new Date("2026-01-15T12:00:00"),
      });
      const event = sessionToCalendarEvent(session)!;

      const summary = getEventSummary([event]);

      expect(summary).toContain("1 event(s) to create");
      expect(summary).toContain("Flow: Test Project - Test Theme");
    });

    it("should handle empty event list", () => {
      const summary = getEventSummary([]);

      expect(summary).toBe("No events to create.");
    });
  });
});
