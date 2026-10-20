"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  X,
  Check,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { extractAudioHistoryEntries, isAudioHistoryFilename } from "@/lib/zip-utils";
import { parseHistoryRecords } from "@/lib/history-parser";
import {
  CatalogEnrichmentCard,
  EnrichmentProgress,
} from "./upload-modal/CatalogEnrichmentCard";
import { HistoryDropzone } from "./upload-modal/HistoryDropzone";

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete?: () => void;
  onProcessingChange?: (isProcessing: boolean) => void;
  isDbConfigured: boolean;
}

type UploadStep = "idle" | "inspecting" | "stage1" | "completed" | "error";

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  onUploadComplete,
  onProcessingChange,
  isDbConfigured,
}) => {
  const [step, setStep] = useState<UploadStep>("idle");
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");

  // Ingestion Progress
  const [stage1Current, setStage1Current] = useState<number>(0);
  const [stage1Total, setStage1Total] = useState<number>(0);
  // const [totalNewPlays, setTotalNewPlays] = useState<number>(0);

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

  /**
   * Main File Ingestion: Ingests all qualified plays into PostgreSQL.
   * Completely decoupled from Spotify metadata enrichment.
   */
  const processFiles = async (files: File[]) => {
    isProcessingRef.current = true;
    if (onProcessingChange) onProcessingChange(true);
    setStep("inspecting");
    setStatusMessage("Inspecting uploaded files...");
    setErrorMessage("");
    setStage1Current(0);
    setStage1Total(0);
    // setTotalNewPlays(0);

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

        let rawItems: { [key: string]: unknown }[];
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
          // setTotalNewPlays(totalNew);
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
      if (onProcessingChange) onProcessingChange(false);
    }
  };

  const handleReset = () => {
    setStep("idle");
    setStatusMessage("");
    setErrorMessage("");
    setStage1Current(0);
    setStage1Total(0);
    // setTotalNewPlays(0);
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
            <CatalogEnrichmentCard progress={enrichmentProgress} />
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
          ) : step === "idle" ? (
            /* Idle Drag & Drop Zone */
            <HistoryDropzone
              onFilesSelected={processFiles}
              isProcessing={isProcessingRef.current}
            />
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
