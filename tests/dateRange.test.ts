import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { execSync } from "child_process";

describe("CLI date range filtering", () => {
  let testDir: string;

  beforeAll(() => {
    testDir = join(tmpdir(), `flow-logger-daterange-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });

    // Create test journal files
    const journalContent = (date: string) => `# ${date}: Test Project

## Session 1: Test Session

### What I Worked On
- Did something
`;

    writeFileSync(join(testDir, "2025-12-01.md"), journalContent("2025-12-01"));
    writeFileSync(join(testDir, "2025-12-15.md"), journalContent("2025-12-15"));
    writeFileSync(join(testDir, "2026-01-01.md"), journalContent("2026-01-01"));
    writeFileSync(join(testDir, "2026-01-15.md"), journalContent("2026-01-15"));
    // Also create a non-matching file to ensure filtering works
    writeFileSync(join(testDir, "notes.md"), "# Just some notes");
  });

  afterAll(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("should find all journal files without date range", () => {
    const output = execSync(`bun run src/cli.ts --dir ${testDir}`, {
      encoding: "utf-8",
      cwd: process.cwd(),
    });

    expect(output).toContain("4 journal file(s)");
    expect(output).toContain("4 session(s)");
  });

  it("should filter by --from date", () => {
    const output = execSync(`bun run src/cli.ts --dir ${testDir} --from 2026-01-01`, {
      encoding: "utf-8",
      cwd: process.cwd(),
    });

    expect(output).toContain("2 journal file(s)");
    expect(output).toContain("2026-01-01:");
    expect(output).toContain("2026-01-15:");
    expect(output).not.toContain("2025-12-01:");
    expect(output).not.toContain("2025-12-15:");
  });

  it("should filter by --to date", () => {
    const output = execSync(`bun run src/cli.ts --dir ${testDir} --from 2025-12-01 --to 2025-12-31`, {
      encoding: "utf-8",
      cwd: process.cwd(),
    });

    expect(output).toContain("2 journal file(s)");
    expect(output).toContain("2025-12-01:");
    expect(output).toContain("2025-12-15:");
    expect(output).not.toContain("2026-01-01:");
  });

  it("should filter by exact date range", () => {
    const output = execSync(`bun run src/cli.ts --dir ${testDir} --from 2025-12-15 --to 2026-01-01`, {
      encoding: "utf-8",
      cwd: process.cwd(),
    });

    expect(output).toContain("2 journal file(s)");
    expect(output).toContain("2025-12-15:");
    expect(output).toContain("2026-01-01:");
    expect(output).not.toContain("2025-12-01:");
    expect(output).not.toContain("2026-01-15:");
  });

  it("should handle invalid date format gracefully", () => {
    try {
      execSync(`bun run src/cli.ts --dir ${testDir} --from invalid-date`, {
        encoding: "utf-8",
        cwd: process.cwd(),
        stdio: ["pipe", "pipe", "pipe"],
      });
      expect(true).toBe(false); // Should not reach here
    } catch (error: unknown) {
      const execError = error as { stderr?: string };
      expect(execError.stderr).toContain("Invalid --from date format");
    }
  });
});
