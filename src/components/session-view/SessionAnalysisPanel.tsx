"use client";

import React, { useMemo } from "react";
import { SittingAnalysis } from "@/lib/mock-listening-data";

export interface SessionAnalysisPanelProps {
  analysis: SittingAnalysis;
}

export const SessionAnalysisPanel: React.FC<SessionAnalysisPanelProps> = ({ analysis }) => {
  const activeTopTrack = analysis.topTrack || analysis.topSong;

  const topSongHref = useMemo(() => {
    if (!activeTopTrack) return undefined;
    const isSpotifyId = activeTopTrack.id && !activeTopTrack.id.startsWith("tr-");
    return isSpotifyId
      ? `https://open.spotify.com/track/${activeTopTrack.id}`
      : `https://open.spotify.com/search/${encodeURIComponent(`${activeTopTrack.title} ${activeTopTrack.artist || ""}`.trim())}`;
  }, [activeTopTrack]);

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

  return (
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

      {/* TOP TRACK */}
      <div
        onClick={() => topSongHref && window.open(topSongHref, "_blank", "noopener,noreferrer")}
        className={`flex justify-between items-baseline gap-3 py-2 px-1 border-b border-[#191917] select-none ${
          topSongHref ? "group cursor-pointer hover:bg-[#111110] transition-none" : ""
        }`}
      >
        <span className="font-mono text-[11px] tracking-[0.1em] text-[#5A5A55] flex-none">
          TOP TRACK
        </span>
        <span className="font-sans text-[13px] text-right truncate min-w-0 text-[#EDEDE8] group-hover:text-music-accent transition-none">
          {activeTopTrack ? (
            <>
              <a
                href={topSongHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="hover:underline no-underline text-inherit"
              >
                {activeTopTrack.title}
              </a>{" "}
              <span className="font-mono text-[#8A8A83] ml-1">
                {activeTopTrack.count}
              </span>
            </>
          ) : (
            <span className="text-[#4A4A46]">—</span>
          )}
        </span>
      </div>

      {/* TOP ALBUM */}
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

      {/* TOP ARTIST */}
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
  );
};
