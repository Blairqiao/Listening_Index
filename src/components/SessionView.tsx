"use client";

import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  SittingItem,
  PreviousSitting,
  SittingSession,
  SessionHistogramData,
  SittingAnalysis,
} from "@/lib/mock-listening-data";
import { Artwork } from "./Artwork";
import { useDeferredEnrichment } from "@/lib/hooks/useDeferredEnrichment";

interface SessionViewProps {
  isOpen: boolean;
  sittingTracks?: SittingItem[];
  sessionTracks?: SittingItem[];
  previousSittings?: PreviousSitting[];
  previousSessions?: PreviousSitting[];
  sittings?: SittingSession[];
  sessions?: SittingSession[];
  histogram?: SessionHistogramData;
  onSelectSitting?: (sittingId: string) => void;
  onSelectSession?: (sessionId: string) => void;
  selectedSittingId?: string;
  selectedSessionId?: string;
}

const DEFAULT_HISTOGRAM: SessionHistogramData = {
  avgRuntimeMinutes: 0,
  oldestDate: "--",
  newestDate: "--",
  bars: [],
};

export const SessionView: React.FC<SessionViewProps> = ({
  isOpen,
  sittingTracks,
  sessionTracks,
  previousSittings: rawPreviousSittings,
  previousSessions: rawPreviousSessions,
  sittings: rawSittings,
  sessions: rawSessions,
  histogram,
  onSelectSitting,
  onSelectSession,
  selectedSittingId: externalSelectedSittingId,
  selectedSessionId: externalSelectedSessionIdProp,
}) => {
  const effectiveSessionTracks = sessionTracks || sittingTracks || [];
  const previousSittings = rawPreviousSessions || rawPreviousSittings || [];
  const sittings = rawSessions || rawSittings || [];
  const onSelect = onSelectSession || onSelectSitting;
  const externalSelectedSessionId = externalSelectedSessionIdProp ?? externalSelectedSittingId;

  // Determine initial selected session ID
  const initialId =
    externalSelectedSessionId ||
    sittings[0]?.id ||
    previousSittings[0]?.id ||
    "s1";

  const [internalSelectedSessionId, setInternalSelectedSessionId] = useState<string>(initialId);
  const [hoveredSittingId, setHoveredSittingId] = useState<string | null>(null);

  const selectedSessionId = externalSelectedSessionId ?? internalSelectedSessionId;
  const selectedSittingId = selectedSessionId;

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
  const handleSelectSitting = useCallback(
    (id: string) => {
      setInternalSelectedSessionId(id);
      onSelect?.(id);
    },
    [onSelect]
  );

  // Local enrichment overlay for dynamically loaded artwork and IDs
  const [enrichmentOverlay, setEnrichmentOverlay] = useState<
    Map<string, { albumImageUrl: string | null; artistId?: string; albumId?: string; isDelisted?: boolean }>
  >(new Map());

  // Active session lookup
  const activeSession = useMemo(() => {
    return sittings.find((s) => s.id === selectedSessionId) || sittings[0];
  }, [sittings, selectedSessionId]);

  // Raw tracks for active session
  const rawActiveTracks: SittingItem[] = useMemo(() => {
    if (activeSession && activeSession.tracks) {
      return activeSession.tracks;
    }
    return effectiveSessionTracks;
  }, [activeSession, effectiveSessionTracks]);

  // Merge activeTracks with local enrichment overlay
  const activeTracks: SittingItem[] = useMemo(() => {
    if (enrichmentOverlay.size === 0) return rawActiveTracks;
    return rawActiveTracks.map((track) => {
      const trackId = track.id;
      const overlay = enrichmentOverlay.get(trackId);
      if (!overlay) return track;
      return {
        ...track,
        albumImageUrl: overlay.albumImageUrl !== undefined ? overlay.albumImageUrl : track.albumImageUrl,
        artistId: overlay.artistId ?? track.artistId,
        albumId: overlay.albumId ?? track.albumId,
        status: overlay.isDelisted ? "[DELISTED]" : track.status,
      };
    });
  }, [rawActiveTracks, enrichmentOverlay]);

  // Client-side deferred micro-enrichment for visible session tracks
  useDeferredEnrichment({
    items: activeTracks,
    onEnriched: (enriched, delistedIds) => {
      setEnrichmentOverlay((prev) => {
        const next = new Map(prev);
        for (const item of enriched) {
          next.set(item.requestedId, {
            albumImageUrl: item.albumImageUrl,
            artistId: item.artistId,
            albumId: item.albumId,
          });
        }
        for (const id of delistedIds) {
          next.set(id, {
            albumImageUrl: null,
            isDelisted: true,
          });
        }
        return next;
      });
    },
  });

  // Analysis computation (uses sitting.analysis if present, else computes on the fly)
  // Analysis computation (computed directly from activeTracks)
  const analysis: SittingAnalysis = useMemo(() => {
    const firstPlaysCount = activeTracks.filter((t) => t.isFirstPlay).length;
    const totalTracks = activeTracks.length;

    // Top Song: if counts are equal (e.g. all 1) or tied, pick the latest one played (first in activeTracks)
    const songCounts = new Map<string, number>();
    for (const t of activeTracks) {
      songCounts.set(t.title, (songCounts.get(t.title) || 0) + 1);
    }
    let maxSongCount = 0;
    for (const count of songCounts.values()) {
      if (count > maxSongCount) maxSongCount = count;
    }
    let topSong: { title: string; count: number; id?: string; artist?: string } | null = null;
    if (activeTracks.length > 0 && maxSongCount > 0) {
      const latestTrack = activeTracks.find((t) => songCounts.get(t.title) === maxSongCount);
      if (latestTrack) {
        topSong = {
          title: latestTrack.title,
          count: maxSongCount,
          id: latestTrack.id,
          artist: latestTrack.artist,
        };
      }
    }

    // Top Album
    const albumCounts = new Map<string, number>();
    for (const t of activeTracks) {
      if (t.album) {
        albumCounts.set(t.album, (albumCounts.get(t.album) || 0) + 1);
      }
    }
    let topAlbumEntry: [string, number] | null = null;
    for (const [album, count] of albumCounts.entries()) {
      if (!topAlbumEntry || count > topAlbumEntry[1]) {
        topAlbumEntry = [album, count];
      }
    }
    let topAlbum: { title: string; count: number; id?: string; artist?: string } | null = null;
    if (topAlbumEntry) {
      const matchTrack = activeTracks.find((t) => t.album === topAlbumEntry![0]);
      topAlbum = {
        title: topAlbumEntry[0],
        count: topAlbumEntry[1],
        id: matchTrack?.albumId,
        artist: matchTrack?.artist,
      };
    } else {
      topAlbum = { title: "None", count: 0 };
    }

    // Top Artist
    const artistCounts = new Map<string, number>();
    for (const t of activeTracks) {
      if (t.artist) {
        artistCounts.set(t.artist, (artistCounts.get(t.artist) || 0) + 1);
      }
    }
    let topArtistEntry: [string, number] | null = null;
    for (const [artist, count] of artistCounts.entries()) {
      if (!topArtistEntry || count > topArtistEntry[1]) {
        topArtistEntry = [artist, count];
      }
    }
    let topArtist: { name: string; count: number; id?: string } | null = null;
    if (topArtistEntry) {
      const matchTrack = activeTracks.find((t) => t.artist === topArtistEntry![0]);
      topArtist = {
        name: topArtistEntry[0],
        count: topArtistEntry[1],
        id: matchTrack?.artistId,
      };
    } else {
      topArtist = { name: "None", count: 0 };
    }

    return {
      firstPlaysCount,
      totalTracks,
      topSong,
      topAlbum,
      topArtist,
    };
  }, [activeTracks]);

  // Dynamic Spotify links for session analytics
  const topSongHref = useMemo(() => {
    if (!analysis.topSong) return undefined;
    const isSpotifyId = analysis.topSong.id && !analysis.topSong.id.startsWith("tr-");
    return isSpotifyId
      ? `https://open.spotify.com/track/${analysis.topSong.id}`
      : `https://open.spotify.com/search/${encodeURIComponent(`${analysis.topSong.title} ${analysis.topSong.artist || ""}`.trim())}`;
  }, [analysis.topSong]);

  const topAlbumHref = useMemo(() => {
    if (!analysis.topAlbum || analysis.topAlbum.title === "None") return undefined;
    return analysis.topAlbum.id
      ? `https://open.spotify.com/album/${analysis.topAlbum.id}`
      : `https://open.spotify.com/search/${encodeURIComponent(analysis.topAlbum.title)}`;
  }, [analysis.topAlbum]);

  const topArtistHref = useMemo(() => {
    if (!analysis.topArtist || analysis.topArtist.name === "None") return undefined;
    return analysis.topArtist.id
      ? `https://open.spotify.com/artist/${analysis.topArtist.id}`
      : `https://open.spotify.com/search/${encodeURIComponent(analysis.topArtist.name)}`;
  }, [analysis.topArtist]);

  // Previous sittings normalized list (capped at 20)
  const sitsList: PreviousSitting[] = useMemo(() => {
    const list =
      previousSittings.length > 0
        ? previousSittings
        : sittings.map((s) => ({
            id: s.id,
            dateStr: s.dateStr,
            durationStr: s.runtimeStr,
            tracksCountStr: `${s.trackCount} ${s.trackCount === 1 ? "track" : "tracks"}`,
            runtimeMinutes: s.runtimeMinutes,
            trackCount: s.trackCount,
          }));
    return list.slice(0, 20);
  }, [previousSittings, sittings]);

  // Histogram data (server pre-computed with fallback)
  const histData = histogram ?? DEFAULT_HISTOGRAM;

  const maxHistRuntime = useMemo(() => {
    if (!histData.bars || histData.bars.length === 0) return 1;
    return Math.max(...histData.bars.map((b) => b.runtimeMinutes), 1);
  }, [histData]);

  // Placeholder rows count (at least slotCount rows total)
  const placeholderCount = Math.max(0, slotCount - activeTracks.length);

  return (
    <div className="w-full mt-4 md:mt-6 select-none">
      {/* 2-Column Main Band: Left 1.5fr / Right 1fr */}
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-[26px]">
        {/* Left Column: Track list */}
        <div className="min-w-0">
          <div className="flex justify-between items-baseline mb-2 select-none">
            <span className="font-mono text-[11px] tracking-[0.14em] text-[#5A5A55]">
              {isOpen ? "[ CURRENT SITTING ]" : "[ LAST SITTING ]"}
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
            {/* Empty notice if zero tracks */}
            {activeTracks.length === 0 && (
              <div className="py-2 px-1 font-mono text-[11px] text-[#4A4A46] tracking-[0.1em] border-b border-[#191917]">
                [ NO TRACKS LOGGED IN THIS SITTING ]
              </div>
            )}

            {/* Active Sitting Track Rows */}
            {activeTracks.map((track, idx) => {
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

            {/* Placeholder Rows to fill remaining capacity (54px/55px height with 38px dark square, hidden on mobile) */}
            {Array.from({ length: placeholderCount }).map((_, idx) => (
              <div
                key={`ph-${idx}`}
                className="hidden md:flex h-[54px] md:h-[55px] border-b border-[#191917] items-center px-1 select-none"
                aria-hidden="true"
              >
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Analysis + Previous Sittings + Histogram */}
        <div className="flex flex-col justify-between h-full min-w-0">
          {/* Analysis Panel */}
          <div>
            <span className="font-mono text-[11px] tracking-[0.14em] text-[#5A5A55] block mb-2 select-none">
              [ ANALYSIS ]
            </span>

            {/* FIRST PLAYS */}
            <div className="flex justify-between items-baseline gap-3 py-2 px-1 border-b border-[#191917] select-none">
              <span className="font-mono text-[11px] tracking-[0.1em] text-[#5A5A55]">
                FIRST PLAYS
              </span>
              <span className="font-mono text-[13px] text-[#EDEDE8] tabular-nums">
                {analysis.firstPlaysCount}
              </span>
            </div>

            {/* TOP SONG (Always rendered & clickable) */}
            <div
              onClick={() => topSongHref && window.open(topSongHref, "_blank", "noopener,noreferrer")}
              className={`flex justify-between items-baseline gap-3 py-2 px-1 border-b border-[#191917] select-none ${
                topSongHref ? "group cursor-pointer hover:bg-[#111110] transition-none" : ""
              }`}
            >
              <span className="font-mono text-[11px] tracking-[0.1em] text-[#5A5A55] flex-none">
                TOP SONG
              </span>
              <span className="font-sans text-[13px] text-right truncate min-w-0 text-[#EDEDE8] group-hover:text-music-accent transition-none">
                {analysis.topSong ? (
                  <>
                    <a
                      href={topSongHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="hover:underline no-underline text-inherit"
                    >
                      {analysis.topSong.title}
                    </a>{" "}
                    <span className="font-mono text-[#8A8A83] ml-1">
                      {analysis.topSong.count}
                    </span>
                  </>
                ) : (
                  <span className="text-[#4A4A46]">—</span>
                )}
              </span>
            </div>

            {/* TOP ALBUM (Clickable to Spotify) */}
            {analysis.topAlbum && (
              <div
                onClick={() => topAlbumHref && window.open(topAlbumHref, "_blank", "noopener,noreferrer")}
                className={`flex justify-between items-baseline gap-3 py-2 px-1 border-b border-[#191917] select-none ${
                  topAlbumHref ? "group cursor-pointer hover:bg-[#111110] transition-none" : ""
                }`}
              >
                <span className="font-mono text-[11px] tracking-[0.1em] text-[#5A5A55] flex-none">
                  TOP ALBUM
                </span>
                <span className="font-sans text-[13px] text-right truncate min-w-0 text-[#EDEDE8] group-hover:text-music-accent transition-none">
                  {topAlbumHref ? (
                    <a
                      href={topAlbumHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="hover:underline no-underline text-inherit"
                    >
                      {analysis.topAlbum.title}
                    </a>
                  ) : (
                    <span>{analysis.topAlbum.title}</span>
                  )}{" "}
                  <span className="font-mono text-[#8A8A83] ml-1">
                    {analysis.topAlbum.count}
                  </span>
                </span>
              </div>
            )}

            {/* TOP ARTIST (Clickable to Spotify) */}
            {analysis.topArtist && (
              <div
                onClick={() => topArtistHref && window.open(topArtistHref, "_blank", "noopener,noreferrer")}
                className={`flex justify-between items-baseline gap-3 py-2 px-1 border-b border-[#191917] select-none ${
                  topArtistHref ? "group cursor-pointer hover:bg-[#111110] transition-none" : ""
                }`}
              >
                <span className="font-mono text-[11px] tracking-[0.1em] text-[#5A5A55] flex-none">
                  TOP ARTIST
                </span>
                <span className="font-sans text-[13px] text-right truncate min-w-0 text-[#EDEDE8] group-hover:text-music-accent transition-none">
                  {topArtistHref ? (
                    <a
                      href={topArtistHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="hover:underline no-underline text-inherit"
                    >
                      {analysis.topArtist.name}
                    </a>
                  ) : (
                    <span>{analysis.topArtist.name}</span>
                  )}{" "}
                  <span className="font-mono text-[#8A8A83] ml-1">
                    {analysis.topArtist.count}
                  </span>
                </span>
              </div>
            )}
          </div>

          {/* Previous Sessions Panel */}
          <div>
            <span className="font-mono text-[11px] tracking-[0.14em] text-[#5A5A55] block mb-2 select-none">
              [ PREVIOUS SESSIONS ]
            </span>

            <div
              className="h-auto md:h-[180px] overflow-y-auto scrollbar-hidden"
              role="list"
            >
              {sitsList.map((sitting, idx) => {
                const sittingId = sitting.id || `s${idx + 1}`;
                const isSelected = sittingId === selectedSittingId;
                const isHovered = sittingId === hoveredSittingId;
                const rawCount = sitting.tracksCountStr
                  .replace(" tracks", "")
                  .replace(" track", "");

                return (
                  <div
                    key={`${sitting.dateStr}-${idx}`}
                    role="listitem"
                    tabIndex={0}
                    onClick={() => handleSelectSitting(sittingId)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleSelectSitting(sittingId);
                      }
                    }}
                    onMouseEnter={() => setHoveredSittingId(sittingId)}
                    onMouseLeave={() => setHoveredSittingId(null)}
                    className={`grid grid-cols-[52px_minmax(0,1fr)_28px] gap-2 items-baseline px-1 py-[7px] border-b border-[#191917] cursor-pointer transition-none select-none focus:outline-none ${
                      isSelected
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
                      className={`font-sans text-[13px] truncate select-none ${
                        isSelected ? "text-music-accent font-medium" : "text-[#EDEDE8]"
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
          </div>

          {/* Sessions Histogram (Moved into right column matching Overview design) */}
          <div className="select-none">
            <div className="flex justify-between items-baseline mb-2 select-none">
              <span className="font-mono text-[11px] tracking-[0.14em] text-[#5A5A55]">
                [ SESSIONS / LAST 20 ]
              </span>
              <span className="font-mono text-[11px] tracking-[0.14em] text-[#5A5A55]">
                AVERAGE {histData.avgRuntimeMinutes}m
              </span>
            </div>

            {/* 20 Bars Container */}
            <div
              className="flex gap-1 items-end h-[80px] w-full"
              role="region"
              aria-label="Last 20 sessions runtime histogram"
            >
              {histData.bars.map((bar, idx) => {
                const isSelected = bar.id === selectedSittingId;
                const isHovered = bar.id === hoveredSittingId;
                const heightPct = Math.max(
                  4,
                  Math.round((bar.runtimeMinutes / maxHistRuntime) * 100)
                );

                return (
                  <div
                    key={`${bar.id}-${idx}`}
                    role="button"
                    tabIndex={0}
                    title={`${bar.title || bar.runtimeMinutes + "m"}`}
                    onClick={() => handleSelectSitting(bar.id)}
                    onMouseEnter={() => setHoveredSittingId(bar.id)}
                    onMouseLeave={() => setHoveredSittingId(null)}
                    className="flex-1 h-full flex flex-col justify-end cursor-pointer group focus:outline-none"
                    aria-label={`Session ${bar.dateStr}: ${bar.runtimeMinutes} minutes`}
                  >
                    <div
                      style={{ height: `${heightPct}%` }}
                      className={`w-full rounded-none transition-none ${
                        isSelected
                          ? "bg-music-accent"
                          : isHovered
                          ? "bg-[#2E2E2A]"
                          : "bg-[#1C1C1A] group-hover:bg-[#2E2E2A]"
                      }`}
                    />
                  </div>
                );
              })}
            </div>

            {/* Date Labels below bars */}
            <div className="flex justify-between font-mono text-[10px] text-[#5A5A55] mt-1.5 select-none">
              <span>{histData.oldestDate}</span>
              <span>{histData.newestDate}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
