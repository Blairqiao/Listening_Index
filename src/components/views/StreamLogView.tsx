"use client";

import React from "react";
import { StreamLogItem } from "@/lib/types";
import { useConfig } from "@/context/ConfigContext";
import { presentStreamLog } from "@/lib/listening-presentation";
import { Artwork } from "../Artwork";

interface StreamLogViewProps {
  entries: StreamLogItem[];
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
  hasMore?: boolean;
  totalPlays?: string;
  isLoading?: boolean;
  onVisibleCountChange?: (count: number) => void;
}

export const StreamLogView: React.FC<StreamLogViewProps> = ({
  entries: rawEntries,
  onLoadMore,
  isLoadingMore = false,
  hasMore = false,
  totalPlays,
  isLoading = false,
  onVisibleCountChange,
}) => {
  const { visitorTimezone } = useConfig();
  const entries = React.useMemo(() => presentStreamLog(rawEntries, visitorTimezone), [rawEntries, visitorTimezone]);
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  const [isMobile, setIsMobile] = React.useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth < 768;
    }
    return false;
  });
  const [mobileVisibleCount, setMobileVisibleCount] = React.useState<number>(25);

  React.useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const prevEntriesLenRef = React.useRef(entries.length);
  React.useEffect(() => {
    if (entries.length > prevEntriesLenRef.current && prevEntriesLenRef.current > 0) {
      const diff = entries.length - prevEntriesLenRef.current;
      setMobileVisibleCount((prev) => {
        if (prev >= prevEntriesLenRef.current) {
          return prev + diff;
        }
        return prev;
      });
    } else if (entries.length === 0) {
      setMobileVisibleCount(25);
    }
    prevEntriesLenRef.current = entries.length;
  }, [entries.length]);

  const renderedEntries = isMobile ? entries.slice(0, mobileVisibleCount) : entries;
  const canLoadMore = hasMore || (isMobile && mobileVisibleCount < entries.length);

  React.useEffect(() => {
    onVisibleCountChange?.(renderedEntries.length);
  }, [renderedEntries.length, onVisibleCountChange]);

  const handleScrollToTop = () => {
    if (scrollContainerRef.current && scrollContainerRef.current.scrollTop > 0) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleLoadMore = () => {
    if (isLoadingMore) return;
    if (isMobile && mobileVisibleCount < entries.length) {
      setMobileVisibleCount((prev) => prev + 25);
    } else {
      onLoadMore?.();
    }
  };
  return (
    <div className="w-full mt-4 md:mt-6 select-none">
      {/* 1. Header Row (Placed outside scroll container) */}
      <div className="grid grid-cols-[58px_38px_minmax(0,1fr)_minmax(0,0.75fr)_40px] md:grid-cols-[58px_38px_minmax(0,1.15fr)_minmax(0,0.72fr)_minmax(0,1fr)_40px] gap-2.5 px-1 pb-2 border-b border-[#1C1C1A] text-[#5A5A55] font-mono text-[11px] tracking-[0.14em]">
        <span>TIME</span>
        <span>TITLE</span>
        <span></span>
        <span>ARTIST</span>
        <span className="hidden md:inline">ALBUM</span>
        <span className="text-right">DUR</span>
      </div>

      {/* 2. Scrollable Body Container (h-auto on mobile, fixed h-[544px] on desktop) */}
      <div
        ref={scrollContainerRef}
        className="w-full h-auto md:h-[544px] overflow-y-auto overflow-x-hidden scrollbar-hidden"
        role="list"
      >
        {entries.length === 0 ? (
          isLoading ? (
            Array.from({ length: 9 }).map((_, idx) => (
              <div
                key={idx}
                className="grid grid-cols-[58px_38px_minmax(0,1fr)_minmax(0,0.72fr)_40px] md:grid-cols-[58px_38px_minmax(0,1.15fr)_minmax(0,0.72fr)_minmax(0,1fr)_40px] gap-2.5 px-1 py-2 border-b border-[#191917] items-center animate-pulse"
              >
                <div className="h-3 bg-[#191917] rounded w-10" />
                <div className="w-[38px] h-[38px] rounded bg-[#141413]" />
                <div className="h-3.5 bg-[#191917] rounded w-32 max-w-[80%]" />
                <div className="h-3 bg-[#141413] rounded w-20 max-w-[75%]" />
                <div className="h-3 bg-[#141413] rounded w-24 max-w-[75%] hidden md:block" />
                <div className="h-3 bg-[#191917] rounded w-8 ml-auto" />
              </div>
            ))
          ) : (
            Array.from({ length: 9 }).map((_, idx) => (
              <div
                key={idx}
                className="h-[54px] border-b border-[#191917]"
              />
            ))
          )
        ) : (
          <>
            {renderedEntries.map((entry) => {
              const trackId = entry.trackId || entry.id;
              const isDelisted = entry.status === "[DELISTED]";

              return (
                <React.Fragment key={entry.id}>
                  {/* Day separator row if dayGroup changes */}
                  {entry.dayGroup && (
                    <div className="pt-3 pb-1.5 px-1 border-b border-[#1C1C1A] select-none">
                      <span className="font-mono text-[11px] tracking-[0.14em] text-[#5A5A55]">
                        {entry.dayGroup}
                      </span>
                    </div>
                  )}

                  {/* Session gap separator if time gap > 30 minutes */}
                  {entry.sessionGap && (
                    <div className="flex items-center gap-2.5 py-[9px] px-1 border-b border-[#191917] select-none">
                      <span className="font-mono text-[11px] tracking-[0.1em] text-[#4A4A46]">
                        ⌄ {entry.sessionGap.durationStr}
                      </span>
                      <span className="flex-1 h-[1px] bg-[#1C1C1A]" />
                      <span className="font-mono text-[11px] tracking-[0.1em] text-[#4A4A46]">
                        {entry.sessionGap.sessionGapLabel}
                      </span>
                    </div>
                  )}

                  {/* Data Row */}
                  <div
                    role="listitem"
                    onClick={() =>
                      window.open(
                        `https://open.spotify.com/track/${trackId}`,
                        "_blank",
                        "noopener,noreferrer"
                      )
                    }
                    className="group grid grid-cols-[58px_38px_minmax(0,1fr)_minmax(0,0.72fr)_40px] md:grid-cols-[58px_38px_minmax(0,1.15fr)_minmax(0,0.72fr)_minmax(0,1fr)_40px] gap-2.5 px-1 h-[54px] items-center hover:bg-[#111110] transition-none cursor-pointer border-b border-[#191917]"
                  >
                    {/* TIME (58px, mono 11px, no CDT) */}
                    <span className="font-mono text-[11px] text-[#5A5A55] tabular-nums select-none truncate">
                      {entry.timeStr}
                    </span>

                    {/* ARTWORK (38px square) */}
                    <Artwork
                      src={entry.albumImageUrl}
                      alt={entry.album || entry.title}
                      size={38}
                      swatchColor={entry.swatchColor}
                      isDelisted={isDelisted}
                    />

                    {/* TITLE (1.15fr, Space Grotesk 14px) */}
                    <div className="min-w-0 truncate">
                      <a
                        href={`https://open.spotify.com/track/${trackId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="block font-sans text-[14px] tracking-[-0.01em] text-[#EDEDE8] group-hover:text-music-accent truncate leading-snug no-underline transition-none select-none"
                      >
                        {entry.title}
                      </a>
                    </div>

                    {/* ARTIST (0.72fr, mono 11px) */}
                    <div className="min-w-0 truncate">
                      {entry.artistId ? (
                        <a
                          href={`https://open.spotify.com/artist/${entry.artistId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="font-mono text-[11px] text-[#6A6A64] hover:text-[#EDEDE8] hover:underline hover:decoration-dotted truncate leading-tight no-underline transition-none select-none"
                        >
                          {entry.artist}
                        </a>
                      ) : (
                        <span className="font-mono text-[11px] text-[#6A6A64] truncate leading-tight select-none">
                          {entry.artist}
                        </span>
                      )}
                    </div>

                    {/* ALBUM (1fr, mono 11px) */}
                    <div className="min-w-0 truncate hidden md:block">
                      {entry.albumId ? (
                        <a
                          href={`https://open.spotify.com/album/${entry.albumId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="font-mono text-[11px] text-[#6A6A64] hover:text-[#EDEDE8] hover:underline hover:decoration-dotted truncate leading-tight no-underline transition-none select-none"
                        >
                          {entry.album}
                        </a>
                      ) : (
                        <span className="font-mono text-[11px] text-[#6A6A64] truncate leading-tight select-none">
                          {entry.album}
                        </span>
                      )}
                    </div>

                    {/* DUR (40px, mono 11px, right-aligned) */}
                    <span className="font-mono text-[11px] text-[#8A8A83] tabular-nums text-right select-all">
                      {entry.duration}
                    </span>
                  </div>
                </React.Fragment>
              );
            })}

            {/* Bottom Pagination Controls or Terminal Genesis Record */}
            {canLoadMore ? (
              <div className="w-full py-5 px-1 select-none font-mono text-[11px] flex items-center gap-3">
                <span className="flex-1 h-[1px] bg-[#1C1C1A]" />
                <div className="inline-flex items-center gap-[4px]">
                  <button
                    type="button"
                    disabled={isLoadingMore}
                    onClick={handleLoadMore}
                    className={`group font-mono text-[11px] tracking-[0.1em] px-3.5 py-1.5 border border-[#26261F] hover:border-music-accent hover:text-music-accent text-[#8A8A83] bg-[#0A0A09] transition-none flex items-center gap-2 ${isLoadingMore ? "cursor-wait opacity-80" : "cursor-pointer"
                      }`}
                  >
                    <span className="md:hidden">
                      {isLoadingMore ? "Fetching plays..." : "Load 25 more plays"}
                    </span>
                    <span className="hidden md:inline">
                      {isLoadingMore ? "Fetching plays..." : "Load 50 more plays"}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={handleScrollToTop}
                    title="Scroll to top of stream log"
                    className="group font-mono text-[11px] px-2.5 py-1.5 border border-[#26261F] hover:border-music-accent hover:text-music-accent text-[#8A8A83] bg-[#0A0A09] transition-none cursor-pointer flex items-center justify-center"
                  >
                    ↑
                  </button>
                </div>
                <span className="flex-1 h-[1px] bg-[#1C1C1A]" />
              </div>
            ) : (
              <div className="w-full py-5 px-1 select-none font-mono text-[11px] flex items-center gap-3">
                <span className="flex-1 h-[1px] bg-[#1C1C1A]" />
                <div className="inline-flex items-center gap-[4px]">
                  <div className="font-mono text-[11px] tracking-[0.1em] px-3.5 py-1.5 border border-[#1C1C1A] text-[#4A4A46] bg-[#0A0A09] flex items-center gap-2">
                    <span>[ ALL {totalPlays || entries.length} HISTORICAL PLAYS ARCHIVED ]</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleScrollToTop}
                    title="Scroll to top of stream log"
                    className="group font-mono text-[11px] px-2.5 py-1.5 border border-[#26261F] hover:border-music-accent hover:text-music-accent text-[#8A8A83] bg-[#0A0A09] transition-none cursor-pointer flex items-center justify-center"
                  >
                    ↑
                  </button>
                </div>
                <span className="flex-1 h-[1px] bg-[#1C1C1A]" />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
