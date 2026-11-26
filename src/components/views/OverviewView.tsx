"use client";

import React from "react";
import { TrackSummary, ArtistSummary, AlbumSummary, RangeKey, ActivityDay } from "@/lib/types";
import type { CadenceGranularity } from "@/lib/range";
import type { ProfileKind, ProfileTarget } from "@/lib/search-types";
import { Artwork } from "../Artwork";
import { ActivityChart, type ActivityBucketSelectHandler } from "./ActivityChart";

export interface OverviewViewProps {
  granularity: CadenceGranularity;
  rangeKey?: RangeKey | null;
  rangeLabel?: string;
  topTracks: TrackSummary[];
  topArtists: ArtistSummary[];
  topAlbums: AlbumSummary[];
  activityCadence?: ActivityDay[];
  isLoading?: boolean;
  onOpenProfile?: (target: ProfileTarget) => void;
  onSelectBucket?: ActivityBucketSelectHandler;
}

const KIND_LABEL: Record<ProfileKind, string> = { track: "Track", artist: "Artist", album: "Album" };

// Inline names stay spans so the parent's truncation still applies; the row's own click
// handler is skipped so a name opens its own profile.
function profileLinkProps(
  kind: ProfileKind,
  key: string,
  name: string,
  onOpenProfile?: (target: ProfileTarget) => void
) {
  const open = (event: { stopPropagation(): void }) => {
    event.stopPropagation();
    onOpenProfile?.({ kind, key });
  };
  return {
    role: "button",
    tabIndex: 0,
    "aria-label": `Open ${KIND_LABEL[kind]} profile for ${name}`,
    onClick: open,
    onKeyDown: (event: React.KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open(event);
      }
    },
  };
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  granularity,
  rangeKey = null,
  rangeLabel,
  topTracks,
  topArtists,
  topAlbums,
  activityCadence = [],
  isLoading = false,
  onOpenProfile,
  onSelectBucket,
}) => {
  const displayTracks = topTracks;
  const isTracksSkeleton = isLoading && topTracks.length === 0;
  const isArtistsSkeleton = isLoading && topArtists.length === 0;
  const isAlbumsSkeleton = isLoading && topAlbums.length === 0;

  const trackPlaceholderCount = Math.max(0, 10 - displayTracks.length);
  const artistPlaceholderCount = Math.max(0, 5 - topArtists.length);
  const albumPlaceholderCount = Math.max(0, 5 - topAlbums.length);

  return (
    <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-4 md:gap-[26px] mt-4 md:mt-6">
      {/* Left Column: Top Tracks (1.5fr) */}
      <div className="min-w-0">
        <div className="flex justify-between items-baseline mb-2 select-none">
          <span className="font-mono text-[12px] text-[#5A5A55]">
            Top tracks
          </span>
          <span className="font-mono text-[12px] text-[#5A5A55]">
            Plays
          </span>
        </div>

        <div className={`flex flex-col ${isTracksSkeleton ? "" : "animate-content-enter"}`} role="list">
          {isTracksSkeleton ? (
            Array.from({ length: 10 }).map((_, idx) => (
              <div
                key={idx}
                className={`flex items-center gap-3 px-1 h-[54px] md:h-[55px] animate-pulse ${idx === 9 ? "border-b-0" : "border-b border-[#191917]"
                  }`}
              >
                <span className="font-mono text-[12px] text-[#2E2E2A] w-[18px] flex-none">
                  {String(idx + 1).padStart(2, "0")}
                </span>
                <span className="font-mono text-[11.5px] w-[22px] flex-none text-center text-[#2E2E2A]">
                  ·
                </span>
                <div className="w-[38px] h-[38px] rounded bg-[#141413] flex-none" />
                <div className="min-w-0 flex-1 pl-1 space-y-1.5">
                  <div className="h-3.5 bg-[#191917] rounded w-36 max-w-[70%]" />
                  <div className="h-2.5 bg-[#141413] rounded w-24 max-w-[50%]" />
                </div>
                <div className="h-3 bg-[#141413] rounded w-8 flex-none" />
              </div>
            ))
          ) : (
            <>
              {displayTracks.map((track, idx) => {
                const isLast = idx === displayTracks.length - 1 && displayTracks.length >= 10;
                const isNew = track.drift === "NEW";
                const isNeutral = track.drift === "·";

                return (
                  <div
                    key={track.id}
                    role="listitem"
                    data-profile-kind="track"
                    onClick={() => onOpenProfile?.({ kind: "track", key: track.id })}
                    className={`group flex items-center gap-3 px-1 h-[54px] md:h-[55px] cursor-pointer motion-hover hover:bg-[#111110] ${isLast ? "border-b-0" : "border-b border-[#191917]"
                      }`}
                  >
                    {/* Rank Index */}
                    <span className="font-mono text-[12px] text-[#4A4A46] w-[18px] flex-none tabular-nums select-none">
                      {track.rank}
                    </span>

                    {/* 2-Character Rank Drift Indicator */}
                    <span
                      className={`font-mono text-[11.5px] w-[22px] flex-none text-center tabular-nums select-none ${isNew
                          ? "text-music-accent font-medium"
                          : isNeutral
                            ? "text-[#4A4A46]"
                            : "text-[#8A8A83]"
                        }`}
                      title={`Rank drift: ${track.drift}`}
                    >
                      {isNew ? "New" : track.drift}
                    </span>

                    {/* 38px Square Real Album Art with Color Swatch Fallback */}
                    <Artwork
                      src={track.albumImageUrl}
                      alt={track.album || track.name}
                      size={38}
                      swatchColor={track.swatchColor}
                    />

                    {/* Stacked Track Title & Metadata */}
                    <div className="min-w-0 flex-1 pl-1">
                      <span
                        {...profileLinkProps("track", track.id, track.name, onOpenProfile)}
                        className="block font-sans text-[14px] tracking-[-0.01em] text-[#EDEDE8] truncate group-hover:text-music-accent motion-hover leading-snug select-none focus-visible:outline-music-accent"
                      >
                        {track.name}
                      </span>
                      <div className="font-mono text-[12.5px] text-[#6A6A64] truncate leading-tight mt-0.5 select-none">
                        {track.artistKey ? (
                          <span
                            {...profileLinkProps("artist", track.artistKey, track.artist, onOpenProfile)}
                            className="hover:text-[#EDEDE8] hover:underline hover:decoration-dotted text-inherit focus-visible:outline-music-accent"
                          >
                            {track.artist}
                          </span>
                        ) : (
                          <span>{track.artist}</span>
                        )}
                        {" • "}
                        {track.albumKey ? (
                          <span
                            {...profileLinkProps("album", track.albumKey, track.album, onOpenProfile)}
                            className="hover:text-[#EDEDE8] hover:underline hover:decoration-dotted text-inherit focus-visible:outline-music-accent"
                          >
                            {track.album}
                          </span>
                        ) : (
                          <span>{track.album}</span>
                        )}
                        {" • "}
                        <span>{track.duration}</span>
                      </div>
                    </div>

                    {/* Play Count */}
                    <span className="font-mono text-[12px] text-[#8A8A83] flex-none tabular-nums select-all">
                      {track.plays.toLocaleString()}
                    </span>
                  </div>
                );
              })}
              {Array.from({ length: trackPlaceholderCount }).map((_, idx) => (
                <div
                  key={`track-ph-${idx}`}
                  className={`h-[54px] md:h-[55px] ${idx === trackPlaceholderCount - 1
                      ? "border-b-0"
                      : "border-b border-[#191917]"
                    }`}
                  aria-hidden="true"
                />
              ))}
            </>
          )}
        </div>
      </div>

      {/* Right Column: Artist Index, Album Index, Activity Tracker (1fr) */}
      <div className="flex flex-col gap-4 md:gap-0 md:justify-between h-full min-w-0">
        {/* Artist index (top 5) */}
        <div>
          <div className="font-mono text-[12px] text-[#5A5A55] mb-2 select-none">
            Artist index
          </div>
          <div className={`flex flex-col ${isArtistsSkeleton ? "" : "animate-content-enter"}`} role="list">
            {isArtistsSkeleton ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <div
                  key={idx}
                  className={`flex items-baseline gap-2.5 py-2 px-1 animate-pulse ${idx === 4 ? "border-b-0" : "border-b border-[#191917]"
                    }`}
                >
                  <span className="font-mono text-[12px] text-[#2E2E2A] w-[18px] flex-none tabular-nums select-none">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <div className="h-3 bg-[#191917] rounded w-28 flex-1" />
                  <div className="h-3 bg-[#141413] rounded w-6 flex-none" />
                </div>
              ))
            ) : (
              <>
                {topArtists.map((artist, idx) => {
                  const isLast = idx === topArtists.length - 1 && topArtists.length >= 5;
                  const artistKey = artist.key ?? artist.id;
                  return (
                    <div
                      key={artist.name}
                      role="listitem"
                      data-profile-kind={artistKey ? "artist" : undefined}
                      onClick={artistKey ? () => onOpenProfile?.({ kind: "artist", key: artistKey }) : undefined}
                      className={`group flex items-baseline gap-2.5 py-2 px-1 motion-hover ${artistKey ? "cursor-pointer hover:bg-[#111110]" : ""} ${isLast ? "border-b-0" : "border-b border-[#191917]"
                        }`}
                    >
                      <span className="font-mono text-[12px] text-[#4A4A46] w-[18px] flex-none tabular-nums select-none">
                        {artist.rank}
                      </span>
                      <span
                        {...(artistKey ? profileLinkProps("artist", artistKey, artist.name, onOpenProfile) : {})}
                        className="font-sans text-[13px] text-[#EDEDE8] flex-1 truncate group-hover:text-music-accent motion-hover focus-visible:outline-music-accent"
                      >
                        {artist.name}
                      </span>
                      <span className="font-mono text-[12px] text-[#8A8A83] flex-none tabular-nums select-all">
                        {artist.count.toLocaleString()}
                      </span>
                    </div>
                  );
                })}
                {Array.from({ length: artistPlaceholderCount }).map((_, idx) => (
                  <div
                    key={`artist-ph-${idx}`}
                    className={`h-[35px] ${idx === artistPlaceholderCount - 1
                        ? "border-b-0"
                        : "border-b border-[#191917]"
                      }`}
                    aria-hidden="true"
                  />
                ))}
              </>
            )}
          </div>
        </div>

        {/* Album index (top 5) */}
        <div>
          <div className="font-mono text-[12px] text-[#5A5A55] mb-2 select-none">
            Album index
          </div>
          <div className={`flex flex-col ${isAlbumsSkeleton ? "" : "animate-content-enter"}`} role="list">
            {isAlbumsSkeleton ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <div
                  key={idx}
                  className={`flex items-baseline gap-2.5 py-2 px-1 animate-pulse ${idx === 4 ? "border-b-0" : "border-b border-[#191917]"
                    }`}
                >
                  <span className="font-mono text-[12px] text-[#2E2E2A] w-[18px] flex-none tabular-nums select-none">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <div className="h-3 bg-[#191917] rounded w-32 flex-1" />
                  <div className="h-3 bg-[#141413] rounded w-6 flex-none" />
                </div>
              ))
            ) : (
              <>
                {topAlbums.map((album, idx) => {
                  const isLast = idx === topAlbums.length - 1 && topAlbums.length >= 5;
                  const albumKey = album.key ?? album.id;
                  const albumArtistKey = album.artistKey ?? album.artistId;
                  return (
                    <div
                      key={album.name}
                      role="listitem"
                      data-profile-kind={albumKey ? "album" : undefined}
                      onClick={albumKey ? () => onOpenProfile?.({ kind: "album", key: albumKey }) : undefined}
                      className={`group flex items-baseline gap-2.5 py-2 px-1 motion-hover ${albumKey ? "cursor-pointer hover:bg-[#111110]" : ""} ${isLast ? "border-b-0" : "border-b border-[#191917]"
                        }`}
                    >
                      <span className="font-mono text-[12px] text-[#4A4A46] w-[18px] flex-none tabular-nums select-none">
                        {album.rank}
                      </span>
                      <div className="flex-1 min-w-0 flex items-baseline gap-2 overflow-hidden">
                        <span
                          {...(albumKey ? profileLinkProps("album", albumKey, album.name, onOpenProfile) : {})}
                          className="font-sans text-[13px] text-[#EDEDE8] truncate group-hover:text-music-accent motion-hover focus-visible:outline-music-accent"
                        >
                          {album.name}
                        </span>
                        <span
                          {...(albumArtistKey ? profileLinkProps("artist", albumArtistKey, album.artist, onOpenProfile) : {})}
                          className={`font-mono text-[12px] text-[#6A6A64] truncate focus-visible:outline-music-accent ${albumArtistKey ? "hover:text-[#EDEDE8] hover:underline hover:decoration-dotted" : ""}`}
                        >
                          {album.artist}
                        </span>
                      </div>
                      <span className="font-mono text-[12px] text-[#8A8A83] flex-none tabular-nums select-all">
                        {album.count.toLocaleString()}
                      </span>
                    </div>
                  );
                })}
                {Array.from({ length: albumPlaceholderCount }).map((_, idx) => (
                  <div
                    key={`album-ph-${idx}`}
                    className={`h-[35px] ${idx === albumPlaceholderCount - 1
                        ? "border-b-0"
                        : "border-b border-[#191917]"
                      }`}
                    aria-hidden="true"
                  />
                ))}
              </>
            )}
          </div>
        </div>

        {/* Activity Tracker */}
        <ActivityChart
          granularity={granularity}
          rangeKey={rangeKey}
          rangeLabel={rangeLabel}
          activityCadence={activityCadence}
          isLoading={isLoading}
          onSelectBucket={onSelectBucket}
        />
      </div>
    </div>
  );
};
