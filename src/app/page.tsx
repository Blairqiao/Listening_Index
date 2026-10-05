import type { Metadata } from "next";
import { ListeningView } from "@/components/ListeningView";
import { MOCK_DATA } from "@/lib/mock-data";
import { getInitialMusicData, getActiveSiteConfig } from "@/lib/db/queries";
import { isDbConfigured } from "@/lib/db";
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

  const [initialData, activeConfig] = await Promise.all([
    isConfigured
      ? getInitialMusicData(initialRange)
      : Promise.resolve({
          overview: MOCK_DATA.overview[initialRange],
          streamLog: MOCK_DATA.streamLog,
          session: MOCK_DATA.session,
        }),
    isForceMock
      ? Promise.resolve({
          title: "Listening Index",
          ownerName: "YOUR NAME",
          accentColor: "#1DB954",
          siteUrl: "https://open.spotify.com/",
          githubUrl: "https://github.com/Blairqiao/listening_index",
          timezone: "America/Chicago",
          spotifyClientId: "",
          livePlayerLayout: "split" as const,
        })
      : getActiveSiteConfig(),
  ]);

  return (
    <ListeningView
      initialOverview={initialData.overview}
      initialStreamLog={initialData.streamLog}
      initialSession={initialData.session}
      initialConfig={activeConfig}
      isDbConfigured={isDbConfigured()}
      initialMode={initialMode}
      initialRange={initialRange}
    />
  );
}
