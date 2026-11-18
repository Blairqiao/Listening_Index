"use client";

import React from "react";
import { SEARCH_MAX_CHARS, type ProfileTarget } from "@/lib/search-types";
import { useSearch } from "./useSearch";
import { Artwork, getFallbackSwatchColor } from "../../Artwork";

export interface SearchViewProps {
  query: string;
  onQueryChange: (q: string) => void;
  onOpenProfile: (target: ProfileTarget) => void;
}

export const SearchView: React.FC<SearchViewProps> = ({
  query,
  onQueryChange,
  onOpenProfile,
}) => {
  const { status, data, check } = useSearch(query);

  let statusText: string | null = null;
  if (status === "loading") {
    statusText = "SEARCHING…";
  } else if (status === "error") {
    statusText = "SEARCH FAILED";
  } else if (status === "idle") {
    if (!check.ok) {
      if (check.reason === "too_short") {
        statusText = "TYPE 2+ CHARACTERS (1 FOR 中文 / 日本語 / 한국어)";
      } else if (check.reason === "too_long") {
        statusText = "QUERY TOO LONG";
      }
    }
  } else if (status === "ready") {
    const hasNoResults =
      !data || (data.artists.length === 0 && data.tracks.length === 0);
    if (hasNoResults) {
      statusText = "[ NO MATCHES ]";
    }
  }

  const hasResults =
    data !== null && (data.artists.length > 0 || data.tracks.length > 0);

  return (
    <div className="w-full mt-4 md:mt-6 flex flex-col md:h-[560px] select-none">
      {/* 1. Full-width search input & status line */}
      <div className="flex-none mb-3">
        <input
          type="search"
          name="search"
          autoFocus
          maxLength={SEARCH_MAX_CHARS * 2}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="SEARCH TRACKS OR ARTISTS"
          aria-label="Search tracks or artists"
          className="w-full bg-transparent border-0 border-b border-[#1C1C1A] focus:border-music-accent font-mono text-[14px] md:text-[15px] text-[#EDEDE8] placeholder:text-[#5A5A55] py-2 px-1 outline-none transition-none rounded-none"
        />
        <div
          className="h-[20px] mt-1.5 px-1 font-mono text-[11px] tracking-[0.14em] text-[#5A5A55] select-none flex items-center"
          role="status"
          aria-live="polite"
        >
          {statusText}
        </div>
      </div>

      {/* 2. Scrollable Body Container (h-auto on mobile, bounded with internal scroll on desktop) */}
      <div
        className={`flex-1 min-h-0 overflow-y-auto overflow-x-hidden scrollbar-hidden transition-opacity duration-150 ${
          status === "loading" ? "opacity-60" : "opacity-100"
        }`}
      >
        {hasResults && data && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-[26px]">
            {/* Left Column: Artists */}
            <div className="min-w-0">
              <div className="flex justify-between items-baseline mb-2 select-none">
                <span className="font-mono text-[11px] tracking-[0.14em] text-[#5A5A55]">
                  [ ARTISTS ]
                </span>
                <span className="font-mono text-[11px] tracking-[0.14em] text-[#5A5A55]">
                  PLAYS
                </span>
              </div>
              <div className="flex flex-col">
                {data.artists.length === 0 ? (
                  <div className="font-mono text-[11px] text-[#4A4A46] py-3 px-1 select-none">
                    [ NO ARTISTS ]
                  </div>
                ) : (
                  data.artists.map((artist) => (
                    <button
                      key={artist.key}
                      type="button"
                      onClick={() =>
                        onOpenProfile({ kind: "artist", key: artist.key })
                      }
                      className="w-full text-left group flex items-center gap-3 px-1 h-[54px] md:h-[55px] cursor-pointer transition-none hover:bg-[#111110] focus:bg-[#111110] focus:outline-none focus-visible:ring-1 focus-visible:ring-music-accent border-b border-[#191917]"
                    >
                      <Artwork
                        src={artist.imageUrl}
                        alt=""
                        size={38}
                        swatchColor={getFallbackSwatchColor(artist.name)}
                      />
                      <div className="min-w-0 flex-1 pl-1">
                        <span className="block font-sans text-[14px] tracking-[-0.01em] text-[#EDEDE8] truncate group-hover:text-music-accent group-focus:text-music-accent transition-none leading-snug">
                          {artist.name}
                        </span>
                      </div>
                      <span className="font-mono text-[11px] text-[#8A8A83] flex-none tabular-nums text-right">
                        {artist.plays.toLocaleString()}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Right Column: Tracks */}
            <div className="min-w-0">
              <div className="flex justify-between items-baseline mb-2 select-none">
                <span className="font-mono text-[11px] tracking-[0.14em] text-[#5A5A55]">
                  [ TRACKS ]
                </span>
                <span className="font-mono text-[11px] tracking-[0.14em] text-[#5A5A55]">
                  PLAYS
                </span>
              </div>
              <div className="flex flex-col">
                {data.tracks.length === 0 ? (
                  <div className="font-mono text-[11px] text-[#4A4A46] py-3 px-1 select-none">
                    [ NO TRACKS ]
                  </div>
                ) : (
                  data.tracks.map((track) => (
                    <button
                      key={track.id}
                      type="button"
                      onClick={() =>
                        onOpenProfile({ kind: "track", key: track.id })
                      }
                      className="w-full text-left group flex items-center gap-3 px-1 h-[54px] md:h-[55px] cursor-pointer transition-none hover:bg-[#111110] focus:bg-[#111110] focus:outline-none focus-visible:ring-1 focus-visible:ring-music-accent border-b border-[#191917]"
                    >
                      <Artwork
                        src={track.albumImageUrl}
                        alt=""
                        size={38}
                        swatchColor={getFallbackSwatchColor(track.album || track.name)}
                      />
                      <div className="min-w-0 flex-1 pl-1">
                        <span className="block font-sans text-[14px] tracking-[-0.01em] text-[#EDEDE8] truncate group-hover:text-music-accent group-focus:text-music-accent transition-none leading-snug">
                          {track.name}
                        </span>
                        <div className="font-mono text-[11.5px] text-[#6A6A64] truncate leading-tight mt-0.5">
                          <span>{track.artist}</span>
                          {" · "}
                          <span>{track.album}</span>
                        </div>
                      </div>
                      <span className="font-mono text-[11px] text-[#8A8A83] flex-none tabular-nums text-right">
                        {track.plays.toLocaleString()}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
