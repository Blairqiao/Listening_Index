"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { siteConfig } from "@/config";
import { normalizeHex, applyAccentColorToDom } from "@/lib/color-utils";

export interface SiteConfigState {
  title: string;
  ownerName: string;
  accentColor: string;
  siteUrl: string;
  githubUrl: string;
  timezone: string;
}

interface ConfigContextType {
  config: SiteConfigState;
  updateConfig: (patch: Partial<SiteConfigState>) => void;
  resetToDefaults: () => void;
  applyAccentColorLive: (color: string) => void;
  generateConfigTsCode: () => string;
  isCustomized: boolean;
  isDbConfigured: boolean;
  isModalOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
}

const STORAGE_KEY = "listening_index_config";

const DEFAULT_CONFIG: SiteConfigState = {
  title: siteConfig.title,
  ownerName: siteConfig.ownerName,
  accentColor: normalizeHex(siteConfig.accentColor),
  siteUrl: siteConfig.siteUrl,
  githubUrl: siteConfig.githubUrl,
  timezone: siteConfig.timezone || "America/Chicago",
};

const ConfigContext = createContext<ConfigContextType | null>(null);

export const ConfigProvider: React.FC<{
  children: React.ReactNode;
  initialConfig?: SiteConfigState;
  isDbConfigured?: boolean;
  onConfigChange?: (newConfig: SiteConfigState, prevConfig: SiteConfigState) => void;
}> = ({ children, initialConfig, isDbConfigured: propIsDbConfigured = true, onConfigChange }) => {
  const [isDb, setIsDb] = useState<boolean>(propIsDbConfigured);

  // Initialize config once from initialConfig or localStorage or defaults
  const [config, setConfig] = useState<SiteConfigState>(() => {
    if (initialConfig) {
      return {
        ...initialConfig,
        accentColor: normalizeHex(initialConfig.accentColor),
      };
    }
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as Partial<SiteConfigState>;
          return {
            title: parsed.title || DEFAULT_CONFIG.title,
            ownerName: parsed.ownerName || DEFAULT_CONFIG.ownerName,
            accentColor: normalizeHex(parsed.accentColor || DEFAULT_CONFIG.accentColor),
            siteUrl: parsed.siteUrl || DEFAULT_CONFIG.siteUrl,
            githubUrl: parsed.githubUrl || DEFAULT_CONFIG.githubUrl,
            timezone: parsed.timezone || DEFAULT_CONFIG.timezone,
          };
        }
      } catch (e) {
        console.warn("[CONFIG] Could not load persisted configuration:", e);
      }
    }
    return DEFAULT_CONFIG;
  });

  const [isCustomized, setIsCustomized] = useState<boolean>(Boolean(initialConfig));
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Apply accent color to document root CSS variable & high-priority style tag
  const applyAccentColorLive = useCallback((color: string) => {
    applyAccentColorToDom(color);
  }, []);

  // Sync document title and timezone cookie
  const syncSideEffects = useCallback((cfg: SiteConfigState) => {
    if (typeof document !== "undefined") {
      document.title = `${cfg.title} | ${cfg.ownerName}`;
      applyAccentColorToDom(cfg.accentColor);
      // Persist timezone in cookie for server-side requests
      document.cookie = `listening_timezone=${encodeURIComponent(cfg.timezone)}; path=/; max-age=31536000; SameSite=Lax`;
    }
  }, []);

  // Guarantee immediate DOM accent recoloring whenever config.accentColor changes
  useEffect(() => {
    applyAccentColorToDom(config.accentColor);
  }, [config.accentColor]);

  // Run once on mount to initialize side effects and probe database status
  useEffect(() => {
    if (typeof window === "undefined") return;

    // In demo mode (when no database is configured), check browser localStorage
    if (!propIsDbConfigured) {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as Partial<SiteConfigState>;
          const merged: SiteConfigState = {
            title: parsed.title || initialConfig?.title || DEFAULT_CONFIG.title,
            ownerName: parsed.ownerName || initialConfig?.ownerName || DEFAULT_CONFIG.ownerName,
            accentColor: normalizeHex(parsed.accentColor || initialConfig?.accentColor || DEFAULT_CONFIG.accentColor),
            siteUrl: parsed.siteUrl || initialConfig?.siteUrl || DEFAULT_CONFIG.siteUrl,
            githubUrl: parsed.githubUrl || initialConfig?.githubUrl || DEFAULT_CONFIG.githubUrl,
            timezone: parsed.timezone || initialConfig?.timezone || DEFAULT_CONFIG.timezone,
          };
          setConfig(merged);
          setIsCustomized(true);
          syncSideEffects(merged);
          return;
        }
      } catch {}
    }

    syncSideEffects(config);

    fetch("/api/config")
      .then((res) => res.json())
      .then((data) => {
        if (typeof data.isDbConfigured === "boolean") {
          setIsDb(data.isDbConfigured);
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateConfig = useCallback(
    (patch: Partial<SiteConfigState>) => {
      const normalizedAccent = patch.accentColor ? normalizeHex(patch.accentColor) : undefined;
      if (normalizedAccent) {
        applyAccentColorToDom(normalizedAccent);
      }

      setConfig((prev) => {
        const next: SiteConfigState = {
          ...prev,
          ...patch,
          accentColor: normalizedAccent || prev.accentColor,
        };
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
          setIsCustomized(true);
        } catch (e) {
          console.warn("[CONFIG] Failed to save configuration to localStorage:", e);
        }
        syncSideEffects(next);
        if (onConfigChange) {
          onConfigChange(next, prev);
        }
        return next;
      });
    },
    [syncSideEffects, onConfigChange]
  );

  const resetToDefaults = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      setIsCustomized(false);
    } catch (e) {
      console.warn("[CONFIG] Failed to remove configuration from localStorage:", e);
    }
    applyAccentColorToDom(DEFAULT_CONFIG.accentColor);
    const prev = config;
    setConfig(DEFAULT_CONFIG);
    syncSideEffects(DEFAULT_CONFIG);
    if (onConfigChange) {
      onConfigChange(DEFAULT_CONFIG, prev);
    }
  }, [config, syncSideEffects, onConfigChange]);

  const generateConfigTsCode = useCallback((): string => {
    return `export const siteConfig = {
  title: ${JSON.stringify(config.title)},
  ownerName: ${JSON.stringify(config.ownerName)},
  accentColor: ${JSON.stringify(config.accentColor)},
  siteUrl: ${JSON.stringify(config.siteUrl)},
  githubUrl: ${JSON.stringify(config.githubUrl)},
  timezone: ${JSON.stringify(config.timezone)},
};
`;
  }, [config]);

  const openModal = useCallback(() => setIsModalOpen(true), []);
  const closeModal = useCallback(() => setIsModalOpen(false), []);

  return (
    <ConfigContext.Provider
      value={{
        config,
        updateConfig,
        resetToDefaults,
        applyAccentColorLive,
        generateConfigTsCode,
        isCustomized,
        isDbConfigured: isDb,
        isModalOpen,
        openModal,
        closeModal,
      }}
    >
      {children}
    </ConfigContext.Provider>
  );
};

export function useConfig(): ConfigContextType {
  const ctx = useContext(ConfigContext);
  if (!ctx) {
    throw new Error("useConfig must be used within a <ConfigProvider>");
  }
  return ctx;
}
