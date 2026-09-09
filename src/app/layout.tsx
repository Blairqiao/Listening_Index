import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import { siteConfig } from "@/config";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: `${siteConfig.title} | ${siteConfig.ownerName}`,
  description: "Personal Spotify listening data aggregator and index.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} h-full antialiased`}
      style={
        {
          "--music-accent": siteConfig.accentColor,
        } as React.CSSProperties
      }
    >
      <head>
        <style
          dangerouslySetInnerHTML={{
            __html: `:root { --music-accent: ${siteConfig.accentColor}; }`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
