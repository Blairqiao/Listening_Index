import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { isBackendConfigured } from "@/lib/db/adapter";
import { configRepository } from "@/lib/db/repositories";
import type { SiteConfigState } from "@/lib/db/queries";
import { siteConfig } from "@/config";
import { isSameOriginRequest, isAuthorizedAdminRequest } from "@/lib/auth-utils";
import { generateConfigTsCode, normalizeSiteConfig } from "@/lib/config-utils";

export const dynamic = "force-dynamic";

export async function GET() {
  const activeConfig = await configRepository().getActiveSiteConfig();
  return NextResponse.json({
    config: activeConfig,
    defaultConfig: siteConfig,
    isDbConfigured: isBackendConfigured(),
    isLocalDev: process.env.NODE_ENV === "development",
  });
}

export async function POST(request: NextRequest) {
  if (!isAuthorizedAdminRequest(request)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized: Admin authorization required to modify configuration." },
      { status: 401 }
    );
  }

  if (!isSameOriginRequest(request)) {
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
      targetConfig = await configRepository().resetActiveSiteConfig();
    } else {
      targetConfig = normalizeSiteConfig(body, siteConfig);

      if (isBackendConfigured()) {
        await configRepository().saveActiveSiteConfig(targetConfig);
      }
    }

    // Only write to local src/config.ts if no database is configured (local/demo fallback mode)
    // When Neon DB is connected, src/config.ts remains untouched as the default configuration blueprint.
    let wroteToFile = false;
    if (!isBackendConfigured()) {
      try {
        const fileContent = generateConfigTsCode(targetConfig);
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
        database: isBackendConfigured(),
        file: wroteToFile,
      },
      message: isBackendConfigured()
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
