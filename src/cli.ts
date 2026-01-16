#!/usr/bin/env bun

import { parseJournalFile } from "./parsers/workJournalParser";
import { reconstructSessionTiming, getTimingSource } from "./sessionReconstructor";
import { basename, join, dirname } from "path";
import { existsSync, readdirSync, statSync } from "fs";
import type { Session } from "./types";

function printUsage(): void {
  console.log(`
flow-logger - Extract working sessions from work journals

Usage:
  bun run src/cli.ts [options] <file-or-directory>
  bun run src/cli.ts --dir <journal-directory> --from <date> --to <date>

Options:
  --dry-run         Parse and display sessions without creating calendar events (default)
  --file <path>     Path to a single journal file to process
  --dir <path>      Path to directory containing journal files (YYYY-MM-DD.md)
  --from <date>     Start date for filtering (YYYY-MM-DD format)
  --to <date>       End date for filtering (YYYY-MM-DD format, inclusive)
  --repo <path>     Git repository path for commit timestamp lookup
  --help            Show this help message

Date Range Examples:
  # Process all journals from Dec 6, 2025 to today
  bun run src/cli.ts --dir ~/work-journal --from 2025-12-06

  # Process a specific date range
  bun run src/cli.ts --dir ~/work-journal --from 2026-01-01 --to 2026-01-15

Single File Examples:
  bun run src/cli.ts --dry-run ~/work-journal/2026-01-15.md
  bun run src/cli.ts ~/work-journal/2026-01-15.md
`);
}

function formatSession(session: Session): string {
  const lines: string[] = [];

  lines.push(`Session ${session.sessionNumber}: ${session.theme}`);
  lines.push(`  Project: ${session.project}`);

  if (session.startTime && session.endTime) {
    const startStr = session.startTime.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const endStr = session.endTime.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const timingSource = getTimingSource(session);
    const sourceLabel = timingSource === "commits" ? " (from commits)" : "";
    lines.push(`  Time: ${startStr}-${endStr}${sourceLabel}`);
  } else {
    lines.push(`  Time: (no timing info)`);
  }

  if (session.commits.length > 0) {
    lines.push(`  Commits: ${session.commits.length} (${session.commits.join(", ")})`);
  } else {
    lines.push(`  Commits: 0`);
  }

  lines.push(`  Outcomes: ${session.outcomes.length} items`);

  if (session.learnings.length > 0) {
    lines.push(`  Learnings: ${session.learnings.length} item${session.learnings.length > 1 ? "s" : ""}`);
  }

  return lines.join("\n");
}

/**
 * Parse a date string in YYYY-MM-DD format.
 */
function parseDate(dateStr: string): Date | null {
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const [, year, month, day] = match;
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));

  // Validate the date is real
  if (
    date.getFullYear() !== parseInt(year) ||
    date.getMonth() !== parseInt(month) - 1 ||
    date.getDate() !== parseInt(day)
  ) {
    return null;
  }

  return date;
}

/**
 * Get today's date as YYYY-MM-DD.
 */
function getTodayString(): string {
  const today = new Date();
  return today.toISOString().split("T")[0];
}

/**
 * Check if a date string falls within a range.
 */
function isDateInRange(dateStr: string, fromDate: Date | null, toDate: Date | null): boolean {
  const date = parseDate(dateStr);
  if (!date) return false;

  if (fromDate && date < fromDate) return false;
  if (toDate) {
    // Make toDate inclusive by checking against end of day
    const endOfToDate = new Date(toDate);
    endOfToDate.setHours(23, 59, 59, 999);
    if (date > endOfToDate) return false;
  }

  return true;
}

/**
 * Find all journal files in a directory matching the date range.
 */
function findJournalFiles(
  dirPath: string,
  fromDate: Date | null,
  toDate: Date | null
): string[] {
  const files: string[] = [];

  const entries = readdirSync(dirPath);

  for (const entry of entries) {
    // Match YYYY-MM-DD.md pattern
    const match = entry.match(/^(\d{4}-\d{2}-\d{2})\.md$/);
    if (!match) continue;

    const dateStr = match[1];
    if (!isDateInRange(dateStr, fromDate, toDate)) continue;

    const fullPath = join(dirPath, entry);
    if (statSync(fullPath).isFile()) {
      files.push(fullPath);
    }
  }

  // Sort by date
  files.sort();
  return files;
}

