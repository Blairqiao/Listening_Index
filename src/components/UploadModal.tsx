"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  X,
  Upload,
  Check,
  AlertTriangle,
  FileArchive,
  Loader2,
  Lock,
  Eye,
  EyeOff,
  ShieldAlert,
} from "lucide-react";
import { extractAudioHistoryEntries, isAudioHistoryFilename } from "@/lib/zip-utils";
import { parseHistoryRecords, CompactPlayEvent } from "@/lib/history-parser";
import { useConfig } from "@/context/ConfigContext";

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete?: () => void;
  isDbConfigured: boolean;
}

interface EnrichmentProgress {
  pending: number;
  enriched: number;
  delisted: number;
  total: number;
}

type UploadStep = "idle" | "inspecting" | "stage1" | "completed" | "error";

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  onUploadComplete,
  isDbConfigured,
}) => {
  const { isAuthenticated, login, logout } = useConfig();

  const [step, setStep] = useState<UploadStep>("idle");
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");

  // Password challenge state
  const [passwordInput, setPasswordInput] = useState<string>("");
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // Ingestion Progress
  const [stage1Current, setStage1Current] = useState<number>(0);
  const [stage1Total, setStage1Total] = useState<number>(0);
  const [totalNewPlays, setTotalNewPlays] = useState<number>(0);

  // Overall Database Catalog Enrichment Status
  const [enrichmentProgress, setEnrichmentProgress] = useState<EnrichmentProgress | null>(null);

  const fetchEnrichmentProgress = useCallback(async () => {
    if (!isDbConfigured) return;
    try {
      const res = await fetch("/api/upload/enrich", { method: "GET" });
      if (res.ok) {
        const data = await res.json();
        if (data.progress) {
          setEnrichmentProgress(data.progress);
        }
      }
    } catch {
      // Ignore network errors
    }
  }, [isDbConfigured]);

  // Fetch catalog enrichment progress on modal open
  useEffect(() => {
    if (isOpen && isDbConfigured) {
      fetchEnrichmentProgress();
    }
  }, [isOpen, isDbConfigured, fetchEnrichmentProgress]);

  // Summary Metrics
  const [summary, setSummary] = useState<{
    totalPlays: number;
    newPlays: number;
  }>({
    totalPlays: 0,
    newPlays: 0,
  });

  const [isDragOver, setIsDragOver] = useState(false);
  const isProcessingRef = useRef(false);

  // Animation transition states
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isVisible, setIsVisible] = useState(isOpen);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isOpen) {
      setShouldRender(true);
      setIsVisible(true);
    } else {
      setIsVisible(false);
      timer = setTimeout(() => setShouldRender(false), 200);
    }
    return () => clearTimeout(timer);
  }, [isOpen]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isProcessingRef.current) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Reset password challenge state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setPasswordInput("");
      setAuthError(null);
      setShowPassword(false);
    }
  }, [isOpen]);

  const handleAuthenticate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!passwordInput.trim() || isAuthenticating) return;

    setIsAuthenticating(true);
    setAuthError(null);

    try {
      const res = await login(passwordInput);
      if (res.success) {
        setPasswordInput("");
        setAuthError(null);
        setStep("idle");
      } else {
        setAuthError(res.error || "Invalid administrator password");
      }
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setStep("idle");
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!isProcessingRef.current) setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (isProcessingRef.current) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      await processFiles(files);
    }
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      await processFiles(files);
      e.target.value = "";
    }
  };

  /**
   * Main File Ingestion: Ingests all qualified plays into PostgreSQL.
   * Completely decoupled from Spotify metadata enrichment.
   */
  const processFiles = async (files: File[]) => {
    isProcessingRef.current = true;
    setStep("inspecting");
    setStatusMessage("Inspecting uploaded files...");
    setErrorMessage("");
    setStage1Current(0);
    setStage1Total(0);
    setTotalNewPlays(0);

    try {
      const tasks: Array<{ name: string; getText: () => Promise<string> }> = [];

      for (const file of files) {
        if (file.name.toLowerCase().endsWith(".zip")) {
          setStatusMessage(`Decompressing archive: ${file.name}...`);
          const arrayBuffer = await file.arrayBuffer();
          const entries = await extractAudioHistoryEntries(arrayBuffer);
          for (const entry of entries) {
            tasks.push({
              name: entry.filename,
              getText: () => entry.readText(),
            });
          }
        } else if (file.name.toLowerCase().endsWith(".json")) {
          // Accept any non-hidden json file selected by the user
          if (isAudioHistoryFilename(file.name) || !file.name.startsWith(".")) {
            tasks.push({
              name: file.name,
              getText: () => file.text(),
            });
          }
        }
      }

      if (tasks.length === 0) {
        throw new Error(
          "No valid audio history files found. Upload your Spotify .zip export or JSON files starting with 'Streaming_History_Audio' or 'endsong_'."
        );
      }

      setStatusMessage(`Found ${tasks.length} history source file(s). Ingesting plays...`);
      setStep("stage1");

      let totalQualified = 0;
      let totalNew = 0;

      for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        setStatusMessage(`Reading ${task.name} (${i + 1}/${tasks.length})...`);
        const jsonText = await task.getText();

        let rawItems: any[];
        try {
          rawItems = JSON.parse(jsonText);
          if (!Array.isArray(rawItems)) {
            continue;
          }
        } catch {
          continue;
        }

        const plays = parseHistoryRecords(rawItems);
        totalQualified += plays.length;
        setStage1Total(totalQualified);

        // Stream plays in 1,000-item chunks
        const CHUNK_SIZE = 1000;
        for (let offset = 0; offset < plays.length; offset += CHUNK_SIZE) {
          const chunk = plays.slice(offset, offset + CHUNK_SIZE);
          setStatusMessage(
            `Ingesting plays from ${task.name}... (${offset + chunk.length}/${plays.length})`
          );

          const response = await fetch("/api/upload/history", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ plays: chunk }),
          });

          if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || `HTTP ${response.status} during ingestion`);
          }

          const resJson = await response.json();
          totalNew += resJson.newPlays || 0;
          setStage1Current((prev) => prev + chunk.length);
          setTotalNewPlays(totalNew);
        }
      }

      setSummary((s) => ({ ...s, totalPlays: totalQualified, newPlays: totalNew }));
      setStep("completed");
      setStatusMessage("All streaming history successfully uploaded to your database!");
      fetchEnrichmentProgress();
      onUploadComplete?.();
    } catch (err: unknown) {
      console.error("[UPLOAD ERROR]", err);
      setStep("error");
      setErrorMessage(err instanceof Error ? err.message : "Upload failed unexpectedly");
    } finally {
      isProcessingRef.current = false;
    }
  };

  const handleReset = () => {
    setStep("idle");
    setStatusMessage("");
    setErrorMessage("");
    setStage1Current(0);
    setStage1Total(0);
    setTotalNewPlays(0);
  };

  if (!shouldRender) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 transition-opacity duration-200 ${
        isVisible ? "opacity-100" : "opacity-0"
      }`}
      aria-modal="true"
      role="dialog"
    >
      {/* Dimmed backdrop */}
      <div
        className="fixed inset-0 bg-black/85 backdrop-blur-xs"
        onClick={() => {
          if (!isProcessingRef.current) onClose();
        }}
      />

      {/* Main Modal Window */}
      <div
        className={`relative z-10 w-full max-w-xl border border-[#26261F] bg-[#0A0A09] text-[#EDEDE8] shadow-2xl transition-transform duration-200 ${
          isVisible ? "scale-100" : "scale-95"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1C1C1A] px-5 py-3.5 select-none">
          <div className="flex items-center gap-2">
            <h2 className="font-mono text-[12px] uppercase tracking-[0.14em] text-[#EDEDE8]">
              [ IMPORT SPOTIFY STREAMING HISTORY ]
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {isAuthenticated && (
              <button
                type="button"
                onClick={handleLogout}
                disabled={isProcessingRef.current}
                title="Lock session"
                className="font-mono text-[10px] tracking-[0.08em] text-[#8A8A82] hover:text-music-accent px-2 py-1 border border-[#26261F] hover:border-amber-500/40 bg-transparent transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed select-none inline-flex items-center gap-1.5"
              >
                <Lock className="w-3 h-3" />
                <span>LOCK</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessingRef.current}
              className="text-[#6A6A64] hover:text-[#EDEDE8] transition-colors p-1 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              title="Close modal (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-5 font-mono text-[11px]">
          {/* Always-Visible Database Enrichment Status Bar */}
          {isDbConfigured && enrichmentProgress && (
            <div className="border border-[#1C1C1A] bg-[#0E0E0D] p-3.5 space-y-2">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-[#6A6A64] uppercase tracking-[0.08em] flex items-center gap-1.5 font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-music-accent" />
                  DATABASE ENRICHMENT STATUS
                </span>
                <span className="text-[#EDEDE8] font-bold">
                  {enrichmentProgress.total > 0
                    ? `${Math.round(
                        ((enrichmentProgress.enriched + enrichmentProgress.delisted) /
                          enrichmentProgress.total) *
                          100
                      )}%`
                    : "0%"}
                  {" "}
                  <span className="text-[#6A6A64] font-normal">
                    ({(enrichmentProgress.enriched + enrichmentProgress.delisted).toLocaleString()} / {enrichmentProgress.total.toLocaleString()} tracks)
                  </span>
                </span>
              </div>

              {/* Progress bar */}
              <div className="h-1.5 w-full bg-[#181816] border border-[#26261F] overflow-hidden">
                <div
                  className="h-full bg-music-accent transition-all duration-500 ease-out"
                  style={{
                    width: `${
                      enrichmentProgress.total > 0
                        ? Math.min(
                            100,
                            ((enrichmentProgress.enriched + enrichmentProgress.delisted) /
                              enrichmentProgress.total) *
                              100
                          )
                        : 0
                    }%`,
                  }}
                />
              </div>

              <div className="flex items-center justify-between text-[9.5px] text-[#6A6A64]">
                <span>
                  ENRICHED: <strong className="text-[#EDEDE8]">{enrichmentProgress.enriched.toLocaleString()}</strong>
                </span>
                <span>
                  STILL NEEDS ENRICHMENT: <strong className="text-amber-500">{enrichmentProgress.pending.toLocaleString()}</strong>
                </span>
                {enrichmentProgress.delisted > 0 && (
                  <span>
                    DELISTED: <strong className="text-[#A8A8A2]">{enrichmentProgress.delisted.toLocaleString()}</strong>
                  </span>
                )}
              </div>
            </div>
          )}

          {!isDbConfigured ? (
            /* Locked Gate State */
            <div className="border border-[#3A2222] bg-[#140D0D] p-4 text-[#FF7A7A] space-y-2">
              <div className="flex items-center gap-2 font-bold uppercase tracking-[0.08em]">
                <AlertTriangle className="w-4 h-4" />
                <span>Database Not Configured</span>
              </div>
              <p className="text-[11px] text-[#D49A9A] leading-relaxed">
                A connected PostgreSQL database (<code className="text-[#FFC4C4]">DATABASE_URL</code>) is
                required to store your streaming history.
              </p>
            </div>
          ) : !isAuthenticated ? (
            /* Unauthenticated Locked Gate (Variant C) */
            <div className="space-y-4">
              <div className="border border-[#26261F] bg-[#0F0F0E] p-5 sm:p-6 space-y-4">
                {/* Warning Banner */}
                <div className="border border-amber-500/30 bg-amber-500/5 p-4 space-y-1.5">
                  <div className="flex items-center gap-2 font-bold uppercase tracking-[0.08em] text-amber-400">
                    <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                    <span>[ PROTECTED REPOSITORY ACTION ]</span>
                  </div>
                  <p className="text-[11px] text-[#A8A8A2] leading-relaxed">
                    Only authorized administrators can ingest new stream events.
                  </p>
                </div>

                {/* Master Password Form */}
                <form onSubmit={handleAuthenticate} className="space-y-3">
                  <div>
                    <label
                      htmlFor="admin-master-password"
                      className="block font-mono text-[10px] uppercase tracking-[0.1em] text-[#8A8A82] mb-1.5"
                    >
                      ENTER PASSWORD
                    </label>
                    <div className="relative flex items-center bg-[#141413] border border-[#26261F] focus-within:border-music-accent transition-colors">
                      <input
                        id="admin-master-password"
                        type={showPassword ? "text" : "password"}
                        value={passwordInput}
                        onChange={(e) => {
                          setPasswordInput(e.target.value);
                          if (authError) setAuthError(null);
                        }}
                        placeholder="ENTER PASSWORD"
                        className="w-full bg-transparent border-0 text-[#EDEDE8] font-mono text-[12px] px-3 py-2 focus:outline-none placeholder:text-[#52524C]"
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="px-3 text-[#6A6A64] hover:text-[#EDEDE8] cursor-pointer focus:outline-none"
                        title={showPassword ? "Hide password" : "Show password"}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {authError && (
                    <div className="font-mono text-[10px] tracking-[0.06em] text-red-400 bg-red-500/10 border border-red-500/30 px-3 py-1.5">
                      [ {authError.toUpperCase()} ]
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isAuthenticating || !passwordInput.trim()}
                    className="w-full py-2.5 px-4 bg-music-accent text-black font-bold uppercase tracking-[0.08em] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer flex items-center justify-center gap-2 select-none"
                  >
                    {isAuthenticating ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>AUTHENTICATING...</span>
                      </>
                    ) : (
                      <span>AUTHENTICATE</span>
                    )}
                  </button>
                </form>
              </div>

              {/* Standard Spotify Export Instructions Below */}
              <div className="border border-[#1C1C1A] bg-[#0E0E0D] p-3 text-[#6A6A64] text-[10px] space-y-1.5">
                <div className="flex items-center gap-1.5 text-[#EDEDE8] font-bold uppercase tracking-[0.08em]">
                  <FileArchive className="w-3.5 h-3.5 text-music-accent" />
                  <span>How to request your export from Spotify</span>
                </div>
                <p>
                  1. Visit{" "}
                  <a
                    href="https://www.spotify.com/account/privacy/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-music-accent underline underline-offset-2 hover:opacity-80"
                  >
                    spotify.com/account/privacy
                  </a>
                  .
                </p>
                <p>
                  2. Select <strong className="text-[#EDEDE8]">Extended streaming history</strong> and
                  request download.
                </p>
                <p>
                  3. Upload the resulting <code className="text-music-accent">.zip</code> or JSON files directly above.
                </p>
              </div>
            </div>
          ) : step === "idle" ? (
            /* Idle Drag & Drop Zone */
            <div className="space-y-4">
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed p-8 sm:p-10 text-center transition-colors cursor-pointer flex flex-col items-center justify-center gap-3 select-none ${
                  isDragOver
                    ? "border-music-accent bg-music-accent/5 text-music-accent"
                    : "border-[#26261F] hover:border-[#3A3A32] bg-[#0F0F0E]"
                }`}
                onClick={() => document.getElementById("spotify-history-input")?.click()}
              >
                <input
                  id="spotify-history-input"
                  type="file"
                  multiple
                  accept=".zip,.json"
                  className="hidden"
                  onChange={handleFileInput}
                />
                <div className="w-10 h-10 border border-[#26261F] flex items-center justify-center bg-[#141413]">
                  <Upload className="w-5 h-5 text-music-accent" />
                </div>
                <div>
                  <p className="text-[12px] font-bold text-[#EDEDE8] uppercase tracking-[0.08em]">
                    Click or drop Spotify history files here
                  </p>
                  <p className="text-[#6A6A64] text-[10px] mt-1">
                    Accepts official Spotify export <code className="text-[#A8A8A2]">.zip</code> or raw{" "}
                    <code className="text-[#A8A8A2]">Streaming_History_Audio_*.json</code> files
                  </p>
                </div>
              </div>

              {/* Instructions */}
              <div className="border border-[#1C1C1A] bg-[#0E0E0D] p-3 text-[#6A6A64] text-[10px] space-y-1.5">
                <div className="flex items-center gap-1.5 text-[#EDEDE8] font-bold uppercase tracking-[0.08em]">
                  <FileArchive className="w-3.5 h-3.5 text-music-accent" />
                  <span>How to request your export from Spotify</span>
                </div>
                <p>
                  1. Visit{" "}
                  <a
                    href="https://www.spotify.com/account/privacy/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-music-accent underline underline-offset-2 hover:opacity-80"
                  >
                    spotify.com/account/privacy
                  </a>
                  .
                </p>
                <p>
                  2. Select <strong className="text-[#EDEDE8]">Extended streaming history</strong> and
                  request download.
                </p>
                <p>
                  3. Upload the resulting <code className="text-music-accent">.zip</code> or JSON files directly above.
                </p>
              </div>
            </div>
          ) : step === "inspecting" || step === "stage1" ? (
            /* Upload & Ingestion Progress State */
            <div className="space-y-5 py-2">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-music-accent animate-spin flex-none" />
                <div className="space-y-1 overflow-hidden">
                  <div className="flex items-center gap-2">
                    <span className="text-music-accent font-bold uppercase tracking-[0.08em]">
                      {step === "inspecting"
                        ? "[ DECOMPRESSING ARCHIVE ]"
                        : "[ INGESTING PLAYS INTO DATABASE ]"}
                    </span>
                  </div>
                  <p className="text-[#A8A8A2] text-[11px] truncate">{statusMessage}</p>
                </div>
              </div>

              {/* Ingestion Progress Bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[10px] text-[#6A6A64]">
                  <span>RAW INGESTION (QUALIFIED &ge; 30S)</span>
                  <span>
                    {stage1Total > 0
                      ? `${Math.round((stage1Current / stage1Total) * 100)}% (${stage1Current}/${stage1Total})`
                      : "--"}
                  </span>
                </div>
                <div className="h-2 w-full bg-[#181816] border border-[#26261F] overflow-hidden">
                  <div
                    className="h-full bg-music-accent transition-all duration-300 ease-out"
                    style={{
                      width: `${stage1Total > 0 ? Math.min(100, (stage1Current / stage1Total) * 100) : 0}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          ) : step === "completed" ? (
            /* Completed State */
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-2.5 text-music-accent font-bold uppercase tracking-[0.08em]">
                <Check className="w-5 h-5" />
                <span>Upload Successful</span>
              </div>

              <div className="grid grid-cols-3 gap-2 border border-[#1C1C1A] bg-[#0E0E0D] p-3 text-[11px]">
                <div>
                  <span className="text-[#6A6A64] block text-[10px]">QUALIFIED PLAYS</span>
                  <span className="text-[#EDEDE8] font-bold text-[14px]">
                    {summary.totalPlays.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-[#6A6A64] block text-[10px]">NEW PLAYS ADDED</span>
                  <span className="text-music-accent font-bold text-[14px]">
                    {summary.newPlays.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-[#6A6A64] block text-[10px]">DUPLICATES SKIPPED</span>
                  <span className="text-[#A8A8A2] font-bold text-[14px]">
                    {Math.max(0, summary.totalPlays - summary.newPlays).toLocaleString()}
                  </span>
                </div>
              </div>

              <p className="text-[#A8A8A2] text-[11px] leading-relaxed">
                All qualified stream events are saved in your database and immediately active on your dashboard.
                Album artwork and track metadata will enrich automatically in the background and as you browse.
              </p>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-music-accent text-black font-bold uppercase tracking-[0.08em] hover:opacity-90 transition-opacity cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>View Dashboard</span>
                </button>
              </div>
            </div>
          ) : (
            /* Error State */
            <div className="space-y-3 py-2">
              <div className="flex items-center gap-2 text-[#FF7A7A] font-bold uppercase tracking-[0.08em]">
                <AlertTriangle className="w-5 h-5" />
                <span>Upload Failed</span>
              </div>
              <div className="border border-[#3A2222] bg-[#140D0D] p-3 text-[#FFB3B3] text-[11px] break-words">
                {errorMessage}
              </div>
              <button
                type="button"
                onClick={handleReset}
                className="w-full py-2 border border-[#3A3A32] bg-[#1A1A18] text-[#EDEDE8] hover:border-music-accent hover:text-music-accent transition-colors uppercase tracking-[0.08em] cursor-pointer"
              >
                Try Again
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[#1C1C1A] px-5 py-3 select-none text-[10px] text-[#5A5A55]">
          <span>FORMAT: EXTENDED HISTORY (.ZIP / .JSON)</span>
          <span>KEY [U] TOGGLE MODAL</span>
        </div>
      </div>
    </div>
  );
};
