"use client";

import React, { useRef } from "react";
import { X } from "lucide-react";
import { DEFAULT_SEARCH_SORT, SEARCH_MAX_CHARS, type ProfileTarget, type SearchSort } from "@/lib/search-types";
import { searchChipClass, SortMenu } from "./SortMenu";
import { useSearch } from "./useSearch";
import { Artwork, getFallbackSwatchColor } from "../../Artwork";

const pageButtonClass = `${searchChipClass} disabled:cursor-default disabled:opacity-40 disabled:hover:text-[#6A6A64] disabled:hover:border-[#26261F]`;

const headingLabelClass = "font-mono text-[11px] tracking-[0.14em] text-[#5A5A55]";

function ResultHeading({ label, afterArtists = false }: {
  label: "TRACKS" | "ARTISTS" | "ALBUMS";
  afterArtists?: boolean;
}) {
  const spacing = afterArtists
    ? "mt-6 mb-2 md:mt-0 md:mb-0 md:h-[55px] md:items-end md:pb-2"
    : "mb-2";

  return (
    <div className={`flex justify-between items-baseline ${spacing}`}>
      <span className={headingLabelClass}>[ {label} ]</span>
      <span className={headingLabelClass}>PLAYS</span>
    </div>
  );
}

function ResultRow({ name, imageUrl, swatchName = name, plays, subtitle, onClick }: {
  name: string;
  imageUrl: string | null;
  swatchName?: string;
  plays: number;
  subtitle?: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left group flex items-center gap-3 px-1 h-[54px] md:h-[55px] cursor-pointer transition-none hover:bg-[#111110] focus:bg-[#111110] focus:outline-none focus-visible:ring-1 focus-visible:ring-music-accent border-b border-[#191917]"
    >
      <Artwork src={imageUrl} alt="" size={38} swatchColor={getFallbackSwatchColor(swatchName)} />
      <div className="min-w-0 flex-1 pl-1">
        <span className="block font-sans text-[14px] tracking-[-0.01em] text-[#EDEDE8] truncate group-hover:text-music-accent group-focus:text-music-accent transition-none leading-snug">
          {name}
        </span>
        {subtitle != null && (
          <div className="font-mono text-[11.5px] text-[#6A6A64] truncate leading-tight mt-0.5">
            {subtitle}
          </div>
        )}
      </div>
      <span className="font-mono text-[11px] text-[#8A8A83] flex-none tabular-nums text-right">
        {plays.toLocaleString()}
      </span>
    </button>
  );
}

export interface SearchViewProps {
  query: string;
  onQueryChange: (q: string) => void;
  onOpenProfile: (target: ProfileTarget) => void;
  sort?: SearchSort;
  page?: number;
  onSortChange?: (sort: SearchSort) => void;
  onPageChange?: (page: number) => void;
}

export const SearchView: React.FC<SearchViewProps> = ({
  query,
  onQueryChange,
  onOpenProfile,
  sort = DEFAULT_SEARCH_SORT,
  page = 1,
  onSortChange,
  onPageChange,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const { status, data } = useSearch(query, sort, page);

  const albums = data?.albums ?? [];
  const hasArtists = !!data?.artists.length;
  const hasResults = hasArtists || albums.length > 0 || !!data?.tracks.length;

  let statusText: string | null = null;
  if (status === "loading") {
    statusText = query.trim() ? "SEARCHING…" : "LOADING CATALOG…";
  } else if (status === "error") {
    statusText = "SEARCH FAILED";
  } else if (status === "idle") {
    statusText = "QUERY TOO LONG";
  } else if (status === "ready" && !hasResults) {
    statusText = query.trim() ? "[ NO MATCHES ]" : "[ NO PLAYS IN ARCHIVE ]";
  }

  return (
    <div className="w-full mt-4 md:mt-6 flex flex-col select-none">
      <div className="flex-none mb-3">
        <div className="relative">
          <input
            ref={inputRef}
            type="search"
            name="search"
            maxLength={SEARCH_MAX_CHARS * 2}
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="SEARCH TRACKS, ARTISTS OR ALBUMS"
            aria-label="Search tracks, artists or albums"
            className="w-full bg-transparent border-0 border-b border-[#1C1C1A] focus:border-music-accent font-mono text-[14px] md:text-[15px] text-[#EDEDE8] placeholder:text-[#5A5A55] py-2 pl-1 pr-10 outline-none transition-none rounded-none [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                onQueryChange("");
                inputRef.current?.focus();
              }}
              className="absolute right-0 top-0 flex h-full w-10 cursor-pointer items-center justify-center text-[#8A8A83] hover:text-[#EDEDE8] focus-visible:outline-music-accent"
            >
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 font-mono text-[11px] tracking-[0.08em] text-[#6A6A64]">
          <SortMenu value={sort} onChange={(nextSort) => onSortChange?.(nextSort)} />
          {(page > 1 || data?.hasMore) && (
            <nav aria-label="Search results pages" className="flex items-center gap-1.5">
              <button
                type="button"
                aria-label="Previous page"
                disabled={page <= 1 || status === "loading"}
                onClick={() => onPageChange?.(page - 1)}
                className={pageButtonClass}
              >
                ← PREV
              </button>
              <span className="tabular-nums whitespace-nowrap text-[#8A8A83]">
                <span className="text-[#5A5A55] tracking-[0.14em]">PAGE</span>{" "}
                {String(page).padStart(2, "0")}
              </span>
              <button
                type="button"
                aria-label="Next page"
                disabled={status !== "ready" || !data?.hasMore}
                onClick={() => onPageChange?.(page + 1)}
                className={pageButtonClass}
              >
                NEXT →
              </button>
            </nav>
          )}
        </div>
        <div className="px-1 font-mono text-[11px] text-[#8A8A83] empty:hidden" role="status">
          {statusText}
        </div>
      </div>

      <div
        key={page}
        className={`transition-opacity duration-150 ${status === "loading" ? "opacity-60" : "opacity-100"}`}
      >
        {hasResults && data && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-[26px]">
            <div className="min-w-0">
              <ResultHeading label="TRACKS" />
              <div className="flex flex-col">
                {data.tracks.length === 0 ? (
                  <div className="font-mono text-[11px] text-[#4A4A46] py-3 px-1 select-none">
                    [ NO TRACKS ]
                  </div>
                ) : (
                  data.tracks.map((track) => (
                    <ResultRow
                      key={track.id}
                      name={track.name}
                      imageUrl={track.albumImageUrl}
                      swatchName={track.album || track.name}
                      plays={track.plays}
                      subtitle={
                        <>
                          <span>{track.artist}</span>
                          {" · "}
                          <span>{track.album}</span>
                        </>
                      }
                      onClick={() => onOpenProfile({ kind: "track", key: track.id })}
                    />
                  ))
                )}
              </div>
            </div>

            {(hasArtists || albums.length > 0) && (
              <div className="min-w-0">
                {hasArtists && (
                  <div>
                    <ResultHeading label="ARTISTS" />
                    <div className="flex flex-col">
                      {data.artists.map((artist) => (
                        <ResultRow
                          key={artist.key}
                          name={artist.name}
                          imageUrl={artist.imageUrl}
                          plays={artist.plays}
                          onClick={() => onOpenProfile({ kind: "artist", key: artist.key })}
                        />
                      ))}
                    </div>
                  </div>
                )}
                {albums.length > 0 && (
                  <div>
                    <ResultHeading label="ALBUMS" afterArtists={hasArtists} />
                    <div className="flex flex-col">
                      {albums.map((album) => (
                        <ResultRow
                          key={album.key}
                          name={album.name}
                          imageUrl={album.imageUrl}
                          plays={album.plays}
                          subtitle={album.artist}
                          onClick={() => onOpenProfile({ kind: "album", key: album.key })}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
