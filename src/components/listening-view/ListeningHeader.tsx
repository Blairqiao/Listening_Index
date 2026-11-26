"use client";

import React from "react";
import { ExternalLink } from "lucide-react";
import { useConfig } from "@/context/ConfigContext";

interface ListeningHeaderProps {
  syncError?: string | null;
}

export const ListeningHeader: React.FC<ListeningHeaderProps> = ({ syncError }) => {
  const { config } = useConfig();

  return (
    <header className="flex items-baseline justify-between select-none pt-3 pb-2 sm:pt-6 md:pt-7 sm:pb-3 md:pb-4">
      <div className="flex items-baseline gap-3">
        <a
          href={config.githubUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-baseline gap-3 focus-ring cursor-pointer bg-transparent border-0 p-0 text-left no-underline"
        >
          <h1 className="font-display text-[28px] sm:text-[38px] font-medium tracking-[-0.05em] text-[#EDEDE8] leading-none">
            {config.title}<span className="text-music-accent">.</span>
          </h1>
        </a>
        {syncError && (
          <span className="font-mono text-[11px] text-[#FF6B6B]">
            {syncError}
          </span>
        )}
      </div>

      {/* Owner Profile / External Link */}
      <a
        href={config.siteUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="group focus-ring inline-flex items-center gap-2 font-mono text-[13px] sm:text-[16px] text-[#5A5A55] hover:text-[#EDEDE8] motion-hover py-1 cursor-pointer bg-transparent border-0 no-underline"
      >
        <span>{config.ownerName}</span>
        <ExternalLink className="w-4 h-4 text-music-accent transition-transform mb-0.5" />
      </a>
    </header>
  );
};

