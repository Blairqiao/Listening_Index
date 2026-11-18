"use client";

import React from "react";
import { TrackSummary, AlbumSummary, RangeKey, ActivityDay } from "@/lib/types";
import { Artwork } from "../Artwork";
import { ActivityChart } from "./ActivityChart";

interface OverviewViewProps {
  range: RangeKey;
  topTracks: TrackSummary[];
  topArtists: Array<{ rank: string; name: string; count: number; id?: string }>;
  topAlbums: AlbumSummary[];
  activityCadence?: ActivityDay[];
  isLoading?: boolean;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  range,
  topTracks,
  topArtists,
  topAlbums,
  activityCadence = [],
  isLoading = false,
}) => {
  const displayTracks = topTracks;

  const trackPlaceholderCount = Math.max(0, 10 - displayTracks.length);
  const artistPlaceholderCount = Math.max(0, 5 - topArtists.length);
  const albumPlaceholderCount = Math.max(0, 5 - topAlbums.length);

  return (
    <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-4 md:gap-[26px] mt-4 md:mt-6">
      {/* Left Column: Top Tracks (1.5fr) */}
      <div className="min-w-0">
        <div className="flex justify-between items-baseline mb-2 select-none">
          <span className="font-mono text-[11px] tracking-[0.14em] text-[#5A5A55]">
            [ TOP TRACKS ]
          </span>
          <span className="font-mono text-[11px] tracking-[0.14em] text-[#5A5A55]">
            PLAYS
          </span>
        </div>

        <div className="flex flex-col" role="list">
          {isLoading && topTracks.length === 0 ? (
            Array.from({ length: 5 }).map((_, idx) => (
              <div
                key={idx}
                className={`flex items-center gap-3 px-1 h-[54px] md:h-[55px] animate-pulse ${idx === 4 ? "border-b-0" : "border-b border-[#191917]"
                  }`}
              >
                <span className="font-mono text-[11px] text-[#2E2E2A] w-[18px] flex-none">
                  {String(idx + 1).padStart(2, "0")}
                </span>
                <span className="font-mono text-[10.5px] w-[22px] flex-none text-center text-[#2E2E2A]">
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
                    onClick={() =>
                      window.open(
                        `https://open.spotify.com/track/${track.id}`,
                        "_blank",
                        "noopener,noreferrer"
                      )
                    }
                    className={`group flex items-center gap-3 px-1 h-[54px] md:h-[55px] cursor-pointer transition-none hover:bg-[#111110] ${isLast ? "border-b-0" : "border-b border-[#191917]"
                      }`}
                  >
                    {/* Rank Index */}
                    <span className="font-mono text-[11px] text-[#4A4A46] w-[18px] flex-none tabular-nums select-none">
                      {track.rank}
                    </span>

                    {/* 2-Character Rank Drift Indicator */}
                    <span
                      className={`font-mono text-[10.5px] w-[22px] flex-none text-center tabular-nums select-none ${isNew
                          ? "text-music-accent font-medium"
                          : isNeutral
                            ? "text-[#4A4A46]"
                            : "text-[#8A8A83]"
                        }`}
                      title={`Rank drift: ${track.drift}`}
                    >
                      {track.drift}
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
                      <a
                        href={`https://open.spotify.com/track/${track.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="block font-sans text-[14px] tracking-[-0.01em] text-[#EDEDE8] truncate group-hover:text-music-accent transition-none leading-snug no-underline select-none"
                      >
                        {track.name}
                      </a>
                      <div className="font-mono text-[11.5px] text-[#6A6A64] truncate leading-tight mt-0.5 select-none">
                        {track.artistId ? (
                          <a
                            href={`https://open.spotify.com/artist/${track.artistId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="hover:text-[#EDEDE8] hover:underline hover:decoration-dotted no-underline text-inherit"
                          >
                            {track.artist}
                          </a>
                        ) : (
                          <span>{track.artist}</span>
                        )}
                        {" • "}
                        {track.albumId ? (
                          <a
                            href={`https://open.spotify.com/album/${track.albumId}`}
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
                        {" • "}
                        <span>{track.duration}</span>
                      </div>
                    </div>

                    {/* Play Count */}
                    <span className="font-mono text-[11px] text-[#8A8A83] flex-none tabular-nums select-all">
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
        {/* [ ARTIST INDEX ] (Top 5) */}
        <div>
          <div className="font-mono text-[11px] tracking-[0.14em] text-[#5A5A55] mb-2 select-none">
            [ ARTIST INDEX ]
          </div>
          <div className="flex flex-col" role="list">
            {isLoading && topArtists.length === 0 ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <div
                  key={idx}
                  className={`flex items-baseline gap-2.5 py-2 px-1 animate-pulse ${idx === 4 ? "border-b-0" : "border-b border-[#191917]"
                    }`}
                >
                  <span className="font-mono text-[11px] text-[#2E2E2A] w-[18px] flex-none tabular-nums select-none">
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
                  return (
                    <a
                      key={artist.name}
                      role="listitem"
                      href={artist.id ? `https://open.spotify.com/artist/${artist.id}` : undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`group flex items-baseline gap-2.5 py-2 px-1 cursor-pointer no-underline hover:bg-[#111110] transition-none ${isLast ? "border-b-0" : "border-b border-[#191917]"
                        }`}
                    >
                      <span className="font-mono text-[11px] text-[#4A4A46] w-[18px] flex-none tabular-nums select-none">
                        {artist.rank}
                      </span>
                      <span className="font-sans text-[13px] text-[#EDEDE8] flex-1 truncate group-hover:text-music-accent transition-none">
                        {artist.name}
                      </span>
                      <span className="font-mono text-[11px] text-[#8A8A83] flex-none tabular-nums select-all">
                        {artist.count.toLocaleString()}
                      </span>
                    </a>
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

        {/* [ ALBUM INDEX ] (Top 5) */}
        <div>
          <div className="font-mono text-[11px] tracking-[0.14em] text-[#5A5A55] mb-2 select-none">
            [ ALBUM INDEX ]
          </div>
          <div className="flex flex-col" role="list">
            {isLoading && topAlbums.length === 0 ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <div
                  key={idx}
                  className={`flex items-baseline gap-2.5 py-2 px-1 animate-pulse ${idx === 4 ? "border-b-0" : "border-b border-[#191917]"
                    }`}
                >
                  <span className="font-mono text-[11px] text-[#2E2E2A] w-[18px] flex-none tabular-nums select-none">
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
                  return (
                    <div
                      key={album.name}
                      role="listitem"
                      onClick={() =>
                        album.id &&
                        window.open(
                          `https://open.spotify.com/album/${album.id}`,
                          "_blank",
                          "noopener,noreferrer"
                        )
                      }
                      className={`group flex items-baseline gap-2.5 py-2 px-1 cursor-pointer hover:bg-[#111110] transition-none ${isLast ? "border-b-0" : "border-b border-[#191917]"
                        }`}
                    >
                      <span className="font-mono text-[11px] text-[#4A4A46] w-[18px] flex-none tabular-nums select-none">
                        {album.rank}
                      </span>
                      <div className="flex-1 min-w-0 flex items-baseline gap-2 overflow-hidden">
                        <a
                          href={album.id ? `https://open.spotify.com/album/${album.id}` : undefined}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="font-sans text-[13px] text-[#EDEDE8] truncate group-hover:text-music-accent transition-none no-underline"
                        >
                          {album.name}
                        </a>
                        <a
                          href={
                            album.artistId
                              ? `https://open.spotify.com/artist/${album.artistId}`
                              : undefined
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="font-mono text-[11px] text-[#6A6A64] truncate hover:text-[#EDEDE8] hover:underline hover:decoration-dotted no-underline"
                        >
                          {album.artist}
                        </a>
                      </div>
                      <span className="font-mono text-[11px] text-[#8A8A83] flex-none tabular-nums select-all">
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
          range={range}
          activityCadence={activityCadence}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
};
