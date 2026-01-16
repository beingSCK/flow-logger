/**
 * Calendar Service - Google Calendar API integration for flow-logger
 *
 * Adapted from calendar-automaton's calendarService.ts
 * Uses file-based tokens from cli-tokens.json
 */

import type { FlowCalendarEvent } from "./types";

const CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";

/** Token getter function type */
export type TokenGetter = () => Promise<string>;

/**
 * Fetch upcoming events from the primary calendar.
 * Used for deduplication - checking if flow events already exist.
 */
export async function fetchEvents(
  daysBack: number,
  daysForward: number,
  getToken: TokenGetter
): Promise<FlowCalendarEvent[]> {
  const token = await getToken();

  const now = new Date();
  const timeMin = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000).toISOString();
  const timeMax = new Date(now.getTime() + daysForward * 24 * 60 * 60 * 1000).toISOString();

  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "500",
    fields: "items(id,summary,start,end,colorId,description)",
  });

  const response = await fetch(`${CALENDAR_API_BASE}/calendars/primary/events?${params}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Calendar API error (${response.status}): ${error}`);
  }

  const data = await response.json();
  return (data.items || []) as FlowCalendarEvent[];
}

/**
 * Insert a flow event into the calendar.
 */
export async function insertFlowEvent(
  event: FlowCalendarEvent,
  getToken: TokenGetter
): Promise<FlowCalendarEvent> {
  const token = await getToken();

  const response = await fetch(`${CALENDAR_API_BASE}/calendars/primary/events`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(event),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to insert event (${response.status}): ${error}`);
  }

  return (await response.json()) as FlowCalendarEvent;
}

/**
 * Insert multiple flow events.
 * Returns the count of successfully created events.
 */
export async function insertFlowEvents(
  events: FlowCalendarEvent[],
  getToken: TokenGetter
): Promise<{ success: number; failed: number; errors: string[] }> {
  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const event of events) {
    try {
      await insertFlowEvent(event, getToken);
      success++;
    } catch (error) {
      failed++;
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${event.summary}: ${message}`);
      console.error("Failed to insert event:", event.summary, error);
    }
  }

  return { success, failed, errors };
}

/**
 * Check if a flow event already exists in the calendar.
 * Matches by summary prefix and start time.
 */
export function findExistingEvent(
  event: FlowCalendarEvent,
  existingEvents: FlowCalendarEvent[]
): FlowCalendarEvent | undefined {
  return existingEvents.find((existing) => {
    // Match by summary (flow events have predictable naming)
    if (existing.summary !== event.summary) return false;

    // Match by start time
    const existingStart = existing.start?.dateTime;
    const eventStart = event.start?.dateTime;
    if (!existingStart || !eventStart) return false;

    // Compare start times (ignoring minor differences)
    const existingDate = new Date(existingStart);
    const eventDate = new Date(eventStart);
    const diffMs = Math.abs(existingDate.getTime() - eventDate.getTime());

    // Allow 1 minute tolerance for timing differences
    return diffMs < 60 * 1000;
  });
}

/**
 * Filter out events that already exist in the calendar.
 */
export function filterDuplicates(
  newEvents: FlowCalendarEvent[],
  existingEvents: FlowCalendarEvent[]
): { toCreate: FlowCalendarEvent[]; duplicates: FlowCalendarEvent[] } {
  const toCreate: FlowCalendarEvent[] = [];
  const duplicates: FlowCalendarEvent[] = [];

  for (const event of newEvents) {
    if (findExistingEvent(event, existingEvents)) {
      duplicates.push(event);
    } else {
      toCreate.push(event);
    }
  }

  return { toCreate, duplicates };
}
