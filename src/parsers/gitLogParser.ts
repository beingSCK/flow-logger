import { execSync } from "child_process";

/**
 * Result from getting commit timestamps
 */
export interface CommitTimestamp {
  hash: string;
  timestamp: Date;
  timezone: string;
}

/**
 * Get commit timestamps for a list of commit hashes from a git repository.
 *
 * @param commits - Array of commit hashes (short or full)
 * @param repoPath - Path to the git repository
 * @returns Map of hash (short form) to CommitTimestamp
 */
export function getCommitTimestamps(
  commits: string[],
  repoPath: string
): Map<string, CommitTimestamp> {
  const result = new Map<string, CommitTimestamp>();

  if (commits.length === 0) {
    return result;
  }

  try {
    // Get log for all commits at once using rev-list
    // Format: hash ISO-8601-strict timestamp
    const output = execSync(
      `git log --format="%H %aI" --all`,
      { cwd: repoPath, encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 }
    );

    // Build a map of full hash to timestamp
    const fullHashMap = new Map<string, { timestamp: Date; timezone: string }>();

    for (const line of output.trim().split("\n")) {
      if (!line) continue;

      const [fullHash, isoTimestamp] = line.split(" ");
      if (!fullHash || !isoTimestamp) continue;

      // Extract timezone from ISO timestamp (e.g., "2026-01-15T10:30:00-08:00" -> "-08:00")
      const tzMatch = isoTimestamp.match(/([+-]\d{2}:\d{2})$/);
      const timezone = tzMatch ? convertOffsetToTimezone(tzMatch[1]) : "America/Los_Angeles";

      fullHashMap.set(fullHash, {
        timestamp: new Date(isoTimestamp),
        timezone,
      });
    }

    // Match requested commits (which may be short hashes) to full hashes
    for (const requestedHash of commits) {
      const normalizedRequest = requestedHash.toLowerCase();

      for (const [fullHash, data] of fullHashMap) {
        if (fullHash.toLowerCase().startsWith(normalizedRequest)) {
          result.set(requestedHash, {
            hash: requestedHash,
            timestamp: data.timestamp,
            timezone: data.timezone,
          });
          break;
        }
      }
    }
  } catch (error) {
    // If git command fails, return empty map
    // This allows graceful handling of missing repos
    console.error(`Failed to get commit timestamps from ${repoPath}:`, error);
  }

  return result;
}

/**
 * Convert a UTC offset like "-08:00" to an IANA timezone.
 * This is a best-effort mapping since offsets don't uniquely identify timezones.
 */
function convertOffsetToTimezone(offset: string): string {
  // Common US timezone mappings
  const offsetMap: Record<string, string> = {
    "-08:00": "America/Los_Angeles",
    "-07:00": "America/Denver", // Could also be PDT
    "-06:00": "America/Chicago",
    "-05:00": "America/New_York",
    "-04:00": "America/New_York", // EDT
    "+00:00": "UTC",
    "+01:00": "Europe/London", // BST
  };

  return offsetMap[offset] || "America/Los_Angeles";
}

/**
 * Get the first and last commit timestamps from a list.
 * Useful for inferring session start/end times.
 */
export function getSessionTimeRange(
  commitTimestamps: Map<string, CommitTimestamp>
): { earliest: Date | null; latest: Date | null; timezone: string } {
  let earliest: Date | null = null;
  let latest: Date | null = null;
  let timezone = "America/Los_Angeles";

  for (const data of commitTimestamps.values()) {
    if (!earliest || data.timestamp < earliest) {
      earliest = data.timestamp;
      timezone = data.timezone;
    }
    if (!latest || data.timestamp > latest) {
      latest = data.timestamp;
    }
  }

  return { earliest, latest, timezone };
}
