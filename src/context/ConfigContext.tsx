"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { siteConfig } from "@/config";
import { normalizeHex } from "@/lib/color-utils";

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
  onConfigChange?: (newConfig: SiteConfigState, prevConfig: SiteConfigState) => void;
}> = ({ children, onConfigChange }) => {
  const [config, setConfig] = useState<SiteConfigState>(DEFAULT_CONFIG);
  const [isCustomized, setIsCustomized] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Apply accent color to document root CSS variable
  const applyAccentColorLive = useCallback((color: string) => {
    if (typeof document !== "undefined") {
      const normalized = normalizeHex(color);
      document.documentElement.style.setProperty("--music-accent", normalized);
    }
  }, []);

  // Sync document title and timezone cookie
  const syncSideEffects = useCallback((cfg: SiteConfigState) => {
    if (typeof document !== "undefined") {
      document.title = `${cfg.title} | ${cfg.ownerName}`;
      applyAccentColorLive(cfg.accentColor);
      // Persist timezone in cookie for server-side requests
      document.cookie = `listening_timezone=${encodeURIComponent(cfg.timezone)}; path=/; max-age=31536000; SameSite=Lax`;
    }
  }, [applyAccentColorLive]);

  // Read saved configuration from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<SiteConfigState>;
        const merged: SiteConfigState = {
          title: parsed.title || DEFAULT_CONFIG.title,
          ownerName: parsed.ownerName || DEFAULT_CONFIG.ownerName,
          accentColor: normalizeHex(parsed.accentColor || DEFAULT_CONFIG.accentColor),
          siteUrl: parsed.siteUrl || DEFAULT_CONFIG.siteUrl,
          githubUrl: parsed.githubUrl || DEFAULT_CONFIG.githubUrl,
          timezone: parsed.timezone || DEFAULT_CONFIG.timezone,
        };
        setConfig(merged);
        setIsCustomized(true);
        syncSideEffects(merged);
      } else {
        // Apply default accent on clean load
        applyAccentColorLive(DEFAULT_CONFIG.accentColor);
      }
    } catch (e) {
      console.warn("[CONFIG] Could not load persisted configuration:", e);
    }
  }, [applyAccentColorLive, syncSideEffects]);

  const updateConfig = useCallback(
    (patch: Partial<SiteConfigState>) => {
      setConfig((prev) => {
        const next: SiteConfigState = {
          ...prev,
          ...patch,
          accentColor: patch.accentColor ? normalizeHex(patch.accentColor) : prev.accentColor,
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
