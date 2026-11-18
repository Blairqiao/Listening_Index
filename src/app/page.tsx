import { isValidIanaTimezone, parseTimezoneCookie } from "@/lib/timezone-utils";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ListeningView } from "@/components/ListeningView";
import { MOCK_DATA } from "@/lib/mock/overview-data";
import { getInitialMusicData, getActiveSiteConfig } from "@/lib/db/queries";
import { DEFAULT_SITE_CONFIG } from "@/lib/config-utils";
import { isDbConfigured } from "@/lib/db";
import { ADMIN_COOKIE_NAME, verifySessionToken } from "@/lib/admin-auth";
import { RANGE_KEYS, type Mode, type RangeKey } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const activeConfig = await getActiveSiteConfig();
  return {
    title: `${activeConfig.title} | ${activeConfig.ownerName}`,
    description: "Personal Spotify listening data aggregator and 24-hour index.",
  };
}

interface PageProps {
  searchParams?: Promise<{
    mode?: string;
    range?: string;
    session?: string;
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
    rangeParam && (RANGE_KEYS as readonly string[]).includes(rangeParam)
      ? (rangeParam as RangeKey)
      : "1w";

  const modeParam = resolvedParams?.mode;
  const initialMode: Mode =
    modeParam === "0" || modeParam === "1" || modeParam === "2" || modeParam === "4"
      ? (parseInt(modeParam, 10) as Mode)
      : 0;

  const activeConfig = isForceMock ? DEFAULT_SITE_CONFIG : await getActiveSiteConfig();
  const cookieTimezone = parseTimezoneCookie(cookieStore.get("listening_timezone")?.value);
  const initialVisitorTimezone = isValidIanaTimezone(cookieTimezone) ? cookieTimezone! : "UTC";
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
