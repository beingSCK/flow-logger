# flow-logger

CLI tool to extract working sessions from work journals and create Google Calendar "flow" events.

## Commands
- `bun run src/cli.ts --dry-run <file>` - Parse journal and show sessions
- `bun test` - Run tests

## Status
v0.1 MVP - Parser and dry-run CLI only. Calendar integration planned for v0.3.

## Architecture

```
src/
├── types.ts                    # Session, FlowCalendarEvent interfaces
├── parsers/
│   └── workJournalParser.ts    # Parse markdown -> Session[]
└── cli.ts                      # CLI entry point with --dry-run
```

## Work Journal Format

The parser expects markdown files with this structure:
- Main heading: `# YYYY-MM-DD: Project - Details`
- Session headings: `## Session N: Theme`
- Subsections: `### Context`, `### What I Worked On`, `### Learnings`, `### Commits`
- Optional time annotation: `<!-- session-time: HH:MM-HH:MM -->`
