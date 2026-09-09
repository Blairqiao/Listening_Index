"use client";

import React from "react";
import { ExternalLink } from "lucide-react";
import { siteConfig } from "@/config";

export const ListeningHeader: React.FC = () => {
  return (
    <header className="flex items-baseline justify-between select-none pt-3 pb-2 sm:pt-6 md:pt-7 sm:pb-3 md:pb-4">
      <div className="flex items-baseline gap-3">
        <a
          href="/"
          className="group flex items-baseline gap-3 focus:outline-none cursor-pointer bg-transparent border-0 p-0 text-left no-underline"
        >
          <h1 className="font-sans text-[32px] sm:text-[42px] font-medium tracking-[-0.035em] text-[#EDEDE8] leading-none">
            {siteConfig.title}<span className="text-music-accent">.</span>
          </h1>
        </a>
      </div>
      <a
        href={siteConfig.siteUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="group inline-flex items-center gap-2 font-mono text-[13px] sm:text-[16px] tracking-[0.16em] text-[#5A5A55] hover:text-[#EDEDE8] transition-colors uppercase py-1 cursor-pointer bg-transparent border-0 no-underline"
      >
        <span>{siteConfig.ownerName.toUpperCase()}</span>
        <ExternalLink className="w-4 h-4 text-music-accent transition-transform mb-0.5" />
      </a>
    </header>
  );
};
