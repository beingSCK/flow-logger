import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { getCommitTimestamps, getSessionTimeRange } from "../src/parsers/gitLogParser";
import { execSync } from "child_process";
import { mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("gitLogParser", () => {
  let testRepoDir: string;
  let testCommit1: string;
  let testCommit2: string;

  beforeAll(() => {
    // Create a temp git repo for testing
    testRepoDir = join(tmpdir(), `flow-logger-git-test-${Date.now()}`);
    mkdirSync(testRepoDir, { recursive: true });

    // Initialize git repo
    execSync("git init", { cwd: testRepoDir });
    execSync('git config user.email "test@test.com"', { cwd: testRepoDir });
    execSync('git config user.name "Test"', { cwd: testRepoDir });

    // Create first commit
    writeFileSync(join(testRepoDir, "file1.txt"), "content1");
    execSync("git add .", { cwd: testRepoDir });
    execSync('git commit -m "First commit"', { cwd: testRepoDir });
    testCommit1 = execSync("git rev-parse HEAD", {
      cwd: testRepoDir,
      encoding: "utf-8",
    }).trim();

    // Wait a bit and create second commit
    writeFileSync(join(testRepoDir, "file2.txt"), "content2");
    execSync("git add .", { cwd: testRepoDir });
    execSync('git commit -m "Second commit"', { cwd: testRepoDir });
    testCommit2 = execSync("git rev-parse HEAD", {
      cwd: testRepoDir,
      encoding: "utf-8",
    }).trim();
  });

  afterAll(() => {
    rmSync(testRepoDir, { recursive: true, force: true });
  });

  describe("getCommitTimestamps", () => {
    it("should return timestamps for existing commits", () => {
      const timestamps = getCommitTimestamps(
        [testCommit1.slice(0, 7), testCommit2.slice(0, 7)],
        testRepoDir
      );

      expect(timestamps.size).toBe(2);
      expect(timestamps.has(testCommit1.slice(0, 7))).toBe(true);
      expect(timestamps.has(testCommit2.slice(0, 7))).toBe(true);
    });

    it("should return empty map for non-existent commits", () => {
      const timestamps = getCommitTimestamps(["0000000"], testRepoDir);
      expect(timestamps.size).toBe(0);
    });

    it("should return empty map for non-existent repo", () => {
      const timestamps = getCommitTimestamps([testCommit1], "/nonexistent/path");
      expect(timestamps.size).toBe(0);
    });

    it("should handle empty commit list", () => {
      const timestamps = getCommitTimestamps([], testRepoDir);
      expect(timestamps.size).toBe(0);
    });

    it("should include timezone info", () => {
      const timestamps = getCommitTimestamps([testCommit1.slice(0, 7)], testRepoDir);
      const commit = timestamps.get(testCommit1.slice(0, 7));

      expect(commit).toBeDefined();
      expect(commit?.timezone).toBeDefined();
      expect(typeof commit?.timezone).toBe("string");
    });
  });

  describe("getSessionTimeRange", () => {
    it("should return earliest and latest timestamps", () => {
      const timestamps = getCommitTimestamps(
        [testCommit1.slice(0, 7), testCommit2.slice(0, 7)],
        testRepoDir
      );

      const range = getSessionTimeRange(timestamps);

      expect(range.earliest).toBeDefined();
      expect(range.latest).toBeDefined();
      expect(range.earliest!.getTime()).toBeLessThanOrEqual(range.latest!.getTime());
    });

    it("should return null for empty map", () => {
      const range = getSessionTimeRange(new Map());

      expect(range.earliest).toBeNull();
      expect(range.latest).toBeNull();
    });
  });
});
