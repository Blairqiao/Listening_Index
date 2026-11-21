import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Spline_Sans_Mono } from "next/font/google";
import { getActiveSiteConfig } from "@/lib/db/queries";
import "./globals.css";

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const splineSansMono = Spline_Sans_Mono({
  variable: "--font-spline-sans-mono",
  subsets: ["latin"],
});

export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

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
      className={`${ibmPlexMono.variable} ${splineSansMono.variable} h-full antialiased`}
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
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){if(typeof window!=="undefined"&&window.location.hostname==="localhost"){window.location.replace(window.location.href.replace("//localhost","//127.0.0.1"));}})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
