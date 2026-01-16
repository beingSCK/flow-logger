#!/usr/bin/env bun

import { parseJournalFile } from "./parsers/workJournalParser";
import { basename } from "path";
import { existsSync } from "fs";

function printUsage(): void {
  console.log(`
flow-logger - Extract working sessions from work journals

Usage:
  bun run src/cli.ts [options] <file>
  bun run src/cli.ts --file <path>

Options:
  --dry-run       Parse and display sessions without creating calendar events (default)
  --file <path>   Path to the journal file to process
  --help          Show this help message

Examples:
  bun run src/cli.ts --dry-run ~/work-journal/2026-01-15.md
  bun run src/cli.ts ~/work-journal/2026-01-15.md
`);
}

function formatSession(session: ReturnType<typeof parseJournalFile>[0]): string {
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
    lines.push(`  Time: ${startStr}-${endStr}`);
  } else {
    lines.push(`  Time: (no annotation)`);
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

function main(): void {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help")) {
    printUsage();
    process.exit(args.includes("--help") ? 0 : 1);
  }

  // Parse arguments
  let filePath: string | null = null;
  let dryRun = true; // Default to dry-run

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--file") {
      filePath = args[++i];
    } else if (!arg.startsWith("-")) {
      // Positional argument is the file path
      filePath = arg;
    }
  }

  if (!filePath) {
    console.error("Error: No file path provided");
    printUsage();
    process.exit(1);
  }

  // Expand ~ to home directory
  if (filePath.startsWith("~")) {
    filePath = filePath.replace("~", process.env.HOME || "");
  }

  if (!existsSync(filePath)) {
    console.error(`Error: File not found: ${filePath}`);
    process.exit(1);
  }

  // Parse the journal file
  const sessions = parseJournalFile(filePath);
  const filename = basename(filePath);

  if (sessions.length === 0) {
    console.log(`No sessions found in ${filename}`);
    process.exit(0);
  }

  console.log(`Parsed ${sessions.length} sessions from ${filename}:\n`);

  for (const session of sessions) {
    console.log(formatSession(session));
    console.log(); // Blank line between sessions
  }

  if (dryRun) {
    console.log("(dry-run mode - no calendar events created)");
  }
}

main();
