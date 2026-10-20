"use client";

import React from "react";

export interface EnrichmentProgress {
  pending: number;
  enriched: number;
  delisted: number;
  total: number;
}

export interface CatalogEnrichmentCardProps {
  progress: EnrichmentProgress;
}

export const CatalogEnrichmentCard: React.FC<CatalogEnrichmentCardProps> = ({ progress }) => {
  const percentage = progress.total > 0
    ? Math.round(((progress.enriched + progress.delisted) / progress.total) * 100)
    : 0;

  const barWidth = progress.total > 0
    ? Math.min(100, ((progress.enriched + progress.delisted) / progress.total) * 100)
    : 0;

  return (
    <div className="border border-[#1C1C1A] bg-[#0E0E0D] p-3.5 space-y-2">
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-[#6A6A64] uppercase tracking-[0.08em] flex items-center gap-1.5 font-bold">
          <span className="w-1.5 h-1.5 rounded-full bg-music-accent" />
          DATABASE ENRICHMENT STATUS
        </span>
        <span className="text-[#EDEDE8] font-bold">
          {percentage}%{" "}
          <span className="text-[#6A6A64] font-normal">
            ({(progress.enriched + progress.delisted).toLocaleString()} / {progress.total.toLocaleString()} tracks)
          </span>
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 w-full bg-[#181816] border border-[#26261F] overflow-hidden">
        <div
          className="h-full bg-music-accent transition-all duration-500 ease-out"
          style={{ width: `${barWidth}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-[9.5px] text-[#6A6A64]">
        <span>
          ENRICHED: <strong className="text-[#EDEDE8]">{progress.enriched.toLocaleString()}</strong>
        </span>
        <span>
          STILL NEEDS ENRICHMENT: <strong className="text-amber-500">{progress.pending.toLocaleString()}</strong>
        </span>
        {progress.delisted > 0 && (
          <span>
            DELISTED: <strong className="text-[#A8A8A2]">{progress.delisted.toLocaleString()}</strong>
          </span>
        )}
      </div>
    </div>
  );
};
