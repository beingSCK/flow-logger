/**
 * Represents a single working session extracted from a work journal.
 */
export interface Session {
  /** Date in YYYY-MM-DD format */
  date: string;
  /** Session number (1, 2, 3...) */
  sessionNumber: number;
  /** Project name extracted from main heading, or "General" */
  project: string;
  /** Session focus/theme from the session heading */
  theme: string;
  /** Start time if annotated with session-time comment */
  startTime?: Date;
  /** End time if annotated with session-time comment */
  endTime?: Date;
  /** Timezone for the session, defaults to America/Los_Angeles */
  timezone: string;
  /** How timing was determined (annotation, commits, or inferred) */
  timingSource: "annotation" | "commits" | "inferred";
  /** Commit hashes found in the session content */
  commits: string[];
  /** Items from "What I Worked On" section */
  outcomes: string[];
  /** Items from "Learnings" section */
  learnings: string[];
  /** Path to the source markdown file */
  sourceFile: string;
}

/**
 * Google Calendar event format for flow sessions.
 * Structure matches Google Calendar API expectations.
 */
export interface FlowCalendarEvent {
  /** Event title: "Flow: [Project] - [Theme]" */
  summary: string;
  /** Start time in Google Calendar format */
  start: { dateTime: string; timeZone: string };
  /** End time in Google Calendar format */
  end: { dateTime: string; timeZone: string };
  /** Google Calendar color ID */
  colorId: string;
  /** Formatted session summary for event description */
  description: string;
}

/** Default timezone for sessions without explicit timezone */
export const DEFAULT_TIMEZONE = "America/Los_Angeles";
