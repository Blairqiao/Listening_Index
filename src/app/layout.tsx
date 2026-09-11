import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import { siteConfig } from "@/config";
import { getActiveSiteConfig } from "@/lib/db/queries";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const activeConfig = await getActiveSiteConfig();
  return {
    title: `${activeConfig.title} | ${activeConfig.ownerName}`,
    description: "Personal Spotify listening data aggregator and index.",
    icons: {
      icon: "/icon.svg",
      shortcut: "/icon.svg",
      apple: "/icon.svg",
    },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const activeConfig = await getActiveSiteConfig();

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <head>
        <style
          id="active-theme-accent"
          dangerouslySetInnerHTML={{
            __html: `:root, html, body { --music-accent: ${activeConfig.accentColor} !important; --color-music-accent: ${activeConfig.accentColor} !important; }`,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var c=localStorage.getItem("listening_index_config");if(c){var parsed=JSON.parse(c);if(parsed.accentColor){document.documentElement.style.setProperty("--music-accent",parsed.accentColor,"important");document.documentElement.style.setProperty("--color-music-accent",parsed.accentColor,"important");}}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
