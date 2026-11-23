"use client";

import React from "react";

export interface SyncStatusProps {
  isLive: boolean;
  syncedAgo: string;
  isSyncing?: boolean;
  isAuthenticated?: boolean;
  onTriggerSync?: () => void;
  /** Always use the short label (the mini-player's phone layout). */
  compact?: boolean;
}

/** "▪ Live · synced 3m ago". The owner can click it to sync now. */
export const SyncStatus: React.FC<SyncStatusProps> = ({
  isLive,
  syncedAgo,
  isSyncing = false,
  isAuthenticated = false,
  onTriggerSync,
  compact = false,
}) => {
  const label = isLive ? (
    compact ? (
      <span>▪ Live</span>
    ) : (
      <>
        <span className="sm:hidden">▪ Live</span>
        <span className="hidden sm:inline">▪ Live · synced {syncedAgo}</span>
      </>
    )
  ) : (
    <span>Synced {syncedAgo}</span>
  );

  if (!isAuthenticated) {
    return (
      <span className={`shrink-0 whitespace-nowrap ${isLive ? "text-music-accent" : "text-[#5A5A55]"}`}>
        {label}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onTriggerSync}
      disabled={isSyncing}
      title="Click to trigger manual Spotify sync"
      onMouseDown={(e) => e.preventDefault()}
      className={`bg-transparent border-0 p-0 font-mono text-[12px] transition-none focus:outline-none focus-visible:outline-none hover:text-[#EDEDE8] shrink-0 whitespace-nowrap ${
        isSyncing
          ? "text-music-accent cursor-wait"
          : isLive
          ? "text-music-accent cursor-pointer"
          : "text-[#5A5A55] cursor-pointer"
      }`}
    >
      {isSyncing ? <span>Syncing...</span> : label}
    </button>
  );
};
