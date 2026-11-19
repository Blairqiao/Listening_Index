"use client";

import React, { useMemo, useState } from "react";
import type { ProfileData, ProfileTarget } from "@/lib/search-types";
import { formatHHmmTz, formatDayGroupTz } from "@/lib/db/queries/helpers";
import { formatShare } from "@/lib/profile-stats";
import { HourHistogram } from "./HourHistogram";
import { Artwork } from "../../Artwork";
import { ActivityChart } from "../ActivityChart";

export interface ProfileViewProps {
  data: ProfileData | null;
  status: "loading" | "ready" | "not_found" | "error";
  visitorTimezone: string;
  onOpenProfile: (target: ProfileTarget) => void;
}

function ProfileRankedList({ label, heading, children }: { label: string; heading?: string; children: React.ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  const count = React.Children.count(children);

  return (
    <div>
      <div className="mb-2 flex justify-between font-mono text-[11px] tracking-[0.14em] text-[#5A5A55]">
        <span>{heading ?? <>[ TOP {label} ]</>}</span>
        <span>PLAYS</span>
      </div>
      <div className={`md:max-h-[165px] md:overflow-y-auto scrollbar-hidden ${expanded ? "" : "max-md:[&>*:nth-child(n+4)]:hidden"}`}>
        {children}
      </div>
      {count > 3 && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
          className="md:hidden w-full py-2 font-mono text-[10px] tracking-[0.12em] text-[#8A8A83] hover:text-[#EDEDE8] cursor-pointer"
        >
          {expanded ? `SHOW FEWER ${label} ⌃` : `SHOW ALL ${count} ${label} ⌄`}
        </button>
      )}
    </div>
  );
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  data,
  status,
  visitorTimezone,
  onOpenProfile,
}) => {
  const recentPlaysWithPresentation = useMemo(() => {
    if (!data?.recentPlays) return [];
    let previousDay: string | undefined;
    return data.recentPlays.map((play) => {
      const d = new Date(play.playedAt);
      const day = formatDayGroupTz(d, visitorTimezone);
      const dayGroup = day === previousDay ? undefined : day;
      previousDay = day;
      const timeStr = formatHHmmTz(d, visitorTimezone);
      return { ...play, dayGroup, timeStr };
    });
  }, [data?.recentPlays, visitorTimezone]);

  if (status === "not_found" || status === "error") {
    return (
      <div className="mt-4 md:mt-6 select-none">
        <div role="status" className="mt-6 font-mono text-[11px] text-[#5A5A55] tracking-[0.14em]">
          {status === "not_found" ? "[ NOT IN ARCHIVE ]" : "[ COULDN'T LOAD PROFILE ]"}
        </div>
      </div>
    );
  }

  if (status === "loading" && !data) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-4 md:gap-[26px] mt-4 md:mt-6 select-none">
        <div className="flex items-center gap-3 md:col-span-full">
          <div className="w-[38px] h-[38px] bg-[#141413] animate-pulse flex-none" />
          <div className="h-4 bg-[#191917] rounded w-40 animate-pulse" />
        </div>
        <div className="md:col-span-full">
          <ActivityChart
            range="1m"
            activityCadence={[]}
            isLoading={true}
            label="PLAYS"
            visitorTimezone={visitorTimezone}
          />
        </div>
        <div className="min-w-0">
          <div className="flex flex-col" role="list">
            {Array.from({ length: 5 }).map((_, idx) => (
              <div
                key={idx}
                className={`flex items-center gap-3 px-1 h-[54px] md:h-[55px] animate-pulse ${
                  idx === 4 ? "border-b-0" : "border-b border-[#191917]"
                }`}
              >
                <div className="w-[44px] h-3 bg-[#191917] rounded flex-none" />
                <div className="w-[38px] h-[38px] rounded bg-[#141413] flex-none" />
                <div className="min-w-0 flex-1 pl-1 space-y-1.5">
                  <div className="h-3.5 bg-[#191917] rounded w-36 max-w-[70%]" />
                  <div className="h-2.5 bg-[#141413] rounded w-24 max-w-[50%]" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="min-w-0 hidden md:block">
          <div className="font-mono text-[11px] tracking-[0.14em] text-[#5A5A55] mb-2 select-none">
            [ TOP TRACKS ]
          </div>
          <div className="flex flex-col" role="list">
            {Array.from({ length: 5 }).map((_, idx) => (
              <div
                key={idx}
                className={`flex items-center gap-3 px-1 h-[54px] md:h-[55px] animate-pulse ${
                  idx === 4 ? "border-b-0" : "border-b border-[#191917]"
                }`}
              >
                <span className="font-mono text-[11px] text-[#2E2E2A] w-[18px] flex-none">
                  {String(idx + 1).padStart(2, "0")}
                </span>
                <div className="w-[38px] h-[38px] rounded bg-[#141413] flex-none" />
                <div className="h-3.5 bg-[#191917] rounded w-36 flex-1" />
                <div className="h-3 bg-[#141413] rounded w-8 flex-none" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const artistKey = data.artistKey;
  const isTrack = data.kind === "track";
  const streak = data.trackStats?.longestStreakDays ?? 0;
  const albumTracks = data.albumTracks ?? [];
  const spotifyUrl = data.kind === "track" && /^[a-zA-Z0-9]{22}$/.test(data.key)
    ? `https://open.spotify.com/track/${data.key}`
    : null;

  return (
    <div
      className={`grid grid-cols-1 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-4 md:gap-[26px] mt-4 md:mt-6 select-none ${
        status === "loading" ? "opacity-60" : ""
      }`}
    >
      <div className={`flex items-center gap-3 min-w-0 md:col-span-full${isTrack ? " md:gap-4" : ""}`}>
        <Artwork
          src={data.imageUrl}
          alt={data.name}
          size={isTrack ? 88 : 38}
        />
        <div className="min-w-0 flex-1">
          <div className={`font-sans ${isTrack ? "text-[20px] md:text-[24px]" : "text-[15px]"} font-medium tracking-[-0.01em] text-[#EDEDE8] truncate leading-tight select-none`}>
            {data.name}
          </div>
          {isTrack && data.artistName && (
            <div className="font-mono text-[11.5px] text-[#6A6A64] truncate leading-tight mt-0.5 select-none">
              {artistKey && data.artistName ? (
                <button
                  type="button"
                  onClick={() => onOpenProfile({ kind: "artist", key: artistKey })}
                  className="cursor-pointer text-[#A0A099] hover:text-music-accent focus-visible:outline-music-accent"
                >{data.artistName}</button>
              ) : data.artistName}
            </div>
          )}
          {isTrack && data.albumName && (
            <div className="mt-0.5 truncate font-mono text-[11.5px] leading-tight text-[#6A6A64] select-none">
              {data.albumName}
            </div>
          )}
        </div>
        {spotifyUrl && (
          <a
            href={spotifyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-none self-start text-right font-mono text-[11px] tracking-[0.08em] text-[#8A8A83] hover:text-music-accent focus-visible:outline-music-accent"
          >
            SPOTIFY ↗
          </a>
        )}
      </div>

      <div className="min-w-0 md:col-span-full">
        <ActivityChart
          label="PLAYS"
          range={data.range}
          activityCadence={data.activityCadence}
          monthlyCadence={data.monthlyCadence}
          isLoading={status === "loading"}
          visitorTimezone={visitorTimezone}
        />
      </div>

      {isTrack && data.plays > 0 && (
        <>
          <dl className="flex flex-wrap gap-x-8 gap-y-3 self-start border-y border-[#191917] py-3 font-mono md:col-start-1 md:row-start-3">
            <div>
              <dt className="text-[11px] tracking-[0.14em] text-[#8A8A83]">SHARE OF ARTIST</dt>
              <dd className="mt-1 text-sm tabular-nums">{formatShare(data.trackStats?.artistShare ?? null)}</dd>
            </div>
            <div>
              <dt className="text-[11px] tracking-[0.14em] text-[#8A8A83]">LONGEST STREAK</dt>
              <dd className="mt-1 text-sm tabular-nums">
                {streak === 0 ? "—" : `${streak.toLocaleString()} ${streak === 1 ? "DAY" : "DAYS"}`}
              </dd>
            </div>
          </dl>

          <div className="flex min-w-0 flex-col gap-6 md:col-start-2 md:row-start-3 md:row-span-2">
            {data.hourOfDay && <HourHistogram counts={data.hourOfDay} />}
            {albumTracks.length >= 2 && (
              <ProfileRankedList key={data.key} label="TRACKS" heading="[ FROM THIS ALBUM ]">
                {albumTracks.map((track, idx) => {
                  const rowClass = "group flex items-center gap-3 px-1 h-[54px] md:h-[55px] w-full text-left border-b border-[#191917]";
                  const row = (
                    <>
                      <span className="font-mono text-[11px] text-[#4A4A46] w-[18px] flex-none tabular-nums select-none">
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                      <Artwork src={data.imageUrl} alt={track.name} size={38} />
                      <span className={`font-sans text-[14px] tracking-[-0.01em] flex-1 truncate leading-snug ${track.isCurrent ? "text-music-accent" : "text-[#EDEDE8] group-hover:text-music-accent"}`}>
                        {track.name}
                      </span>
                      <span className="font-mono text-[11px] text-[#8A8A83] flex-none tabular-nums select-all">
                        {track.plays.toLocaleString()}
                      </span>
                    </>
                  );

                  return track.isCurrent ? (
                    <div key={track.id} aria-current="true" className={rowClass}>{row}</div>
                  ) : (
                    <button
                      key={track.id}
                      type="button"
                      onClick={() => onOpenProfile({ kind: "track", key: track.id })}
                      className={`${rowClass} cursor-pointer hover:bg-[#111110] focus-visible:bg-[#111110] transition-none`}
                    >
                      {row}
                    </button>
                  );
                })}
              </ProfileRankedList>
            )}
          </div>
        </>
      )}

      {data.kind === "artist" && data.plays > 0 && (
        <div className="flex min-w-0 flex-col gap-6 md:col-start-2 md:row-start-3">
          <ProfileRankedList key={`${data.key}-tracks`} label="TRACKS">
            {data.topTracks.map((track, idx) => (
              <button
                key={track.id}
                type="button"
                onClick={() => onOpenProfile({ kind: "track", key: track.id })}
                className="group flex items-center gap-3 px-1 h-[54px] md:h-[55px] w-full text-left cursor-pointer hover:bg-[#111110] focus-visible:bg-[#111110] transition-none border-b border-[#191917]"
              >
                <span className="font-mono text-[11px] text-[#4A4A46] w-[18px] flex-none tabular-nums select-none">
                  {String(idx + 1).padStart(2, "0")}
                </span>
                <Artwork
                  src={track.albumImageUrl}
                  alt={track.name}
                  size={38}
                />
                <span className="font-sans text-[14px] tracking-[-0.01em] text-[#EDEDE8] flex-1 truncate group-hover:text-music-accent transition-none leading-snug">
                  {track.name}
                </span>
                <span className="font-mono text-[11px] text-[#8A8A83] flex-none tabular-nums select-all">
                  {track.plays.toLocaleString()}
                </span>
              </button>
            ))}
          </ProfileRankedList>
          <ProfileRankedList key={`${data.key}-albums`} label="ALBUMS">
            {data.topAlbums.map((album, idx) => {
              const isLast = idx === data.topAlbums.length - 1;
              return (
                <div
                  key={album.id || album.name}
                  className={`group flex items-center gap-3 px-1 h-[54px] md:h-[55px] ${
                    isLast ? "border-b-0" : "border-b border-[#191917]"
                  }`}
                >
                  <span className="font-mono text-[11px] text-[#4A4A46] w-[18px] flex-none tabular-nums select-none">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <Artwork
                    src={album.imageUrl}
                    alt={album.name}
                    size={38}
                  />
                  <span className="font-sans text-[13px] text-[#EDEDE8] flex-1 truncate leading-snug">
                    {album.name}
                  </span>
                  <span className="font-mono text-[11px] text-[#8A8A83] flex-none tabular-nums select-all">
                    {album.plays.toLocaleString()}
                  </span>
                </div>
              );
            })}
          </ProfileRankedList>
        </div>
      )}

      <div className={`min-w-0 md:max-h-[420px] md:overflow-y-auto scrollbar-hidden ${isTrack ? (data.plays > 0 ? "md:col-start-1 md:row-start-4" : "md:col-span-full") : "md:col-start-1 md:row-start-3"}`}>
        {data.plays === 0 ? (
          <div className="font-mono text-[11px] tracking-[0.14em] text-[#5A5A55] py-4 select-none">
            [ NO PLAYS IN THIS RANGE ]
          </div>
        ) : (
          <div>
            <div className="flex justify-between items-baseline mb-2 select-none">
              <span className="font-mono text-[11px] tracking-[0.14em] text-[#5A5A55]">
                [ RECENT PLAYS ]
              </span>
            </div>
            <div className="flex flex-col">
              {recentPlaysWithPresentation.map((play) => {
                const row = (
                  <>
                    <span className="font-mono text-[11px] text-[#5A5A55] tabular-nums select-none flex-none w-[44px]">
                      {play.timeStr}
                    </span>
                    <Artwork
                      src={play.albumImageUrl}
                      alt={play.album || play.title}
                      size={38}
                    />
                    <div className="min-w-0 flex-1 pl-1">
                      <span className="block font-sans text-[14px] tracking-[-0.01em] text-[#EDEDE8] truncate leading-snug select-none">
                        {play.title}
                      </span>
                      {data.kind === "artist" && play.album && (
                        <span className="block font-mono text-[11.5px] text-[#6A6A64] truncate leading-tight mt-0.5 select-none">
                          {play.album}
                        </span>
                      )}
                    </div>
                  </>
                );

                return (
                  <React.Fragment key={play.id}>
                    {play.dayGroup && (
                      <div className="pt-3 pb-1 px-1 border-b border-[#1C1C1A] select-none">
                        <span className="font-mono text-[11px] tracking-[0.14em] text-[#5A5A55]">
                          {play.dayGroup}
                        </span>
                      </div>
                    )}
                    {data.kind === "artist" ? (
                      <button
                        type="button"
                        aria-label={`Open Track profile for ${play.title}`}
                        onClick={() => onOpenProfile({ kind: "track", key: play.trackId })}
                        className="flex w-full items-center gap-3 border-b border-[#191917] px-1 h-[54px] md:h-[55px] text-left cursor-pointer hover:bg-[#111110] focus-visible:outline-music-accent"
                      >
                        {row}
                      </button>
                    ) : (
                      <div className="flex items-center gap-3 px-1 h-[54px] md:h-[55px] border-b border-[#191917]">
                        {row}
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        )}
      </div>

    </div>
  );
};
