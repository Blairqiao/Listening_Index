"use client";

import React, { useMemo, useState } from "react";
import { TrackSummary, AlbumSummary, RangeKey, ActivityDay } from "@/lib/mock-listening-data";
import { Artwork } from "./Artwork";
import { useDeferredEnrichment } from "@/lib/hooks/useDeferredEnrichment";
import { formatCadenceTooltip } from "@/lib/format-utils";

interface OverviewViewProps {
  range: RangeKey;
  topTracks: TrackSummary[];
  topArtists: Array<{ rank: string; name: string; count: number; id?: string }>;
  topAlbums: AlbumSummary[];
  activityCadence?: ActivityDay[];
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  range,
  topTracks,
  topArtists,
  topAlbums,
  activityCadence = [],
}) => {
  const [enrichmentOverlay, setEnrichmentOverlay] = useState<
    Map<string, { albumImageUrl: string | null; artistId?: string; albumId?: string }>
  >(new Map());

  const displayTracks = useMemo(() => {
    if (enrichmentOverlay.size === 0) return topTracks;
    return topTracks.map((t) => {
      const overlay = enrichmentOverlay.get(t.id);
      if (!overlay) return t;
      return {
        ...t,
        albumImageUrl: overlay.albumImageUrl ?? t.albumImageUrl,
        artistId: overlay.artistId ?? t.artistId,
        albumId: overlay.albumId ?? t.albumId,
      };
    });
  }, [topTracks, enrichmentOverlay]);

  useDeferredEnrichment({
    items: displayTracks,
    onEnriched: (enriched) => {
      setEnrichmentOverlay((prev) => {
        const next = new Map(prev);
        for (const item of enriched) {
          next.set(item.requestedId, {
            albumImageUrl: item.albumImageUrl,
            artistId: item.artistId,
            albumId: item.albumId,
          });
        }
        return next;
      });
    },
  });

  const maxCadence = useMemo(() => {
    if (activityCadence.length === 0) return 1;
    return Math.max(...activityCadence.map((d) => d.count), 1);
  }, [activityCadence]);

  const cadenceStartDate = activityCadence.length > 0 ? activityCadence[0].date : "";
  const cadenceEndDate =
    activityCadence.length > 0
      ? activityCadence[activityCadence.length - 1].date
      : "";

  return (
    <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-[26px] mt-4 md:mt-6">
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
          {topTracks.length === 0 ? (
            Array.from({ length: 5 }).map((_, idx) => (
              <div
                key={idx}
                className={`flex items-center gap-3 px-1 h-[54px] md:h-[55px] animate-pulse ${
                  idx === 4 ? "border-b-0" : "border-b border-[#191917]"
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
            displayTracks.map((track, idx) => {
            const isLast = idx === displayTracks.length - 1;
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
                className={`group flex items-center gap-3 px-1 h-[54px] md:h-[55px] cursor-pointer transition-none hover:bg-[#111110] ${
                  isLast ? "border-b-0" : "border-b border-[#191917]"
                }`}
              >
                {/* Rank Index */}
                <span className="font-mono text-[11px] text-[#4A4A46] w-[18px] flex-none tabular-nums select-none">
                  {track.rank}
                </span>

                {/* 2-Character Rank Drift Indicator */}
                <span
                  className={`font-mono text-[10.5px] w-[22px] flex-none text-center tabular-nums select-none ${
                    isNew
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
          }))}
        </div>
      </div>

      {/* Right Column: Artist Index, Album Index, Activity Tracker (1fr) */}
      <div className="min-w-0 flex flex-col justify-between h-full">
        {/* [ ARTIST INDEX ] (Top 5) */}
        <div>
          <div className="font-mono text-[11px] tracking-[0.14em] text-[#5A5A55] mb-2 select-none">
            [ ARTIST INDEX ]
          </div>
          <div className="flex flex-col" role="list">
            {topArtists.length === 0 ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <div
                  key={idx}
                  className={`flex items-baseline gap-2.5 py-2 px-1 animate-pulse ${
                    idx === 4 ? "border-b-0" : "border-b border-[#191917]"
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
              topArtists.map((artist, idx) => {
                const isLast = idx === topArtists.length - 1;
                return (
                  <a
                    key={artist.name}
                    role="listitem"
                    href={artist.id ? `https://open.spotify.com/artist/${artist.id}` : undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`group flex items-baseline gap-2.5 py-2 px-1 cursor-pointer no-underline hover:bg-[#111110] transition-none ${
                      isLast ? "border-b-0" : "border-b border-[#191917]"
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
              })
            )}
          </div>
        </div>

        {/* [ ALBUM INDEX ] (Top 5) */}
        <div>
          <div className="font-mono text-[11px] tracking-[0.14em] text-[#5A5A55] mb-2 select-none">
            [ ALBUM INDEX ]
          </div>
          <div className="flex flex-col" role="list">
            {topAlbums.length === 0 ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <div
                  key={idx}
                  className={`flex items-baseline gap-2.5 py-2 px-1 animate-pulse ${
                    idx === 4 ? "border-b-0" : "border-b border-[#191917]"
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
              topAlbums.map((album, idx) => {
                const isLast = idx === topAlbums.length - 1;
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
                    className={`group flex items-baseline gap-2.5 py-2 px-1 cursor-pointer hover:bg-[#111110] transition-none ${
                      isLast ? "border-b-0" : "border-b border-[#191917]"
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
              })
            )}
          </div>
        </div>

        {/* Activity Tracker */}
        <div>
          <div className="font-mono text-[11px] tracking-[0.14em] text-[#5A5A55] mb-2 select-none">
            [ ACTIVITY / {range === "all" ? "ALL" : range.toUpperCase()} ]
          </div>

            <div>
              <div
                className="flex gap-[2px] items-end h-[80px] w-full"
                role="img"
                aria-label="Activity cadence histogram"
              >
                {activityCadence.length === 0 ? (
                  Array.from({ length: 24 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-none bg-[#141413] animate-pulse select-none"
                      style={{ height: `${((i * 7 + 13) % 36) + 12}%` }}
                    />
                  ))
                ) : (
                  activityCadence.map((item, i) => {
                    const ratio = item.count / maxCadence;
                    const isHot = ratio > 0.8;
                    const heightPercent = Math.max(Math.round(ratio * 100), 4);

                    const isMarkerBar =
                      range === "1w"
                        ? (item.isMarker !== undefined ? item.isMarker : i % 4 === 0)
                        : Boolean(item.isMarker);

                    const tooltipText =
                      item.startTime && item.endTime
                        ? formatCadenceTooltip(item, range, "UTC")
                        : `${item.date} — ${item.count} plays`;

                    return (
                      <div
                        key={i}
                        title={tooltipText}
                        className={`flex-1 rounded-none select-none transition-none cursor-default ${
                          isHot
                            ? "bg-music-accent"
                            : isMarkerBar
                            ? "bg-[#2A2A26] hover:bg-[#3E3E38]"
                            : "bg-[#1C1C1A] hover:bg-[#2E2E2A]"
                        }`}
                        style={{
                          height: `${heightPercent}%`,
                        }}
                      />
                    );
                  })
                )}
              </div>

              {/* Contextual markers according to range */}
              {range === "1d" && (
                <div className="flex justify-between mt-1.5 font-mono text-[10px] text-[#5A5A55] select-none h-[14px] leading-[14px]">
                  <span>-24H</span>
                  <span>-12H</span>
                  <span>NOW</span>
                </div>
              )}

              {range === "1w" && (
                <div className="flex justify-between mt-1.5 font-mono text-[10px] text-[#5A5A55] select-none h-[14px] leading-[14px]">
                  {activityCadence
                    .filter((item, idx) =>
                      item.isMarker !== undefined ? item.isMarker : idx % 4 === 0
                    )
                    .map((item, i) => (
                      <span key={i} className="text-center flex-1 truncate">
                        {item.markerLabel || item.date.split(" ")[0]}
                      </span>
                    ))}
                </div>
              )}

              {range === "1m" && (
                <div className="flex justify-between mt-1.5 font-mono text-[10px] text-[#5A5A55] select-none h-[14px] leading-[14px]">
                  {activityCadence.some((item) => item.markerLabel) ? (
                    activityCadence
                      .filter((item) => item.markerLabel)
                      .map((item, i) => <span key={i}>{item.markerLabel}</span>)
                  ) : (
                    <>
                      <span>{activityCadence[0]?.date || cadenceStartDate}</span>
                      <span>{activityCadence[7]?.date || ""}</span>
                      <span>{activityCadence[14]?.date || ""}</span>
                      <span>{activityCadence[21]?.date || ""}</span>
                      <span>{activityCadence[activityCadence.length - 1]?.date || cadenceEndDate}</span>
                    </>
                  )}
                </div>
              )}

              {range === "6m" && (
                <div className="flex justify-between mt-1.5 font-mono text-[10px] text-[#5A5A55] select-none h-[14px] leading-[14px]">
                  {(activityCadence.some((item) => item.markerLabel)
                    ? activityCadence.filter((item) => item.markerLabel)
                    : activityCadence.filter((_, idx) => idx % 4 === 0 || idx === activityCadence.length - 1)
                  ).map((item, i) => (
                    <span key={i}>{item.markerLabel || item.date}</span>
                  ))}
                </div>
              )}

              {range === "1y" && (
                <div className="flex justify-between mt-1.5 font-mono text-[10px] text-[#5A5A55] select-none h-[14px] leading-[14px]">
                  {activityCadence.length <= 12 ? (
                    activityCadence.map((item, i) => (
                      <span key={i} className="text-center flex-1">
                        {item.date}
                      </span>
                    ))
                  ) : (
                    <>
                      <span>{cadenceStartDate}</span>
                      <span>
                        {activityCadence[Math.floor(activityCadence.length / 2)]?.date}
                      </span>
                      <span>{cadenceEndDate}</span>
                    </>
                  )}
                </div>
              )}

              {range === "all" && (
                <div className="flex justify-between mt-1.5 font-mono text-[10px] text-[#5A5A55] select-none h-[14px] leading-[14px]">
                  {activityCadence.map((item, i) => {
                    const year = item.startTime
                      ? new Date(item.startTime).getUTCFullYear()
                      : item.date;
                    return (
                      <span key={i} className="text-center flex-1">
                        {year}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
        </div>
      </div>
    </div>
  );
};
