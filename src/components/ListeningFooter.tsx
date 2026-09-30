"use client";

import React from "react";
import { Mode } from "@/lib/mock-listening-data";

interface ListeningFooterProps {
  mode: Mode;
  isLive: boolean;
  syncedAgo: string;
  isSyncing?: boolean;
  onTriggerSync?: () => void;
}

export const ListeningFooter: React.FC<ListeningFooterProps> = ({
  mode,
  isLive,
  syncedAgo,
  isSyncing = false,
  onTriggerSync,
}) => {
  return (
    <footer className="h-10 sm:h-11 md:h-12 flex items-center justify-between border-t border-[#1C1C1A] bg-[#080808] select-none mt-4 md:mt-3">
      {/* Keyboard Shortcuts Hint */}
      <span className="hidden sm:inline font-mono text-[11px] tracking-[0.14em] text-[#5A5A55]">
        {mode === 0 ? "KEYS [1-4] VIEW / [←→] RANGE" : "KEYS [1-4] VIEW"}
      </span>

      {/* System Telemetry Status (Clickable manual sync on [ SYNCED X AGO ]) */}
      <div className="flex items-center font-mono text-[11px]">
        <button
          type="button"
          onClick={onTriggerSync}
          disabled={isSyncing}
          title="Click to trigger manual Spotify sync"
          onMouseDown={(e) => e.preventDefault()}
          className={`bg-transparent border-0 p-0 transition-none focus:outline-none focus-visible:outline-none hover:text-[#EDEDE8] ${
            isSyncing
              ? "text-music-accent cursor-wait"
              : isLive
              ? "text-music-accent cursor-pointer"
              : "text-[#5A5A55] cursor-pointer"
          }`}
        >
          {isSyncing ? (
            <span className="tracking-[0.08em]">[ SYNCING... ]</span>
          ) : isLive ? (
            <>
              <span className="sm:hidden tracking-[0.08em] uppercase">[ ▪ LIVE ]</span>
              <span className="hidden sm:inline tracking-[0.08em] uppercase">[ ▪ LIVE · SYNCED {syncedAgo} ]</span>
            </>
          ) : (
            <span className="tracking-[0.08em] uppercase">[ SYNCED {syncedAgo} ]</span>
          )}
        </button>
      </div>
    </footer>
  );
};
