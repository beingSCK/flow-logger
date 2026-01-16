# flow-logger

CLI tool to extract working sessions from work journals and create Google Calendar "flow" events.

## Commands

```bash
bun run src/cli.ts --dry-run <file>      # Parse single journal file
bun run src/cli.ts --dir <dir> --from <date> --to <date>  # Process date range
bun run src/cli.ts --help                # Show usage
bun test                                  # Run tests
```

## Architecture

```
src/
├── types.ts                    # Session, FlowCalendarEvent interfaces
├── sessionReconstructor.ts     # Infer timing from commits when no annotation
├── parsers/
│   ├── workJournalParser.ts    # Parse markdown -> Session[]
│   └── gitLogParser.ts         # Extract commit timestamps from git repos
└── cli.ts                      # CLI entry point with date range filtering
```

## Work Journal Format

The parser expects markdown files with this structure:
- Main heading: `# YYYY-MM-DD: Project - Details`
- Session headings: `## Session N: Theme`
- Subsections: `### Context`, `### What I Worked On`, `### Learnings`, `### Commits`
- Optional time annotation: `<!-- session-time: HH:MM-HH:MM -->`

## Conventions

**Commit hygiene:** Commit after each logical unit of work, not at session end.

**No AI attribution:** No "Generated with Claude" comments in code, commits, or PRs.

**Testing:** Run `bun test` before committing. All tests should pass.

## Roadmap

| Version | Scope |
|---------|-------|
| v0.1 | Parser and dry-run CLI |
| v0.2 (current) | Historical backfill, date range filtering, commit timing |
| v0.3 | Google Calendar integration, "flow" color events |

## Related Projects

- **calendar-automaton**: Chrome extension for calendar event processing (separate repo, similar calendar patterns)
- **work-journal-summarizer**: Email summaries of work journals

Pattern reuse between these projects may warrant a shared `calendar-engine` library (Rule of Three - wait for third use case).

## Session Continuity

This project uses the standard session continuity pattern:
- **HANDOFF.md**: Current status, updated each session
- **Work journal**: `code-directory-top/_meta/work-journal/YYYY-MM-DD.md`
