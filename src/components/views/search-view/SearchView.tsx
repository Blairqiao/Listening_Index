"use client";

import React, { useCallback, useEffect, useRef, useState, type JSX } from "react";
import { X } from "lucide-react";
import {
  DEFAULT_SEARCH_FILTER,
  DEFAULT_SEARCH_SORT,
  SEARCH_FILTER_OPTIONS,
  SEARCH_MAX_CHARS,
  type ProfileTarget,
  type SearchFilter,
  type SearchSort,
} from "@/lib/search-types";
import { formatCompactPlayDate } from "@/lib/profile-stats";
import { getSearchStatusText, resolveDisplayFilter } from "@/lib/search-utils";
import { searchChipClass, SortMenu } from "./SortMenu";
import { useSearch } from "./useSearch";
import { Artwork, getFallbackSwatchColor } from "../../Artwork";

const pageButtonClass = `${searchChipClass} disabled:cursor-default disabled:opacity-40 disabled:hover:text-[#6A6A64] disabled:hover:border-[#26261F]`;

const headingLabelClass = "font-mono text-[12px] text-[#5A5A55]";

function ResultHeading({
  label,
  afterArtists = false,
  rightHeader = "Plays",
}: {
  label: "Tracks" | "Artists" | "Albums";
  afterArtists?: boolean;
  rightHeader?: string;
}) {
  const spacing = afterArtists
    ? "mt-6 mb-2 md:mt-0 md:mb-0 md:h-[55px] md:items-end md:pb-2"
    : "mb-2";

  return (
    <div className={`flex justify-between items-baseline ${spacing}`}>
      <span className={headingLabelClass}>{label}</span>
      <span className={headingLabelClass}>{rightHeader}</span>
    </div>
  );
}

function ResultRow({
  name,
  imageUrl,
  swatchName = name,
  plays,
  subtitle,
  lastPlayedText,
  onClick,
  disabled,
}: {
  name: string;
  imageUrl: string | null;
  swatchName?: string;
  plays: number;
  subtitle?: React.ReactNode;
  lastPlayedText?: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="w-full text-left group flex items-center gap-3 px-1 h-[54px] md:h-[55px] cursor-pointer motion-hover hover:bg-[#111110] focus:bg-[#111110] focus:outline-none focus-visible:ring-1 focus-visible:ring-music-accent border-b border-[#191917] disabled:cursor-default"
    >
      <Artwork src={imageUrl} alt="" size={38} swatchColor={getFallbackSwatchColor(swatchName)} />
      <div className="min-w-0 flex-1 pl-1">
        <span className="block font-sans text-[14px] tracking-[-0.01em] text-[#EDEDE8] truncate group-hover:text-music-accent group-focus:text-music-accent motion-hover leading-snug">
          {name}
        </span>
        {subtitle != null && (
          <div className="font-mono text-[12.5px] text-[#6A6A64] truncate leading-tight mt-0.5">
            {subtitle}
          </div>
        )}
      </div>
      <div className="flex-none flex items-center gap-2 text-right">
        {lastPlayedText && (
          <span className="font-mono text-[11.5px] text-[#5A5A55] tabular-nums">
            {lastPlayedText}
          </span>
        )}
        <span className="font-mono text-[12px] text-[#8A8A83] tabular-nums">
          {plays.toLocaleString()}
        </span>
      </div>
    </button>
  );
}

export interface SearchViewProps {
  query: string;
  onQueryChange: (q: string) => void;
  onOpenProfile: (target: ProfileTarget) => void;
  sort?: SearchSort;
  page?: number;
  filter?: SearchFilter;
  visitorTimezone?: string;
  onSortChange?: (sort: SearchSort) => void;
  onPageChange?: (page: number) => void;
  onFilterChange?: (filter: SearchFilter) => void;
  onRandomProfile?: () => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  restoreScrollY?: number | null;
  onScrollRestored?: () => void;
}

