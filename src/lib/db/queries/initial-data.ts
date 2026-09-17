import { isDbConfigured } from "../index";
import {
  getCachedOverview,
  setCachedOverview,
  getCachedStreamLog,
  setCachedStreamLog,
  getCachedSession,
  setCachedSession,
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
    const overviewPromise = (async () => {
      let overview = getCachedOverview("1w");
      if (!overview) {
        overview = await getOverviewData("1w");
        setCachedOverview("1w", overview);
      }
      return overview;
    })();

    const streamLogPromise = (async () => {
      let streamLog = getCachedStreamLog(50);
      if (!streamLog) {
        streamLog = await getStreamLog(50);
        setCachedStreamLog(50, streamLog);
      }
      return streamLog;
    })();

    const sessionPromise = (async () => {
      let session = getCachedSession();
      if (!session) {
        session = await getCurrentSession();
        setCachedSession(session);
      }
      return session;
    })();

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