/**
 * Expand ~ to home directory.
 */
function expandPath(path: string): string {
  if (path.startsWith("~")) {
    return path.replace("~", process.env.HOME || "");
  }
  return path;
}

interface CliOptions {
  dryRun: boolean;
  filePath: string | null;
  dirPath: string | null;
  fromDate: Date | null;
  toDate: Date | null;
  repoPath: string | null;
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    dryRun: true,
    filePath: null,
    dirPath: null,
    fromDate: null,
    toDate: null,
    repoPath: null,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--file") {
      options.filePath = args[++i];
    } else if (arg === "--dir") {
      options.dirPath = args[++i];
    } else if (arg === "--from") {
      const dateStr = args[++i];
      const date = parseDate(dateStr);
      if (!date) {
        console.error(`Error: Invalid --from date format: ${dateStr} (expected YYYY-MM-DD)`);
        process.exit(1);
      }
      options.fromDate = date;
    } else if (arg === "--to") {
      const dateStr = args[++i];
      const date = parseDate(dateStr);
      if (!date) {
        console.error(`Error: Invalid --to date format: ${dateStr} (expected YYYY-MM-DD)`);
        process.exit(1);
      }
      options.toDate = date;
    } else if (arg === "--repo") {
      options.repoPath = args[++i];
    } else if (!arg.startsWith("-")) {
      // Positional argument: could be file or directory
      const expanded = expandPath(arg);
      if (existsSync(expanded)) {
        if (statSync(expanded).isDirectory()) {
          options.dirPath = arg;
        } else {
          options.filePath = arg;
        }
      } else {
        options.filePath = arg; // Will error later if not found
      }
    }
  }

  return options;
}

function main(): void {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help")) {
    printUsage();
    process.exit(args.includes("--help") ? 0 : 1);
  }

  const options = parseArgs(args);

  // Determine files to process
  let filesToProcess: string[] = [];

  if (options.dirPath) {
    const dirPath = expandPath(options.dirPath);
    if (!existsSync(dirPath)) {
      console.error(`Error: Directory not found: ${dirPath}`);
      process.exit(1);
    }

    // Default --to to today if --from is specified but --to is not
    const toDate = options.toDate || (options.fromDate ? parseDate(getTodayString()) : null);

    filesToProcess = findJournalFiles(dirPath, options.fromDate, toDate);

    if (filesToProcess.length === 0) {
      console.log("No journal files found matching the date range.");
      process.exit(0);
    }
  } else if (options.filePath) {
    const filePath = expandPath(options.filePath);
    if (!existsSync(filePath)) {
      console.error(`Error: File not found: ${filePath}`);
      process.exit(1);
    }
    filesToProcess = [filePath];
  } else {
    console.error("Error: No file or directory specified");
    printUsage();
    process.exit(1);
  }

  // Process all files
  let totalSessions = 0;
  let sessionsWithTiming = 0;
  const allSessions: Session[] = [];

  for (const filePath of filesToProcess) {
    const sessions = parseJournalFile(filePath);

    // Reconstruct timing for sessions without annotations
    const reconstructedSessions = sessions.map((session) =>
      reconstructSessionTiming(session, {
        repoPath: options.repoPath || dirname(filePath),
      })
    );

    allSessions.push(...reconstructedSessions);
    totalSessions += reconstructedSessions.length;
    sessionsWithTiming += reconstructedSessions.filter(
      (s) => s.startTime && s.endTime
    ).length;
  }

  if (allSessions.length === 0) {
    console.log("No sessions found in the specified files.");
    process.exit(0);
  }

  // Group sessions by date for display
  const sessionsByDate = new Map<string, Session[]>();
  for (const session of allSessions) {
    const existing = sessionsByDate.get(session.date) || [];
    existing.push(session);
    sessionsByDate.set(session.date, existing);
  }

  // Display results
  console.log(`\nProcessed ${filesToProcess.length} journal file(s)`);
  console.log(`Found ${totalSessions} session(s), ${sessionsWithTiming} with timing info\n`);
  console.log("=".repeat(60));

  for (const [date, sessions] of [...sessionsByDate.entries()].sort()) {
    console.log(`\n${date}:`);
    console.log("-".repeat(40));

    for (const session of sessions) {
      console.log(formatSession(session));
      console.log();
    }
  }

  if (options.dryRun) {
    console.log("(dry-run mode - no calendar events created)");
  }
}

main();
