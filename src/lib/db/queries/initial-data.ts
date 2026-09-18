import { isDbConfigured } from "../index";
import {
  getOrFetchOverview,
  getOrFetchStreamLog,
  getOrFetchSession,
} from "../server-cache";
import { getOverviewData } from "./overview";
import { getStreamLog } from "./stream-log";
import { getCurrentSession } from "./session";
import type { OverviewData, StreamLogData, SessionData } from "./types";

/**
 * Concurrently orchestrates initial listening data queries for server-side hydration.
 * Returns null placeholders gracefully if database is unconfigured or unreachable.
 */
export async function getInitialMusicData(): Promise<{
  overview: OverviewData | null;
  streamLog: StreamLogData | null;
  session: SessionData | null;
}> {
  if (!isDbConfigured()) {
    return { overview: null, streamLog: null, session: null };
  }

  try {
    const overviewPromise = getOrFetchOverview("1w", () => getOverviewData("1w"));
    const streamLogPromise = getOrFetchStreamLog(50, () => getStreamLog(50));
    const sessionPromise = getOrFetchSession(() => getCurrentSession());

    const [overviewResult, streamLogResult, sessionResult] = await Promise.allSettled([
      overviewPromise,
      streamLogPromise,
      sessionPromise,
    ]);

    return {
      overview: overviewResult.status === "fulfilled" ? overviewResult.value : null,
      streamLog: streamLogResult.status === "fulfilled" ? streamLogResult.value : null,
      session: sessionResult.status === "fulfilled" ? sessionResult.value : null,
    };
  } catch {
    // If DB is unreachable during build or cold start, fallback gracefully to null
    return { overview: null, streamLog: null, session: null };
  }
}
