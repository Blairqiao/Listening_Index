"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { applyAccentColorToDom, normalizeHex } from "@/lib/color-utils";
import {
  SiteConfigState,
  DEFAULT_SITE_CONFIG,
  normalizeSiteConfig,
  generateConfigTsCode as buildConfigTsCode,
} from "@/lib/config-utils";

export type { ConfigContextType, SiteConfigState };

interface ConfigContextType {
  config: SiteConfigState;
  deployedConfig: SiteConfigState;
  markAsDeployed: (cfg: SiteConfigState) => void;
  updateConfig: (patch: Partial<SiteConfigState>) => void;
  resetToDefaults: () => void;
  applyAccentColorLive: (color: string) => void;
  generateConfigTsCode: () => string;
  isCustomized: boolean;
  isDbConfigured: boolean;
  isModalOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
  isAuthenticated: boolean;
  isPasswordConfigured: boolean;
  login: (password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const STORAGE_KEY = "listening_index_config";

const DEFAULT_CONFIG: SiteConfigState = DEFAULT_SITE_CONFIG;

const ConfigContext = createContext<ConfigContextType | null>(null);

export const ConfigProvider: React.FC<{
  children: React.ReactNode;
  initialConfig?: SiteConfigState;
  isDbConfigured?: boolean;
  initialIsAuthenticated?: boolean;
  initialIsPasswordConfigured?: boolean;
  onConfigChange?: (newConfig: SiteConfigState, prevConfig: SiteConfigState) => void;
}> = ({
  children,
  initialConfig,
  isDbConfigured: propIsDbConfigured = true,
  initialIsAuthenticated = false,
  initialIsPasswordConfigured = false,
  onConfigChange,
}) => {
  const [isDb, setIsDb] = useState<boolean>(propIsDbConfigured);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(initialIsAuthenticated);
  const [isPasswordConfigured, setIsPasswordConfigured] = useState<boolean>(initialIsPasswordConfigured);

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
          return normalizeSiteConfig(parsed, DEFAULT_CONFIG);
        }
      } catch (e) {
        console.warn("[CONFIG] Could not load persisted configuration:", e);
      }
    }
    return DEFAULT_CONFIG;
  });

  const [isCustomized, setIsCustomized] = useState<boolean>(Boolean(initialConfig));
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Track configuration as persisted on the server/database
  const [deployedConfig, setDeployedConfig] = useState<SiteConfigState>(() => {
    if (initialConfig) {
      return {
        ...initialConfig,
        accentColor: normalizeHex(initialConfig.accentColor),
      };
    }
    return DEFAULT_CONFIG;
  });

  const markAsDeployed = useCallback((cfg: SiteConfigState) => {
    setDeployedConfig({
      ...cfg,
      accentColor: normalizeHex(cfg.accentColor),
    });
  }, []);

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

    // Check browser localStorage for locally saved configurations
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<SiteConfigState>;
        const localCfg = normalizeSiteConfig(parsed, initialConfig || DEFAULT_CONFIG);
        setConfig(localCfg);
        setIsCustomized(true);
        syncSideEffects(localCfg);
      } else {
        syncSideEffects(config);
      }
    } catch {
      syncSideEffects(config);
    }

    // Only fetch /api/config if initialConfig or db status was not provided from server props
    if (initialConfig === undefined || propIsDbConfigured === undefined) {
      fetch("/api/config")
        .then((res) => res.json())
        .then((data) => {
          if (typeof data.isDbConfigured === "boolean") {
            setIsDb(data.isDbConfigured);
          }
          if (data?.config) {
            const normalized = normalizeSiteConfig(data.config, DEFAULT_CONFIG);
            setDeployedConfig(normalized);
          }
        })
        .catch(() => {});
    }
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
    return buildConfigTsCode(config);
  }, [config]);

  // Probe admin authentication status on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    fetch("/api/auth/status")
      .then((res) => {
        if (!res.ok) throw new Error(`Status HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (typeof data?.isAuthenticated === "boolean") {
          setIsAuthenticated(data.isAuthenticated);
        }
        const configured =
          typeof data?.isConfigured === "boolean"
            ? data.isConfigured
            : typeof data?.isPasswordConfigured === "boolean"
            ? data.isPasswordConfigured
            : undefined;
        if (typeof configured === "boolean") {
          setIsPasswordConfigured(configured);
        }
      })
      .catch((err) => {
        console.warn("[AUTH] Failed to probe auth status:", err);
        setIsAuthenticated(false);
      });
  }, []);

  const login = useCallback(
    async (password: string): Promise<{ success: boolean; error?: string }> => {
      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.success) {
          setIsAuthenticated(true);
          setIsPasswordConfigured(true);
          return { success: true };
        }
        setIsAuthenticated(false);
        return {
          success: false,
          error: typeof data?.error === "string" ? data.error : "Authentication failed.",
        };
      } catch (err: unknown) {
        setIsAuthenticated(false);
        return {
          success: false,
          error: err instanceof Error ? err.message : "Network error during authentication.",
        };
      }
    },
    []
  );

  const logout = useCallback(async (): Promise<void> => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
      });
    } catch (err: unknown) {
      console.warn("[AUTH] Logout error:", err);
    } finally {
      setIsAuthenticated(false);
    }
  }, []);

  const openModal = useCallback(() => setIsModalOpen(true), []);
  const closeModal = useCallback(() => setIsModalOpen(false), []);

  return (
    <ConfigContext.Provider
      value={{
        config,
        deployedConfig,
        markAsDeployed,
        updateConfig,
        resetToDefaults,
        applyAccentColorLive,
        generateConfigTsCode,
        isCustomized,
        isDbConfigured: isDb,
        isModalOpen,
        openModal,
        closeModal,
        isAuthenticated,
        isPasswordConfigured,
        login,
        logout,
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