export const SearchView: React.FC<SearchViewProps> = ({
  query,
  onQueryChange,
  onOpenProfile,
  sort = DEFAULT_SEARCH_SORT,
  page = 1,
  filter = DEFAULT_SEARCH_FILTER,
  visitorTimezone = "UTC",
  onSortChange,
  onPageChange,
  onFilterChange,
  onRandomProfile,
  inputRef,
  restoreScrollY,
  onScrollRestored,
}) => {
  const internalInputRef = useRef<HTMLInputElement | null>(null);
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const { status, data, dataFilter } = useSearch(query, sort, page, filter);
  const displayFilter = resolveDisplayFilter(status, filter, dataFilter);

  useEffect(() => {
    if (restoreScrollY == null || status !== "ready") return;
    const rafId = requestAnimationFrame(() => {
      window.scrollTo(0, restoreScrollY);
      onScrollRestored?.();
    });
    return () => cancelAnimationFrame(rafId);
  }, [restoreScrollY, status, onScrollRestored]);

  const setMergedRef = useCallback(
    (element: HTMLInputElement | null) => {
      internalInputRef.current = element;
      if (inputRef) {
        inputRef.current = element;
      }
    },
    [inputRef]
  );

  const albums = data?.albums ?? [];
  const hasArtists = !!data?.artists.length;
  const hasResults =
    displayFilter === "all"
      ? hasArtists || albums.length > 0 || !!data?.tracks.length
      : displayFilter === "tracks"
        ? !!data?.tracks.length
        : displayFilter === "artists"
          ? hasArtists
          : albums.length > 0;

  const statusText = getSearchStatusText({
    status,
    query,
    hasResults,
  });

  let placeholder = "Search tracks, artists or albums";
  let inputAriaLabel = "Search tracks, artists or albums";
  if (filter === "tracks") {
    placeholder = "Search tracks";
    inputAriaLabel = "Search tracks";
  } else if (filter === "artists") {
    placeholder = "Search artists";
    inputAriaLabel = "Search artists";
  } else if (filter === "albums") {
    placeholder = "Search albums";
    inputAriaLabel = "Search albums";
  }

  const isRecencySort = sort === "recent" || sort === "oldest";
  const rightHeader = isRecencySort ? "Last played · plays" : "Plays";

  const formatLastPlayed = (iso?: string | null): string | undefined => {
    if (!isRecencySort || !iso) return undefined;
    const formatted = formatCompactPlayDate(iso, visitorTimezone);
    return formatted !== "--" ? formatted : undefined;
  };

  const getFilterCount = (filterValue: SearchFilter): number | undefined => {
    if (!data?.totals) return undefined;
    if (filterValue === "tracks") return data.totals.tracks;
    if (filterValue === "artists") return data.totals.artists;
    if (filterValue === "albums") return data.totals.albums;
    return undefined;
  };

  const showPagination = page > 1 || !!data?.hasMore || (data?.totalPages ?? 1) > 1;
  const canPrev = page > 1 && status !== "loading";
  const canNext =
    status === "ready" &&
    !!data?.hasMore &&
    (data?.totalPages === undefined || page < data.totalPages);

  useEffect(() => {
    if (!onPageChange) return;
    const pageChange = onPageChange;

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.defaultPrevented || event.isComposing) return;
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (isSortMenuOpen) return;

      const active = typeof document !== "undefined" ? document.activeElement : null;
      if (
        active instanceof HTMLElement &&
        (active.tagName === "INPUT" ||
          active.tagName === "TEXTAREA" ||
          active.tagName === "SELECT" ||
          active.isContentEditable ||
          active.closest('[role="listbox"], [aria-haspopup="listbox"][aria-expanded="true"]'))
      ) {
        return;
      }

      if (event.key === "ArrowLeft") {
        if (canPrev) {
          event.preventDefault();
          pageChange(page - 1);
        }
      } else if (event.key === "ArrowRight") {
        if (canNext) {
          event.preventDefault();
          pageChange(page + 1);
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSortMenuOpen, canPrev, canNext, onPageChange, page]);

  const isRowDisabled = status === "loading";

  const renderTrackRow = (track: NonNullable<typeof data>["tracks"][number]): JSX.Element => (
    <ResultRow
      key={track.id}
      name={track.name}
      imageUrl={track.albumImageUrl}
      swatchName={track.album || track.name}
      plays={track.plays}
      lastPlayedText={formatLastPlayed(track.lastPlayedAt)}
      subtitle={
        <>
          <span>{track.artist}</span>
          {" · "}
          <span>{track.album}</span>
        </>
      }
      onClick={() => onOpenProfile({ kind: "track", key: track.id })}
      disabled={isRowDisabled}
    />
  );

  const renderArtistRow = (artist: NonNullable<typeof data>["artists"][number]): JSX.Element => (
    <ResultRow
      key={artist.key}
      name={artist.name}
      imageUrl={artist.imageUrl}
      plays={artist.plays}
      lastPlayedText={formatLastPlayed(artist.lastPlayedAt)}
      onClick={() => onOpenProfile({ kind: "artist", key: artist.key })}
      disabled={isRowDisabled}
    />
  );

  const renderAlbumRow = (album: NonNullable<typeof data>["albums"][number]): JSX.Element => (
    <ResultRow
      key={album.key}
      name={album.name}
      imageUrl={album.imageUrl}
      plays={album.plays}
      lastPlayedText={formatLastPlayed(album.lastPlayedAt)}
      subtitle={album.artist}
      onClick={() => onOpenProfile({ kind: "album", key: album.key })}
      disabled={isRowDisabled}
    />
  );

  const renderBalancedGrid = (
    label: "Tracks" | "Artists" | "Albums",
    items: JSX.Element[]
  ): JSX.Element => {
    const mid = Math.ceil(items.length / 2);
    return (
      <div className="min-w-0">
        <ResultHeading label={label} rightHeader={rightHeader} />
        <div className="grid grid-cols-1 md:grid-cols-2 md:gap-x-[26px]">
          <div className="min-w-0 flex flex-col">{items.slice(0, mid)}</div>
          <div className="min-w-0 flex flex-col">{items.slice(mid)}</div>
        </div>
      </div>
    );
  };

  const renderResults = () => {
    if (status === "loading" && !data) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 md:gap-x-[26px]">
          {[0, 1].map((colIndex) => (
            <div key={colIndex} className="min-w-0 flex flex-col">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div
                  key={colIndex * 4 + idx}
                  className="flex items-center gap-3 px-1 h-[54px] md:h-[55px] border-b border-[#191917] animate-pulse"
                >
                  <div className="w-[38px] h-[38px] rounded bg-[#141413] flex-none" />
                  <div className="min-w-0 flex-1 pl-1 space-y-1.5">
                    <div className="h-3.5 bg-[#191917] rounded w-36 max-w-[70%]" />
                    <div className="h-2.5 bg-[#141413] rounded w-24 max-w-[50%]" />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      );
    }

    if (!hasResults || !data) return null;

    if (displayFilter === "all") {
      const tracksOnlyMixed = !hasArtists && albums.length === 0 && data.tracks.length > 0;

      if (tracksOnlyMixed) {
        return renderBalancedGrid("Tracks", data.tracks.map(renderTrackRow));
      }

      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-[26px]">
          <div className="min-w-0">
            <ResultHeading label="Tracks" rightHeader={rightHeader} />
            <div className="flex flex-col">
              {data.tracks.length === 0 ? (
                <div className="font-mono text-[12px] text-[#4A4A46] py-3 px-1 select-none">
                  No tracks
                </div>
              ) : (
                data.tracks.map(renderTrackRow)
              )}
            </div>
          </div>

          {(hasArtists || albums.length > 0) && (
            <div className="min-w-0">
              {hasArtists && (
                <div>
                  <ResultHeading label="Artists" rightHeader={rightHeader} />
                  <div className="flex flex-col">
                    {data.artists.map(renderArtistRow)}
                  </div>
                </div>
              )}
              {albums.length > 0 && (
                <div>
                  <ResultHeading label="Albums" afterArtists={hasArtists} rightHeader={rightHeader} />
                  <div className="flex flex-col">
                    {albums.map(renderAlbumRow)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      );
    }

    if (displayFilter === "tracks") {
      return renderBalancedGrid("Tracks", data.tracks.map(renderTrackRow));
    }
    if (displayFilter === "artists") {
      return renderBalancedGrid("Artists", data.artists.map(renderArtistRow));
    }
    if (displayFilter === "albums") {
      return renderBalancedGrid("Albums", albums.map(renderAlbumRow));
    }
    return null;
  };

  return (
    <div className="w-full flex flex-col select-none">
      {/* Top control strip */}
      <div className="my-3.5 sm:my-4 md:my-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div
          role="group"
          aria-label="Filter by type"
          className="grid grid-cols-4 gap-1.5 w-full sm:flex sm:w-auto"
        >
          {SEARCH_FILTER_OPTIONS.map((opt) => {
            const isActive = filter === opt.value;
            const count = getFilterCount(opt.value);

            return (
              <button
                key={opt.value}
                type="button"
                aria-pressed={isActive}
                onClick={() => onFilterChange?.(opt.value)}
                className={`font-mono text-[12px] whitespace-nowrap px-1 sm:px-2.5 py-1 sm:py-[3px] rounded-none motion-hover border focus:outline-none focus-visible:outline-solid focus-visible:outline-music-accent flex items-center justify-center text-center cursor-pointer ${
                  isActive
                    ? "border-music-accent text-music-accent bg-transparent"
                    : "border-[#26261F] text-[#6A6A64] hover:text-[#EDEDE8] hover:border-[#3A3A32] bg-transparent"
                }`}
              >
                <span>{opt.label}</span>
                {count !== undefined && (
                  <span className="hidden sm:inline ml-1 font-mono text-[11px] text-[#5A5A55] tabular-nums">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-4">
          {onRandomProfile && (
            <button
              type="button"
              onClick={onRandomProfile}
              aria-label="Open random profile"
              className="relative font-mono text-[12px] bg-transparent border-0 cursor-pointer p-0 text-[#6A6A64] hover:text-[#EDEDE8] focus-ring focus-visible:text-music-accent press hit-area motion-hover whitespace-nowrap"
            >
              Random
            </button>
          )}
          <SortMenu
            value={sort}
            onChange={(nextSort) => onSortChange?.(nextSort)}
            onOpenChange={setIsSortMenuOpen}
          />
        </div>
      </div>

      {/* Search Input */}
      <div className="flex-none">
        <div className="relative">
          <input
            ref={setMergedRef}
            type="search"
            name="search"
            maxLength={SEARCH_MAX_CHARS * 2}
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing) return;
              if (e.key === "Escape" && query) {
                e.preventDefault();
                onQueryChange("");
              }
            }}
            placeholder={placeholder}
            aria-label={inputAriaLabel}
            className="w-full bg-transparent border-0 border-b border-[#1C1C1A] focus:border-music-accent font-mono text-[14px] md:text-[15px] text-[#EDEDE8] placeholder:text-[#5A5A55] py-2 pl-1 pr-10 outline-none motion-hover rounded-none [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                onQueryChange("");
                internalInputRef.current?.focus();
              }}
              className="absolute right-0 top-0 flex h-full w-10 cursor-pointer items-center justify-center text-[#8A8A83] hover:text-[#EDEDE8] focus-ring motion-hover"
            >
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </div>
        <div className="px-1 font-mono text-[12px] leading-[18px] text-[#8A8A83] min-h-[18px] mt-1.5" role="status">
          {statusText}
        </div>
      </div>

      {/* Results */}
      <div
        key={page}
        aria-busy={status === "loading" ? "true" : undefined}
        className={`transition-opacity duration-150 ${status === "loading" ? "opacity-60 pointer-events-none" : "opacity-100"}`}
      >
        {renderResults()}
      </div>

      {/* Bottom Hairline Pagination */}
      {showPagination && (
        <div className="w-full py-5 px-1 select-none font-mono text-[12px] flex items-center gap-3">
          <span className="flex-1 h-[1px] bg-[#1C1C1A]" />
          <nav aria-label="Search results pages" className="inline-flex items-center gap-1.5">
            <button
              type="button"
              aria-label="Previous page"
              disabled={!canPrev}
              onClick={() => onPageChange?.(page - 1)}
              className={pageButtonClass}
            >
              ← Prev
            </button>
            <span className="tabular-nums whitespace-nowrap text-[#8A8A83]">
              <span className="text-[#5A5A55]">Page</span>{" "}
              {String(page).padStart(2, "0")}
              {data?.totalPages !== undefined && (
                <> / {String(data.totalPages).padStart(2, "0")}</>
              )}
            </span>
            <button
              type="button"
              aria-label="Next page"
              disabled={!canNext}
              onClick={() => onPageChange?.(page + 1)}
              className={pageButtonClass}
            >
              Next →
            </button>
          </nav>
          <span className="flex-1 h-[1px] bg-[#1C1C1A]" />
        </div>
      )}
    </div>
  );
};
