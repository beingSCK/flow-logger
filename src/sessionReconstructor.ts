import { Session, DEFAULT_TIMEZONE } from "./types";
import { getCommitTimestamps, getSessionTimeRange } from "./parsers/gitLogParser";

/**
 * Configuration for session reconstruction
 */
export interface ReconstructConfig {
  /** Path to the git repository for commit lookups */
  repoPath?: string;
  /** Default session duration in minutes when no timing info available */
  defaultDurationMinutes?: number;
  /** Buffer to add before first commit (minutes) */
  preCommitBufferMinutes?: number;
  /** Buffer to add after last commit (minutes) */
  postCommitBufferMinutes?: number;
}

const DEFAULT_CONFIG: Required<ReconstructConfig> = {
  repoPath: process.cwd(),
  defaultDurationMinutes: 60,
  preCommitBufferMinutes: 15,
  postCommitBufferMinutes: 5,
};

/**
 * Reconstruct session timing using available signals.
 *
 * Priority:
 * 1. Explicit time annotation (already parsed)
 * 2. Git commit timestamps (infer from commits)
 * 3. Default placeholder (no timing available)
 *
 * @param session - Session with potentially missing timing
 * @param config - Configuration for reconstruction
 * @returns Session with timing filled in where possible
 */
export function reconstructSessionTiming(
  session: Session,
  config: Partial<ReconstructConfig> = {}
): Session {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };

  // If session already has timing, just return it
  if (session.startTime && session.endTime) {
    return session;
  }

  // Try to infer from commits
  if (session.commits.length > 0 && fullConfig.repoPath) {
    const timestamps = getCommitTimestamps(session.commits, fullConfig.repoPath);

    if (timestamps.size > 0) {
      const { earliest, latest, timezone } = getSessionTimeRange(timestamps);

      if (earliest && latest) {
        // Add buffers around commits
        const startTime = new Date(earliest.getTime() - fullConfig.preCommitBufferMinutes * 60 * 1000);
        const endTime = new Date(latest.getTime() + fullConfig.postCommitBufferMinutes * 60 * 1000);

        return {
          ...session,
          startTime,
          endTime,
          timezone,
        };
      }
    }
  }

  // No timing info available - return session unchanged
  return session;
}

/**
 * Reconstruct timing for multiple sessions.
 */
export function reconstructAllSessions(
  sessions: Session[],
  config: Partial<ReconstructConfig> = {}
): Session[] {
  return sessions.map((session) => reconstructSessionTiming(session, config));
}

/**
 * Check if a session has any timing information.
 */
export function hasTimingInfo(session: Session): boolean {
  return session.startTime !== undefined && session.endTime !== undefined;
}

/**
 * Get timing source for a session (for reporting).
 */
export function getTimingSource(session: Session): "annotation" | "commits" | "none" {
  // This is a simplified check - in practice we'd need to track how timing was derived
  if (session.startTime && session.endTime) {
    // Check if timing came from commits by looking at the seconds
    // Annotations only have HH:MM, so seconds are always 00
    if (
      session.startTime.getSeconds() !== 0 ||
      session.endTime.getSeconds() !== 0
    ) {
      return "commits";
    }
    return "annotation";
  }
  return "none";
}
