import type { Metadata } from "next";
import { ListeningView } from "@/components/ListeningView";
import { MOCK_DATA } from "@/lib/mock-data";
import { getInitialMusicData } from "@/lib/db/queries";
import { siteConfig } from "@/config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `${siteConfig.title} | ${siteConfig.ownerName}`,
  description: "Personal Spotify listening data aggregator and 24-hour index.",
};

export default async function Page() {
  const isDbConfigured = Boolean(process.env.DATABASE_URL);

  const initialData = isDbConfigured 
    ? await getInitialMusicData()
    : { overview: MOCK_DATA.overview, streamLog: MOCK_DATA.streamLog, session: MOCK_DATA.session };

  return (
    <>
      <ListeningView
        initialOverview={initialData.overview}
        initialStreamLog={initialData.streamLog}
        initialSession={initialData.session}
      />
    </>
  );
}
