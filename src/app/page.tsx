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
  const isConfigured = isDbConfigured();

  const [initialData, activeConfig] = await Promise.all([
    isConfigured
      ? getInitialMusicData()
      : Promise.resolve({
          overview: MOCK_DATA.overview,
          streamLog: MOCK_DATA.streamLog,
          session: MOCK_DATA.session,
        }),
    getActiveSiteConfig(),
  ]);

  return (
    <ListeningView
      initialOverview={initialData.overview}
      initialStreamLog={initialData.streamLog}
      initialSession={initialData.session}
      initialConfig={activeConfig}
      isDbConfigured={isConfigured}
    />
  );
}
