import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { isDbConfigured } from "@/lib/db";
import {
  getActiveSiteConfig,
  saveActiveSiteConfig,
  resetActiveSiteConfig,
  SiteConfigState,
} from "@/lib/db/queries";
import { siteConfig } from "@/config";

export const dynamic = "force-dynamic";

function isAuthorizedOrigin(request: NextRequest): boolean {
  if (process.env.NODE_ENV === "development") return true;
  const secFetchSite = request.headers.get("sec-fetch-site");
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const host = request.headers.get("host") || request.nextUrl.host;

  return (
    secFetchSite === "same-origin" ||
    Boolean(origin && host && origin.includes(host)) ||
    Boolean(referer && host && referer.includes(host))
  );
}

export async function GET() {
  const activeConfig = await getActiveSiteConfig();
  return NextResponse.json({
    config: activeConfig,
    defaultConfig: siteConfig,
    isDbConfigured: isDbConfigured(),
    isLocalDev: process.env.NODE_ENV === "development",
  });
}

export async function POST(request: NextRequest) {
  if (!isAuthorizedOrigin(request)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized: Cross-origin request not permitted" },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const isReset = Boolean(body.resetToDefault);

    let targetConfig: SiteConfigState;

    if (isReset) {
      targetConfig = await resetActiveSiteConfig();
    } else {
      targetConfig = {
        title: String(body.title || siteConfig.title).trim(),
        ownerName: String(body.ownerName || siteConfig.ownerName).trim(),
        accentColor: String(body.accentColor || siteConfig.accentColor).trim(),
        siteUrl: String(body.siteUrl || siteConfig.siteUrl).trim(),
        githubUrl: String(body.githubUrl || siteConfig.githubUrl).trim(),
        timezone: String(body.timezone || siteConfig.timezone || "America/Chicago").trim(),
      };

      if (isDbConfigured()) {
        await saveActiveSiteConfig(targetConfig);
      }
    }

    // Only write to local src/config.ts if no database is configured (local/demo fallback mode)
    // When Neon DB is connected, src/config.ts remains untouched as the default configuration blueprint.
    let wroteToFile = false;
    if (!isDbConfigured()) {
      try {
        const fileContent = `export const siteConfig = {
  title: ${JSON.stringify(targetConfig.title)},
  ownerName: ${JSON.stringify(targetConfig.ownerName)},
  accentColor: ${JSON.stringify(targetConfig.accentColor)},
  siteUrl: ${JSON.stringify(targetConfig.siteUrl)},
  githubUrl: ${JSON.stringify(targetConfig.githubUrl)},
  timezone: ${JSON.stringify(targetConfig.timezone)},
};
`;
        const configPath = path.join(process.cwd(), "src", "config.ts");
        await fs.writeFile(configPath, fileContent, "utf-8");
        wroteToFile = true;
      } catch {
        // Expected on read-only serverless filesystems (e.g. Vercel)
      }
    }

    return NextResponse.json({
      success: true,
      persistedTo: {
        database: isDbConfigured(),
        file: wroteToFile,
      },
      message: isDbConfigured()
        ? "Saved active configuration to Neon database"
        : "Saved to local configuration file",
      config: targetConfig,
    });
  } catch (error: unknown) {
    console.error("[CONFIG API ERROR]", error);
    const message = error instanceof Error ? error.message : "Failed to update configuration";

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
