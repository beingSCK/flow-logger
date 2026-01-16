/**
 * Calendar Event Creator - Convert Sessions to FlowCalendarEvents
 */

import type { Session, FlowCalendarEvent } from "./types";

/**
 * Google Calendar color IDs
 * 1=Lavender, 2=Sage, 3=Grape, 4=Flamingo, 5=Banana,
 * 6=Tangerine, 7=Peacock, 8=Graphite, 9=Blueberry, 10=Basil, 11=Tomato
 */
export const FLOW_COLOR_ID = "5"; // Banana/Yellow - for "flow" events

/**
 * Convert a Session to a FlowCalendarEvent.
 * Returns null if the session doesn't have timing info.
 */
export function sessionToCalendarEvent(session: Session): FlowCalendarEvent | null {
  if (!session.startTime || !session.endTime) {
    return null;
  }

  const summary = formatSummary(session);
  const description = formatDescription(session);

  return {
    summary,
    start: {
      dateTime: session.startTime.toISOString(),
      timeZone: session.timezone,
    },
    end: {
      dateTime: session.endTime.toISOString(),
      timeZone: session.timezone,
    },
    colorId: FLOW_COLOR_ID,
    description,
  };
}

/**
 * Convert multiple Sessions to FlowCalendarEvents.
 * Skips sessions without timing info.
 */
export function sessionsToCalendarEvents(sessions: Session[]): {
  events: FlowCalendarEvent[];
  skipped: Session[];
} {
  const events: FlowCalendarEvent[] = [];
  const skipped: Session[] = [];

  for (const session of sessions) {
    const event = sessionToCalendarEvent(session);
    if (event) {
      events.push(event);
    } else {
      skipped.push(session);
    }
  }

  return { events, skipped };
}

/**
 * Format event summary: "Flow: [Project] - [Theme]"
 */
function formatSummary(session: Session): string {
  const theme = session.theme !== "(no theme)" ? session.theme : `Session ${session.sessionNumber}`;
  return `Flow: ${session.project} - ${theme}`;
}

/**
 * Format event description with session details.
 */
function formatDescription(session: Session): string {
  const lines: string[] = [];

  // Outcomes summary
  if (session.outcomes.length > 0) {
    lines.push("**Outcomes:**");
    for (const outcome of session.outcomes.slice(0, 5)) {
      lines.push(`- ${outcome}`);
    }
    if (session.outcomes.length > 5) {
      lines.push(`- ... and ${session.outcomes.length - 5} more`);
    }
    lines.push("");
  }

  // Learnings summary
  if (session.learnings.length > 0) {
    lines.push("**Learnings:**");
    for (const learning of session.learnings.slice(0, 3)) {
      lines.push(`- ${learning}`);
    }
    if (session.learnings.length > 3) {
      lines.push(`- ... and ${session.learnings.length - 3} more`);
    }
    lines.push("");
  }

  // Commits
  if (session.commits.length > 0) {
    lines.push(`**Commits:** ${session.commits.join(", ")}`);
    lines.push("");
  }

  // Source reference
  lines.push(`_Source: ${session.sourceFile}_`);

  return lines.join("\n");
}

/**
 * Calculate duration in minutes.
 */
export function calculateDuration(session: Session): number | null {
  if (!session.startTime || !session.endTime) {
    return null;
  }

  const diffMs = session.endTime.getTime() - session.startTime.getTime();
  return Math.round(diffMs / (1000 * 60));
}

/**
 * Get a summary of events to be created.
 */
export function getEventSummary(events: FlowCalendarEvent[]): string {
  if (events.length === 0) {
    return "No events to create.";
  }

  const lines: string[] = [];
  lines.push(`${events.length} event(s) to create:\n`);

  for (const event of events) {
    const start = new Date(event.start.dateTime);
    const end = new Date(event.end.dateTime);
    const duration = Math.round((end.getTime() - start.getTime()) / (1000 * 60));
    const dateStr = start.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    const timeStr = `${start.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })}-${end.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })}`;

    lines.push(`  ${dateStr} ${timeStr} (${duration}m): ${event.summary}`);
  }

  return lines.join("\n");
}
