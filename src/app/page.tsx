import type { Metadata } from "next";
import { ListeningView } from "@/components/ListeningView";
import { MOCK_DATA } from "@/lib/mock-data";
import { getInitialMusicData, getActiveSiteConfig } from "@/lib/db/queries";
import { isDbConfigured } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const activeConfig = await getActiveSiteConfig();
  return {
    title: `${activeConfig.title} | ${activeConfig.ownerName}`,
    description: "Personal Spotify listening data aggregator and 24-hour index.",
  };
}

export default async function Page() {
  const isForceMock = process.env.FORCE_MOCK_DATA === "true";
  const isConfigured = isDbConfigured() && !isForceMock;

  const [initialData, activeConfig] = await Promise.all([
    isConfigured
      ? getInitialMusicData()
      : Promise.resolve({
          overview: MOCK_DATA.overview,
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
    />
  );
}

