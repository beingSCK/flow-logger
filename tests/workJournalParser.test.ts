import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { parseJournalFile } from "../src/parsers/workJournalParser";
import { writeFileSync, unlinkSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const sampleJournal = `# 2026-01-15: Calendar Automaton - TypeScript Fixes

## Session 1: Orientation and Context Restoration

### Context
Started session at \`code_directory_top\` level. Ran \`/orient\` to get caught up.

## Session 2: TypeScript Strict Mode Fixes and PR Creation
<!-- session-time: 10:30-12:45 -->

### Context
Opened fresh Claude Code session in \`calendar-projects/\`.

### What I Worked On
**Phase 1: TypeScript Strict Mode Fixes (Complete)**
1. **Installed Zod** for runtime validation
2. **Created validation schemas** in \`src/types.ts\`
3. **Fixed TypeScript errors across 6 files**

### Learnings
**Zod validation pattern:**
Zod's \`safeParse()\` returns \`{ success: boolean, data?, error? }\`.

### Commits
- \`0ba4e91\` Fix TypeScript strict mode errors with Zod runtime validation

## Session 3: Transit Preference Feature

### What I Worked On
**PR #2: Transit Preference Feature (Complete)**
- Added \`TransitPreference\` type
- Implemented 6 unit tests

### Learnings
**Principle of least surprise:** A script should do exactly what its name says.
`;

describe("workJournalParser", () => {
  let testDir: string;
  let testFilePath: string;

  beforeAll(() => {
    testDir = join(tmpdir(), `flow-logger-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    testFilePath = join(testDir, "2026-01-15.md");
    writeFileSync(testFilePath, sampleJournal);
  });

  afterAll(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  describe("parseJournalFile", () => {
    it("should extract the correct number of sessions", () => {
      const sessions = parseJournalFile(testFilePath);
      expect(sessions.length).toBe(3);
    });

    it("should extract date from filename", () => {
      const sessions = parseJournalFile(testFilePath);
      expect(sessions[0].date).toBe("2026-01-15");
    });

    it("should extract project from main heading", () => {
      const sessions = parseJournalFile(testFilePath);
      expect(sessions[0].project).toBe("Calendar Automaton");
    });

    it("should extract session numbers", () => {
      const sessions = parseJournalFile(testFilePath);
      expect(sessions[0].sessionNumber).toBe(1);
      expect(sessions[1].sessionNumber).toBe(2);
      expect(sessions[2].sessionNumber).toBe(3);
    });

    it("should extract session themes", () => {
      const sessions = parseJournalFile(testFilePath);
      expect(sessions[0].theme).toBe("Orientation and Context Restoration");
      expect(sessions[1].theme).toBe("TypeScript Strict Mode Fixes and PR Creation");
      expect(sessions[2].theme).toBe("Transit Preference Feature");
    });

    it("should extract time annotations when present", () => {
      const sessions = parseJournalFile(testFilePath);

      // Session 1 has no time annotation
      expect(sessions[0].startTime).toBeUndefined();
      expect(sessions[0].endTime).toBeUndefined();

      // Session 2 has time annotation
      expect(sessions[1].startTime).toBeDefined();
      expect(sessions[1].endTime).toBeDefined();

      if (sessions[1].startTime && sessions[1].endTime) {
        expect(sessions[1].startTime.getHours()).toBe(10);
        expect(sessions[1].startTime.getMinutes()).toBe(30);
        expect(sessions[1].endTime.getHours()).toBe(12);
        expect(sessions[1].endTime.getMinutes()).toBe(45);
      }
    });

    it("should extract commit hashes", () => {
      const sessions = parseJournalFile(testFilePath);

      expect(sessions[0].commits.length).toBe(0);
      expect(sessions[1].commits.length).toBe(1);
      expect(sessions[1].commits[0]).toBe("0ba4e91");
    });

    it("should extract outcomes from What I Worked On section", () => {
      const sessions = parseJournalFile(testFilePath);

      // Session 1 has no What I Worked On section
      expect(sessions[0].outcomes.length).toBe(0);

      // Session 2 has numbered items (may include bold header)
      expect(sessions[1].outcomes.length).toBeGreaterThanOrEqual(3);
      expect(sessions[1].outcomes.some(o => o.includes("Installed Zod"))).toBe(true);

      // Session 3 has bullet items
      expect(sessions[2].outcomes.length).toBeGreaterThanOrEqual(2);
    });

    it("should extract learnings from Learnings section", () => {
      const sessions = parseJournalFile(testFilePath);

      // Session 1 has no learnings
      expect(sessions[0].learnings.length).toBe(0);

      // Session 2 has learnings
      expect(sessions[1].learnings.length).toBeGreaterThan(0);
    });

    it("should set default timezone", () => {
      const sessions = parseJournalFile(testFilePath);
      expect(sessions[0].timezone).toBe("America/Los_Angeles");
    });

    it("should set source file path", () => {
      const sessions = parseJournalFile(testFilePath);
      expect(sessions[0].sourceFile).toBe(testFilePath);
    });
  });

  describe("edge cases", () => {
    it("should handle journal with no sessions gracefully", () => {
      const emptyJournalPath = join(testDir, "empty.md");
      writeFileSync(emptyJournalPath, "# 2026-01-15: Some Notes\n\nJust some notes here.");

      const sessions = parseJournalFile(emptyJournalPath);
      expect(sessions.length).toBe(0);
    });

    it("should handle session with no theme", () => {
      const noThemePath = join(testDir, "no-theme.md");
      writeFileSync(noThemePath, `# 2026-01-15: Project

## Session 1

Some content here.
`);

      const sessions = parseJournalFile(noThemePath);
      expect(sessions.length).toBe(1);
      expect(sessions[0].theme).toBe("(no theme)");
    });

    it("should extract project as General when no project in heading", () => {
      const noProjectPath = join(testDir, "no-project.md");
      writeFileSync(noProjectPath, `# Notes for today

## Session 1: Random Work

Did some stuff.
`);

      const sessions = parseJournalFile(noProjectPath);
      expect(sessions[0].project).toBe("General");
    });
  });
});
