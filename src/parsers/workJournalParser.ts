import { readFileSync } from "fs";
import { basename } from "path";
import { Session, DEFAULT_TIMEZONE } from "../types";

/**
 * Parse a work journal markdown file and extract session data.
 *
 * @param filePath - Path to the markdown journal file
 * @returns Array of Session objects, one per session in the file
 */
export function parseJournalFile(filePath: string): Session[] {
  const content = readFileSync(filePath, "utf-8");
  const filename = basename(filePath);

  // Extract date from filename (expects YYYY-MM-DD.md format)
  const dateMatch = filename.match(/^(\d{4}-\d{2}-\d{2})\.md$/);
  const date = dateMatch ? dateMatch[1] : extractDateFromContent(content);

  // Extract project from main heading: # YYYY-MM-DD: Project - Details
  const project = extractProjectFromHeading(content);

  // Split content into sessions
  const sessions = splitIntoSessions(content);

  return sessions.map((sessionContent, index) => {
    const sessionNumber = extractSessionNumber(sessionContent) ?? (index + 1);
    const theme = extractTheme(sessionContent);
    const { startTime, endTime } = extractTimeAnnotation(sessionContent, date);
    const commits = extractCommits(sessionContent);
    const outcomes = extractOutcomes(sessionContent);
    const learnings = extractLearnings(sessionContent);

    // Set timing source based on whether annotation was found
    const timingSource = (startTime && endTime) ? "annotation" : "inferred";

    return {
      date,
      sessionNumber,
      project,
      theme,
      startTime,
      endTime,
      timezone: DEFAULT_TIMEZONE,
      timingSource,
      commits,
      outcomes,
      learnings,
      sourceFile: filePath,
    };
  });
}

/**
 * Extract date from the main heading if not in filename.
 */
function extractDateFromContent(content: string): string {
  const match = content.match(/^#\s+(\d{4}-\d{2}-\d{2})/m);
  return match ? match[1] : "unknown";
}

/**
 * Extract project name from main heading.
 * Format: # YYYY-MM-DD: Project - Details or # YYYY-MM-DD: Project
 */
function extractProjectFromHeading(content: string): string {
  // Match: # 2026-01-15: Calendar Automaton - TypeScript Fixes
  const match = content.match(/^#\s+\d{4}-\d{2}-\d{2}:\s*([^-\n]+)/m);
  if (match) {
    return match[1].trim();
  }
  return "General";
}

/**
 * Split content into individual session blocks.
 * Sessions are delimited by ## Session N: headers.
 */
function splitIntoSessions(content: string): string[] {
  // Split on session headers, keeping the header with each section
  const sessionRegex = /(?=^##\s+Session\s+\d+)/gm;
  const parts = content.split(sessionRegex).filter(part =>
    part.match(/^##\s+Session\s+\d+/m)
  );

  return parts.length > 0 ? parts : [];
}

/**
 * Extract session number from session header.
 */
function extractSessionNumber(sessionContent: string): number | null {
  const match = sessionContent.match(/^##\s+Session\s+(\d+)/m);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Extract theme/focus from session header.
 * Format: ## Session N: Theme or ## Session N
 */
function extractTheme(sessionContent: string): string {
  const match = sessionContent.match(/^##\s+Session\s+\d+:\s*(.+)$/m);
  return match ? match[1].trim() : "(no theme)";
}

/**
 * Extract time annotation from session content.
 * Format: <!-- session-time: HH:MM-HH:MM -->
 */
function extractTimeAnnotation(
  sessionContent: string,
  date: string
): { startTime?: Date; endTime?: Date } {
  const match = sessionContent.match(/<!--\s*session-time:\s*(\d{2}:\d{2})-(\d{2}:\d{2})\s*-->/);
  if (!match) {
    return {};
  }

  const [, startStr, endStr] = match;

  // Parse times assuming the session's date
  const startTime = new Date(`${date}T${startStr}:00`);
  const endTime = new Date(`${date}T${endStr}:00`);

  return { startTime, endTime };
}

/**
 * Extract commit hashes from session content.
 * Looks for patterns like `abc1234` (7-char hex in backticks).
 */
function extractCommits(sessionContent: string): string[] {
  // Match commit hashes in backticks: `0ba4e91`
  const matches = sessionContent.matchAll(/`([0-9a-f]{7,40})`/gi);
  const commits: string[] = [];

  for (const match of matches) {
    // Verify it looks like a commit hash (not just random hex)
    const hash = match[1];
    if (hash.match(/^[0-9a-f]+$/i)) {
      commits.push(hash);
    }
  }

  return [...new Set(commits)]; // Deduplicate
}

/**
 * Extract outcomes from "What I Worked On" section.
 * Returns list items or numbered items from that section.
 */
function extractOutcomes(sessionContent: string): string[] {
  const section = extractSection(sessionContent, "What I Worked On");
  if (!section) {
    return [];
  }

  return extractListItems(section);
}

/**
 * Extract learnings from "Learnings" section.
 */
function extractLearnings(sessionContent: string): string[] {
  const section = extractSection(sessionContent, "Learnings");
  if (!section) {
    return [];
  }

  return extractListItems(section);
}

/**
 * Extract a named section (### heading) from session content.
 */
function extractSection(sessionContent: string, sectionName: string): string | null {
  // Match from ### SectionName to the next ### or ## or end
  const regex = new RegExp(
    `###\\s+${sectionName}[\\s\\S]*?(?=###|##(?!#)|$)`,
    "i"
  );
  const match = sessionContent.match(regex);
  return match ? match[0] : null;
}

/**
 * Extract list items (- or 1.) from a section.
 * Also captures bold headings as items.
 */
function extractListItems(section: string): string[] {
  const items: string[] = [];

  // Match numbered items: 1. **Item** or 1. Item
  const numberedMatches = section.matchAll(/^\s*\d+\.\s+(.+)$/gm);
  for (const match of numberedMatches) {
    items.push(cleanItem(match[1]));
  }

  // Match bullet items: - Item or - **Item**
  const bulletMatches = section.matchAll(/^\s*[-*]\s+(.+)$/gm);
  for (const match of bulletMatches) {
    items.push(cleanItem(match[1]));
  }

  // Match bold-only lines as items: **Item**
  const boldMatches = section.matchAll(/^\s*\*\*([^*]+)\*\*/gm);
  for (const match of boldMatches) {
    const item = match[1].trim();
    // Only add if not already captured
    if (!items.some(i => i.includes(item))) {
      items.push(item);
    }
  }

  return items;
}

/**
 * Clean up a list item - remove markdown formatting.
 */
function cleanItem(item: string): string {
  return item
    .replace(/\*\*([^*]+)\*\*/g, "$1") // Remove bold
    .replace(/`([^`]+)`/g, "$1")       // Remove code
    .trim();
}
