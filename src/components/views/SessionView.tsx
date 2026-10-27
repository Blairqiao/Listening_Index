"use client";

import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import type { SessionRecord, SessionAnalysis, PreviousSession } from "@/lib/types";
import { useConfig } from "@/context/ConfigContext";
import { presentSession, presentSessionHistogram, type PresentedSessionItem } from "@/lib/listening-presentation";
import { calculateSessions } from "@/lib/session-calculation";
import { Artwork } from "../Artwork";
import { SessionHistogram } from "../session-view/SessionHistogram";
import { SessionAnalysisPanel } from "../session-view/SessionAnalysisPanel";

interface SessionViewProps {
  sessions: SessionRecord[];
  onSelectSession?: (sessionId: string) => void;
  selectedSessionId?: string;
}

export const SessionView: React.FC<SessionViewProps> = ({
  sessions,
  onSelectSession,
  selectedSessionId: externalSelectedSessionId,
}) => {
  const { visitorTimezone } = useConfig();
  const sittings = useMemo(() => sessions.map(session => presentSession(session, visitorTimezone)), [sessions, visitorTimezone]);
  const histogram = useMemo(() => presentSessionHistogram(sessions, visitorTimezone), [sessions, visitorTimezone]);
  const onSelect = onSelectSession;
  const selectedSessionId = externalSelectedSessionId || sittings[0]?.id;
  const selectedSessionIdValue = selectedSessionId;
  const isOpen = sittings[0]?.isOpen || false;

  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth < 768;
    }
    return false;
  });
  const [isTracksExpanded, setIsTracksExpanded] = useState(false);
  const [isSessionsExpanded, setIsSessionsExpanded] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Track list container ref to dynamically measure height and fill exact placeholder slots
  const listRef = useRef<HTMLDivElement>(null);
  const [slotCount, setSlotCount] = useState<number>(10);

  useEffect(() => {
    if (!listRef.current) return;
    const updateSlots = () => {
      if (listRef.current) {
        const height = listRef.current.clientHeight;
        const slots = Math.max(10, Math.floor(height / 54));
        setSlotCount(slots);
      }
    };
    updateSlots();
    const observer = new ResizeObserver(updateSlots);
    observer.observe(listRef.current);
    return () => observer.disconnect();
  }, []);

  // Handle selecting a session (from previous sessions or histogram bars)
  const handleSelectSession = useCallback(
    (id: string) => {
      onSelect?.(id);
    },
    [onSelect]
  );

  // Active session lookup
  const activeSession = useMemo(() => {
    return sittings.find((s) => s.id === selectedSessionId) || sittings[0];
  }, [sittings, selectedSessionId]);

  // Tracks for active session
  const activeTracks: PresentedSessionItem[] = useMemo(() => {
    if (activeSession && activeSession.tracks) {
      return activeSession.tracks;
    }
    return [];
  }, [activeSession]);

  const visibleTracks = isMobile && !isTracksExpanded ? activeTracks.slice(0, 6) : activeTracks;

  const analysis: SessionAnalysis = useMemo(() => {
    return calculateSessions(activeTracks.map(track => ({ ...track, id: track.playId, trackId: track.id })))[0]?.analysis || {
      firstPlaysCount: 0, totalTracks: 0, topTrack: null,
      topAlbum: { title: "None", count: 0 }, topArtist: { name: "None", count: 0 },
    };
  }, [activeTracks]);

  const sitsList: PreviousSession[] = useMemo(() => sittings.slice(0, 20).map(session => ({
    id: session.id, dateStr: session.dateStr, durationStr: session.runtimeStr,
    tracksCountStr: `${session.trackCount} ${session.trackCount === 1 ? "track" : "tracks"}`,
    runtimeMinutes: session.runtimeMinutes, trackCount: session.trackCount,
  })), [sittings]);

  const visibleSits = isMobile && !isSessionsExpanded ? sitsList.slice(0, 5) : sitsList;

  // Placeholder rows count (at least slotCount rows total)
  const placeholderCount = Math.max(0, slotCount - activeTracks.length);

  return (
    <div className="w-full mt-4 md:mt-6 select-none">
      {/* 2-Column Main Band: Left 1.5fr / Right 1fr */}
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-4 md:gap-[26px]">
        {/* Left Column: Track list */}
        <div className="min-w-0">
          <div className="flex justify-between items-baseline mb-2 select-none">
            <span className="font-mono text-[11px] tracking-[0.14em] text-[#5A5A55]">
              {isOpen ? "[ CURRENT SESSION ]" : "[ LAST SESSION ]"}
            </span>
            <span className="font-mono text-[11px] tracking-[0.14em] text-[#5A5A55] uppercase">
              {activeTracks.length} {activeTracks.length === 1 ? "TRACK" : "TRACKS"}
            </span>
          </div>

          {/* Locked Relative-Height Scroll Container on Desktop, Natural Height on Mobile */}
          <div
            ref={listRef}
            className="h-auto md:h-[550px] overflow-y-auto scrollbar-hidden"
            role="list"
          >
            {/* Active Session Track Rows */}
            {visibleTracks.map((track, idx) => {
              const isSpotifyTrackId = track.id && !track.id.startsWith("tr-");
              const trackHref = isSpotifyTrackId
                ? `https://open.spotify.com/track/${track.id}`
                : `https://open.spotify.com/search/${encodeURIComponent(`${track.title} ${track.artist}`)}`;

              const artistHref = track.artistId
                ? `https://open.spotify.com/artist/${track.artistId}`
                : `https://open.spotify.com/search/${encodeURIComponent(track.artist)}`;

              const albumHref = track.albumId
                ? `https://open.spotify.com/album/${track.albumId}`
                : track.album
                  ? `https://open.spotify.com/search/${encodeURIComponent(track.album)}`
                  : undefined;

              return (
                <div
                  key={`${track.id}-${idx}`}
                  role="listitem"
                  onClick={() => {
                    window.open(trackHref, "_blank", "noopener,noreferrer");
                  }}
                  className="group flex items-center gap-2.5 px-1 h-[54px] md:h-[55px] border-b border-[#191917] hover:bg-[#111110] transition-none cursor-pointer"
                >
                  {/* 1. Timestamp (44px, mono 11px, #5A5A55) */}
                  <span className="font-mono text-[11px] text-[#5A5A55] tabular-nums select-none truncate w-[44px] flex-none">
                    {track.timestamp}
                  </span>

                  {/* 2. First-Play Marker (14px, text-music-accent '+', or empty) */}
                  <span className="w-[14px] text-center font-mono text-[11px] text-music-accent select-none flex-none">
                    {track.isFirstPlay ? "+" : ""}
                  </span>

                  {/* 3. Album Art (38px square) */}
                  <Artwork
                    src={track.albumImageUrl}
                    alt={track.album || track.title}
                    size={38}
                    swatchColor={track.swatchColor}
                  />

                  {/* 4. Middle: Stacked Title & (Artist • Album) */}
                  <div className="min-w-0 flex-1 pl-1">
                    <a
                      href={trackHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="block font-sans text-[14px] tracking-[-0.01em] text-[#EDEDE8] truncate group-hover:text-music-accent transition-none leading-snug no-underline select-none"
                    >
                      {track.title}
                    </a>
                    <div className="font-mono text-[11.5px] text-[#6A6A64] truncate leading-tight mt-0.5 select-none">
                      <a
                        href={artistHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="hover:text-[#EDEDE8] hover:underline hover:decoration-dotted no-underline text-inherit"
                      >
                        {track.artist}
                      </a>
                      {track.album && (
                        <>
                          {" • "}
                          {albumHref ? (
                            <a
                              href={albumHref}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="hover:text-[#EDEDE8] hover:underline hover:decoration-dotted no-underline text-inherit"
                            >
                              {track.album}
                            </a>
                          ) : (
                            <span>{track.album}</span>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* 5. Duration (mono 11px #8A8A83, right-aligned) */}
                  <span className="font-mono text-[11px] text-[#8A8A83] text-right tabular-nums select-none flex-none w-[40px]">
                    {track.duration || "--:--"}
                  </span>
                </div>
              );
            })}

            {/* Placeholder Rows to fill remaining capacity (54px/55px height, hidden on mobile unless zero tracks) */}
            {Array.from({ length: placeholderCount }).map((_, idx) => (
              <div
                key={`ph-${idx}`}
                className={`${activeTracks.length === 0 ? "flex" : "hidden md:flex"} h-[54px] md:h-[55px] border-b border-[#191917] items-center px-1 select-none`}
                aria-hidden="true"
              />
            ))}
          </div>

          {activeTracks.length > 6 && (
            <button
              type="button"
              onClick={() => setIsTracksExpanded((prev) => !prev)}
              className="md:hidden w-full py-1.5 flex items-center justify-center font-mono text-[10px] tracking-[0.12em] text-[#5A5A55] hover:text-[#8A8A83] transition-colors cursor-pointer select-none"
            >
              {isTracksExpanded ? "SHOW LESS ⌃" : `SHOW ALL ${activeTracks.length} TRACKS ⌄`}
            </button>
          )}
        </div>

        {/* Right Column: Analysis + Previous Sessions + Histogram */}
        <div className="flex flex-col gap-4 md:gap-0 md:justify-between h-full min-w-0">
          {/* Analysis Panel */}
          <SessionAnalysisPanel analysis={analysis} />

          {/* Previous Sessions Panel */}
          <div>
            <span className="font-mono text-[11px] tracking-[0.14em] text-[#5A5A55] block mb-2 select-none">
              [ PREVIOUS SESSIONS ]
            </span>

            <div
              className="h-auto md:h-[180px] overflow-y-auto scrollbar-hidden"
              role="list"
            >
              {visibleSits.map((sitting, idx) => {
                const sessionId = sitting.id || `s${idx + 1}`;
                const isSelected = sessionId === selectedSessionIdValue;
                const rawCount = sitting.tracksCountStr
                  .replace(" tracks", "")
                  .replace(" track", "");

                return (
                  <div
                    key={`${sitting.dateStr}-${idx}`}
                    role="listitem"
                    tabIndex={0}
                    onClick={() => handleSelectSession(sessionId)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleSelectSession(sessionId);
                      }
                    }}
                    className={`grid grid-cols-[52px_minmax(0,1fr)_28px] gap-2 items-baseline px-1 py-[7px] border-b border-[#191917] cursor-pointer transition-none select-none focus:outline-none ${isSelected
                        ? "bg-[#181614] border-l-2 border-l-music-accent pl-2 -ml-[2px]"
                        : "hover:bg-[#111110]"
                      }`}
                  >
                    {/* Date (mono 11px, #4A4A46) */}
                    <span className="font-mono text-[11px] text-[#4A4A46] tabular-nums select-none">
                      {sitting.dateStr}
                    </span>

                    {/* Runtime (Space Grotesk 13px, text-music-accent when selected) */}
                    <span
                      className={`font-sans text-[13px] truncate select-none ${isSelected ? "text-music-accent font-medium" : "text-[#EDEDE8]"
                        }`}
                    >
                      {sitting.durationStr}
                    </span>

                    {/* Count (mono 11px #8A8A83, right-aligned) */}
                    <span className="font-mono text-[11px] text-[#8A8A83] text-right tabular-nums select-none">
                      {rawCount}
                    </span>
                  </div>
                );
              })}
            </div>

            {sitsList.length > 5 && (
              <button
                type="button"
                onClick={() => setIsSessionsExpanded((prev) => !prev)}
                className="md:hidden w-full py-2 flex items-center justify-center font-mono text-[10px] tracking-[0.12em] text-[#5A5A55] hover:text-[#8A8A83] transition-colors cursor-pointer select-none"
              >
                {isSessionsExpanded ? "SHOW LESS ⌃" : `SHOW ALL ${sitsList.length} SESSIONS ⌄`}
              </button>
            )}
          </div>

          {/* Sessions Histogram */}
          <SessionHistogram
            histogram={histogram}
            selectedSessionId={selectedSessionId}
            onSelectSession={handleSelectSession}
          />
        </div>
      </div>
    </div>
  );
};
