import { isValidIanaTimezone } from "@/lib/timezone-utils";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ListeningView } from "@/components/ListeningView";
import { MOCK_DATA } from "@/lib/mock-data";
import { getInitialMusicData, getActiveSiteConfig } from "@/lib/db/queries";
import { isDbConfigured } from "@/lib/db";
import { ADMIN_COOKIE_NAME, verifySessionToken } from "@/lib/admin-auth";
import type { Mode, RangeKey } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const activeConfig = await getActiveSiteConfig();
  return {
    title: `${activeConfig.title} | ${activeConfig.ownerName}`,
    description: "Personal Spotify listening data aggregator and 24-hour index.",
  };
}

const VALID_RANGES: RangeKey[] = ["1d", "1w", "1m", "6m", "1y", "all"];

interface PageProps {
  searchParams?: Promise<{
    mode?: string;
    range?: string;
    sitting?: string;
    config?: string;
  }>;
}

export default async function Page({ searchParams }: PageProps) {
  const cookieStore = await cookies();
  const adminToken = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  const initialIsAuthenticated = verifySessionToken(adminToken);

  const isForceMock = process.env.FORCE_MOCK_DATA === "true";
  const isConfigured = isDbConfigured() && !isForceMock;
  
  const resolvedParams = searchParams ? await searchParams : {};

  const rangeParam = resolvedParams?.range;
  const initialRange: RangeKey =
    rangeParam && VALID_RANGES.includes(rangeParam as RangeKey)
      ? (rangeParam as RangeKey)
      : "1w";

  const modeParam = resolvedParams?.mode;
  const initialMode: Mode =
    modeParam === "0" || modeParam === "1" || modeParam === "2"
      ? (parseInt(modeParam, 10) as Mode)
      : 0;

  const activeConfig = isForceMock ? {
    title: "Listening Index", ownerName: "YOUR NAME", accentColor: "#1DB954",
    siteUrl: "https://open.spotify.com/", githubUrl: "https://github.com/Blairqiao/listening_index",
    timezone: "America/Chicago", spotifyClientId: "", livePlayerLayout: "split" as const,
  } : await getActiveSiteConfig();
  let cookieTimezone = cookieStore.get("listening_timezone")?.value;
  try { if (cookieTimezone) cookieTimezone = decodeURIComponent(cookieTimezone); } catch { cookieTimezone = undefined; }
  const initialVisitorTimezone = isValidIanaTimezone(cookieTimezone) ? cookieTimezone! : activeConfig.timezone;
  const initialData = isConfigured ? await getInitialMusicData(initialRange, initialVisitorTimezone) : {
    overview: MOCK_DATA.overview[initialRange], streamLog: MOCK_DATA.streamLog, session: MOCK_DATA.session,
  };

  return (
    <ListeningView
      initialOverview={initialData.overview}
      initialStreamLog={initialData.streamLog}
      initialSession={initialData.session}
      initialConfig={activeConfig}
      initialVisitorTimezone={initialVisitorTimezone}
      isDbConfigured={isDbConfigured()}
      initialIsAuthenticated={initialIsAuthenticated}
      initialMode={initialMode}
      initialRange={initialRange}
    />
  );
}
