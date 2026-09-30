import type { Metadata } from "next";
import { ListeningView } from "@/components/ListeningView";
import { MOCK_DATA } from "@/lib/mock-data";
import { getInitialMusicData } from "@/lib/db/queries";
import { isDbConfigured } from "@/lib/db";
import { isBackendConfigured } from "@/lib/db/adapter";
import { configRepository } from "@/lib/db/repositories";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const activeConfig = await configRepository().getActiveSiteConfig();
  return {
    title: `${activeConfig.title} | ${activeConfig.ownerName}`,
    description: "Personal Spotify listening data aggregator and 24-hour index.",
  };
}

export default async function Page() {
  // Two different questions while the port to MongoDB is part-way done.
  // Listening data (plays, tracks, artists) still lives only in Postgres, so
  // real data needs Postgres specifically; settings can live in either
  // backend, so the customization menu needs to know if *any* is connected.
  const hasListeningDb = isDbConfigured();
  const hasSettingsDb = isBackendConfigured();

  const [initialData, activeConfig] = await Promise.all([
    hasListeningDb
      ? getInitialMusicData()
      : Promise.resolve({
          overview: MOCK_DATA.overview,
          streamLog: MOCK_DATA.streamLog,
          session: MOCK_DATA.session,
        }),
    configRepository().getActiveSiteConfig(),
  ]);

  return (
    <ListeningView
      initialOverview={initialData.overview}
      initialStreamLog={initialData.streamLog}
      initialSession={initialData.session}
      initialConfig={activeConfig}
      isDbConfigured={hasSettingsDb}
    />
  );
}
