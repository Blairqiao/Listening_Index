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
  track: "Track",
  artist: "Artist",
  album: "Album",
};

function formatPlayDate(iso: string | null | undefined, tz: string): string {
  if (!iso) return "--";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "--";
  return formatLogStartDate(date, tz);
}

const STAT_LABEL_CLASS = "font-mono text-[10.5px] md:text-[11px] text-[#5A5A55]";
const STAT_VALUE_CLASS = "font-mono text-[13px] tabular-nums whitespace-nowrap";

const StatCell: React.FC<{ label: string; value: string; muted?: boolean }> = ({
  label,
  value,
  muted = false,
}) => (
  <div className="flex flex-col">
    <span className={STAT_LABEL_CLASS}>{label}</span>
    <span className={`${STAT_VALUE_CLASS} ${muted ? "text-[#8A8A83]" : "text-[#EDEDE8]"}`}>{value}</span>
  </div>
);

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
  const tracksHeard = `${(data.stats?.tracksHeardInRange ?? 0).toLocaleString()} / ${(data.stats?.tracksHeardLifetime ?? 0).toLocaleString()}`;

  return (
    <div className="min-w-0 md:col-span-full">
      <div className="flex items-center gap-3 md:gap-4">
        <Artwork src={data.imageUrl} alt={data.name} size={88} />

        <div className="min-w-0 flex-1">
          <div className="font-mono text-[11.5px] text-music-accent mb-1 select-none">
            {KICKER_BY_KIND[data.kind]}
          </div>

          <div className="font-sans text-[20px] md:text-[24px] font-medium tracking-[-0.01em] text-[#EDEDE8] leading-tight select-none">
            {spotifyUrl ? (
              <a
                href={spotifyUrl}
                target="_blank"
                rel="noopener noreferrer"
                title={data.name}
                className="group inline-flex max-w-full items-baseline hover:text-music-accent focus-ring motion-hover"
              >
                <span className="line-clamp-2">{data.name}</span>
                <span className="inline-flex h-6 w-6 items-center justify-center flex-none ml-1 text-[#6A6A64] group-hover:text-music-accent motion-hover">
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
            <div className={`font-mono text-[12.5px] text-[#6A6A64] truncate leading-tight mt-0.5 ${isTrack && data.albumName ? "py-[3px] -my-[3px]" : "py-2 -my-2"} select-none`}>
              <span className="text-[#5A5A55]">Artist · </span>
              {artistKey ? (
                <button
                  type="button"
                  onClick={() => onOpenProfile({ kind: "artist", key: artistKey })}
                  className="relative cursor-pointer text-[#A0A099] hover:text-music-accent focus-ring hit-area motion-hover"
                >
                  {data.artistName}
                </button>
              ) : (
                data.artistName
              )}
            </div>
          )}

          {isTrack && data.albumName && (
            <div className="mt-1 py-[3px] -my-[3px] truncate font-mono text-[12.5px] leading-tight text-[#6A6A64] select-none">
              <span className="text-[#5A5A55]">Album · </span>
              {albumKey ? (
                <button
                  type="button"
                  onClick={() => onOpenProfile({ kind: "album", key: albumKey })}
                  className="relative cursor-pointer text-[#A0A099] hover:text-music-accent focus-ring hit-area motion-hover"
                >
                  {data.albumName}
                </button>
              ) : (
                data.albumName
              )}
            </div>
          )}

        </div>
      </div>

      <div
        data-profile-stats=""
        className="mt-3 md:mt-4 flex flex-wrap md:justify-between gap-x-6 gap-y-2.5 border-t border-[#191917] pt-2.5 md:pt-3"
      >
        <StatCell label="Plays" value={data.plays.toLocaleString()} />

        {onToggleRankFormat && hasRank ? (
          <button
            type="button"
            onClick={onToggleRankFormat}
            aria-label={`Rank ${rankValue}. Toggle between rank position and percentile`}
            title="Click to toggle between rank and percentile"
            className="flex flex-col text-left cursor-pointer group focus-ring"
          >
            <span className={STAT_LABEL_CLASS}>Rank</span>
            <span className={`${STAT_VALUE_CLASS} text-[#EDEDE8] group-hover:text-music-accent motion-hover`}>
              {rankValue}
            </span>
          </button>
        ) : (
          <StatCell label="Rank" value={rankValue} />
        )}

        <StatCell
          label="Listening time"
          value={data.stats ? formatListeningDuration(data.stats.totalMs) : "--"}
        />
        <StatCell
          label="Active days"
          value={data.stats ? data.stats.activeDays.toLocaleString() : "--"}
        />

        {isArtist && (
          <>
            <StatCell label="Play share" value={formatShare(data.stats?.playShare ?? null)} muted />
            <StatCell label="Tracks heard" value={tracksHeard} muted />
            <StatCell label="Completion" value={formatShare(data.stats?.completionRate ?? null)} muted />
          </>
        )}

        {isAlbum && (
          <>
            <StatCell label="Artist share" value={formatShare(data.stats?.artistShare ?? null)} muted />
            <StatCell label="Tracks heard" value={tracksHeard} muted />
            <StatCell
              label="Full-album sessions"
              value={(data.stats?.fullAlbumSessions ?? 0).toLocaleString()}
              muted
            />
          </>
        )}

        {isTrack && (
          <>
            <StatCell label="Completion" value={formatShare(data.stats?.completionRate ?? null)} muted />
            <StatCell label="Album share" value={formatShare(data.stats?.albumShare ?? null)} muted />
          </>
        )}

        {hasDates && (
          <>
            <StatCell label="First play" value={firstPlayDate} muted />
            <StatCell label="Last play" value={lastPlayDate} muted />
          </>
        )}
      </div>

      {streakSentence && (
        <div className="font-mono text-[12.5px] text-[#8A8A83] mt-3 select-none">
          {streakSentence}
        </div>
      )}
    </div>
  );
};
