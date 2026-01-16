# flow-logger

CLI tool to extract working sessions from work journals and create Google Calendar "flow" events.

## What it does

Parses markdown work journal files and extracts structured session data:
- Session boundaries (`## Session N:` headers)
- Project and theme from headings
- Commit hashes mentioned in content
- Outcomes from "What I Worked On" sections
- Learnings from "Learnings" sections
- Optional time annotations (`<!-- session-time: HH:MM-HH:MM -->`)

## Installation

```bash
bun install
```

## Usage

```bash
# Parse a journal and preview sessions (dry-run is default)
bun run src/cli.ts ~/code-directory-top/_meta/work-journal/2026-01-15.md

# Explicitly dry-run
bun run src/cli.ts --dry-run ~/work-journal/2026-01-15.md

# Show help
bun run src/cli.ts --help
```

### Example output

```
Parsed 3 sessions from 2026-01-15.md:

Session 1: Orientation and Context Restoration
  Project: Calendar Automaton
  Time: (no annotation)
  Commits: 0
  Outcomes: 0 items

Session 2: TypeScript Strict Mode Fixes and PR Creation
  Project: Calendar Automaton
  Time: (no annotation)
  Commits: 1 (0ba4e91)
  Outcomes: 22 items
  Learnings: 4 items
```

## Testing

```bash
bun test
```

## Roadmap

- **v0.1** (current): Parser and dry-run CLI
- **v0.2**: Historical backfill, timezone handling, edge cases
- **v0.3**: Google Calendar integration with "flow" color events

## Related

Part of the [code-directory-top](https://github.com/beingSCK) tooling ecosystem.
