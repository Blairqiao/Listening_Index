"use client";

import React from "react";
import { ArrowUpRight } from "lucide-react";
import { Artwork } from "@/components/Artwork";
import { formatRankDisplay } from "@/lib/format-utils";
import { formatLogStartDate } from "@/lib/db/queries/helpers";
import {
  formatListeningDuration,
  formatShare,
  formatStreakSentence,
} from "@/lib/profile-stats";
import type { ProfileData, ProfileKind, ProfileTarget } from "@/lib/search-types";

export interface ProfileHeaderProps {
  data: ProfileData;
  visitorTimezone: string;
  onOpenProfile: (target: ProfileTarget) => void;
  rankFormat?: "rank" | "percentile";
  onToggleRankFormat?: () => void;
}

const KICKER_BY_KIND: Record<ProfileKind, string> = {
  track: "[ TRACK ]",
  artist: "[ ARTIST ]",
  album: "[ ALBUM ]",
};

function formatPlayDate(iso: string | null | undefined, tz: string): string {
  if (!iso) return "--";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "--";
  return formatLogStartDate(date, tz);
}

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({
  data,
  visitorTimezone,
  onOpenProfile,
  rankFormat = "rank",
  onToggleRankFormat,
}) => {
  const isTrack = data.kind === "track";
  const isArtist = data.kind === "artist";
  const isAlbum = data.kind === "album";

  const artistKey = data.artistKey;
  const albumKey = data.albumKey;

  const spotifyUrl = /^[a-zA-Z0-9]{22}$/.test(data.key)
    ? `https://open.spotify.com/${data.kind}/${data.key}`
    : null;

  const hasDates = Boolean(data.firstPlayedAt || data.lastPlayedAt);
  const firstPlayDate = formatPlayDate(data.firstPlayedAt, visitorTimezone);
  const lastPlayDate = formatPlayDate(data.lastPlayedAt, visitorTimezone);

  const hasRank = typeof data.rank === "number" && data.rank > 0;
  const rankValue = hasRank
    ? formatRankDisplay(data.rank, data.rankedTotal, rankFormat)
    : "--";

  const streakSentence = data.stats ? formatStreakSentence(data.stats) : null;

  return (
    <div className="min-w-0 md:col-span-full">
      <div className="flex flex-wrap md:flex-nowrap items-center gap-3 md:gap-4">
        <Artwork src={data.imageUrl} alt={data.name} size={88} />

        <div className="min-w-0 flex-1">
          <div className="font-mono text-[10.5px] tracking-[0.16em] text-music-accent mb-1 select-none">
            {KICKER_BY_KIND[data.kind]}
          </div>

          <div className="font-sans text-[20px] md:text-[24px] font-medium tracking-[-0.01em] text-[#EDEDE8] leading-tight select-none">
            {spotifyUrl ? (
              <a
                href={spotifyUrl}
                target="_blank"
                rel="noopener noreferrer"
                title={data.name}
                className="group inline-flex max-w-full items-baseline hover:text-music-accent focus-visible:outline-music-accent"
              >
                <span className="line-clamp-2">{data.name}</span>
                <span className="inline-flex h-6 w-6 items-center justify-center flex-none ml-1 text-[#6A6A64] group-hover:text-music-accent">
                  <ArrowUpRight size={16} aria-hidden="true" />
                </span>
                <span className="sr-only">(opens in Spotify)</span>
              </a>
            ) : (
              <span className="line-clamp-2" title={data.name}>
                {data.name}
              </span>
            )}
          </div>

          {(isTrack || isAlbum) && data.artistName && (
            <div className="font-mono text-[11.5px] text-[#6A6A64] truncate leading-tight mt-0.5 select-none">
              <span className="text-[#5A5A55]">ARTIST · </span>
              {artistKey ? (
                <button
                  type="button"
                  onClick={() => onOpenProfile({ kind: "artist", key: artistKey })}
                  className="cursor-pointer text-[#A0A099] hover:text-music-accent focus-visible:outline-music-accent"
                >
                  {data.artistName} →
                </button>
              ) : (
                data.artistName
              )}
            </div>
          )}

          {isTrack && data.albumName && (
            <div className="mt-0.5 truncate font-mono text-[11.5px] leading-tight text-[#6A6A64] select-none">
              <span className="text-[#5A5A55]">ALBUM · </span>
              {albumKey ? (
                <button
                  type="button"
                  onClick={() => onOpenProfile({ kind: "album", key: albumKey })}
                  className="cursor-pointer text-[#A0A099] hover:text-music-accent focus-visible:outline-music-accent"
                >
                  {data.albumName} →
                </button>
              ) : (
                data.albumName
              )}
            </div>
          )}

          {hasDates && (
            <div className="font-mono text-[11.5px] text-[#6A6A64] leading-tight mt-0.5 select-none">
              FIRST PLAY {firstPlayDate} · LAST {lastPlayDate}
            </div>
          )}
        </div>

        <div className="w-full md:w-auto basis-full md:basis-auto border-t md:border-t-0 border-[#191917] pt-2.5 md:pt-0 md:flex-none">
          <div className="grid grid-cols-4 gap-x-5 gap-y-2">
            <div className="flex flex-col">
              <span className="font-mono text-[9.5px] md:text-[10px] tracking-[0.14em] text-[#5A5A55]">
                PLAYS
              </span>
              <span className="font-mono text-[13px] tabular-nums whitespace-nowrap text-[#EDEDE8]">
                {data.plays.toLocaleString()}
              </span>
            </div>

            {onToggleRankFormat && hasRank ? (
              <button
                type="button"
                onClick={onToggleRankFormat}
                aria-label={`Rank ${rankValue}. Toggle between rank position and percentile`}
                title="Click to toggle between rank and percentile"
                className="flex flex-col text-left cursor-pointer group focus-visible:outline-music-accent"
              >
                <span className="font-mono text-[9.5px] md:text-[10px] tracking-[0.14em] text-[#5A5A55]">
                  RANK
                </span>
                <span className="font-mono text-[13px] tabular-nums whitespace-nowrap text-[#EDEDE8] group-hover:text-music-accent">
                  {rankValue}
                </span>
              </button>
            ) : (
              <div className="flex flex-col">
                <span className="font-mono text-[9.5px] md:text-[10px] tracking-[0.14em] text-[#5A5A55]">
                  RANK
                </span>
                <span className="font-mono text-[13px] tabular-nums whitespace-nowrap text-[#EDEDE8]">
                  {rankValue}
                </span>
              </div>
            )}

            <div className="flex flex-col">
              <span className="font-mono text-[9.5px] md:text-[10px] tracking-[0.14em] text-[#5A5A55]">
                LISTENING TIME
              </span>
              <span className="font-mono text-[13px] tabular-nums whitespace-nowrap text-[#EDEDE8]">
                {data.stats ? formatListeningDuration(data.stats.totalMs) : "--"}
              </span>
            </div>

            <div className="flex flex-col">
              <span className="font-mono text-[9.5px] md:text-[10px] tracking-[0.14em] text-[#5A5A55]">
                ACTIVE DAYS
              </span>
              <span className="font-mono text-[13px] tabular-nums whitespace-nowrap text-[#EDEDE8]">
                {data.stats ? data.stats.activeDays.toLocaleString() : "--"}
              </span>
            </div>

            {isArtist && (
              <>
                <div className="flex flex-col">
                  <span className="font-mono text-[9.5px] md:text-[10px] tracking-[0.14em] text-[#5A5A55]">
                    PLAY SHARE
                  </span>
                  <span className="font-mono text-[13px] tabular-nums whitespace-nowrap text-[#8A8A83]">
                    {formatShare(data.stats?.playShare ?? null)}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="font-mono text-[9.5px] md:text-[10px] tracking-[0.14em] text-[#5A5A55]">
                    TRACKS HEARD
                  </span>
                  <span className="font-mono text-[13px] tabular-nums whitespace-nowrap text-[#8A8A83]">
                    {`${(data.stats?.tracksHeardInRange ?? 0).toLocaleString()} / ${(data.stats?.tracksHeardLifetime ?? 0).toLocaleString()}`}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="font-mono text-[9.5px] md:text-[10px] tracking-[0.14em] text-[#5A5A55]">
                    COMPLETION
                  </span>
                  <span className="font-mono text-[13px] tabular-nums whitespace-nowrap text-[#8A8A83]">
                    {formatShare(data.stats?.completionRate ?? null)}
                  </span>
                </div>
                <div aria-hidden="true" />
              </>
            )}

            {isAlbum && (
              <>
                <div className="flex flex-col">
                  <span className="font-mono text-[9.5px] md:text-[10px] tracking-[0.14em] text-[#5A5A55]">
                    ARTIST SHARE
                  </span>
                  <span className="font-mono text-[13px] tabular-nums whitespace-nowrap text-[#8A8A83]">
                    {formatShare(data.stats?.artistShare ?? null)}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="font-mono text-[9.5px] md:text-[10px] tracking-[0.14em] text-[#5A5A55]">
                    TRACKS HEARD
                  </span>
                  <span className="font-mono text-[13px] tabular-nums whitespace-nowrap text-[#8A8A83]">
                    {`${(data.stats?.tracksHeardInRange ?? 0).toLocaleString()} / ${(data.stats?.tracksHeardLifetime ?? 0).toLocaleString()}`}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="font-mono text-[9.5px] md:text-[10px] tracking-[0.14em] text-[#5A5A55]">
                    FULL-ALBUM SESSIONS
                  </span>
                  <span className="font-mono text-[13px] tabular-nums whitespace-nowrap text-[#8A8A83]">
                    {(data.stats?.fullAlbumSessions ?? 0).toLocaleString()}
                  </span>
                </div>
                <div aria-hidden="true" />
              </>
            )}

            {isTrack && (
              <>
                <div className="flex flex-col">
                  <span className="font-mono text-[9.5px] md:text-[10px] tracking-[0.14em] text-[#5A5A55]">
                    COMPLETION
                  </span>
                  <span className="font-mono text-[13px] tabular-nums whitespace-nowrap text-[#8A8A83]">
                    {formatShare(data.stats?.completionRate ?? null)}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="font-mono text-[9.5px] md:text-[10px] tracking-[0.14em] text-[#5A5A55]">
                    ALBUM SHARE
                  </span>
                  <span className="font-mono text-[13px] tabular-nums whitespace-nowrap text-[#8A8A83]">
                    {formatShare(data.stats?.albumShare ?? null)}
                  </span>
                </div>
                <div aria-hidden="true" />
                <div aria-hidden="true" />
              </>
            )}
          </div>
        </div>
      </div>

      {streakSentence && (
        <div className="font-mono text-[11.5px] text-[#8A8A83] mt-3 select-none">
          {streakSentence}
        </div>
      )}
    </div>
  );
};
