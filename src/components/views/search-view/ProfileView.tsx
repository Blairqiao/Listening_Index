"use client";

import React, { useMemo } from "react";
import type { ProfileData, ProfileTarget } from "@/lib/search-types";
import { formatHHmmTz, formatDayGroupTz, formatLogStartDate } from "@/lib/db/queries/helpers";
import { Artwork } from "../../Artwork";
import { ActivityChart } from "../ActivityChart";

export interface ProfileViewProps {
  data: ProfileData | null;
  status: "loading" | "ready" | "not_found" | "error";
  visitorTimezone: string;
  onBack: () => void;
  onOpenProfile: (target: ProfileTarget) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  data,
  status,
  visitorTimezone,
  onBack,
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

  const backButton = (
    <button
      type="button"
      onClick={onBack}
      className="font-mono text-[11px] tracking-[0.14em] text-[#5A5A55] hover:text-[#EDEDE8] transition-none cursor-pointer flex-none"
    >
      [ ← SEARCH ]
    </button>
  );

  if (status === "not_found" || status === "error") {
    return (
      <div className="mt-4 md:mt-6 select-none">
        {backButton}
        <div role="status" className="mt-6 font-mono text-[11px] text-[#5A5A55] tracking-[0.14em]">
          {status === "not_found" ? "[ NOT IN ARCHIVE ]" : "[ COULDN'T LOAD PROFILE ]"}
        </div>
      </div>
    );
  }

  if (status === "loading" && !data) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-4 md:gap-[26px] mt-4 md:mt-6 select-none">
        {/* Left Column: header placeholder, chart placeholder, list placeholder */}
        <div className="min-w-0 md:h-[560px] md:overflow-y-auto scrollbar-hidden">
          <div className="flex items-center gap-3 mb-4">
            {backButton}
            <div className="w-[38px] h-[38px] bg-[#141413] animate-pulse flex-none" />
            <div className="h-4 bg-[#191917] rounded w-40 animate-pulse" />
          </div>

          <div className="mb-6">
            <ActivityChart
              range="1m"
              activityCadence={[]}
              isLoading={true}
              label="PLAYS"
              visitorTimezone={visitorTimezone}
            />
          </div>

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

        {/* Right Column: top tracks/albums placeholder */}
        <div className="min-w-0 md:h-[560px] md:overflow-y-auto scrollbar-hidden">
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

  return (
    <div
      className={`grid grid-cols-1 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-4 md:gap-[26px] mt-4 md:mt-6 select-none ${
        status === "loading" ? "opacity-60" : ""
      }`}
    >
      {/* Left Column: header, activity chart, recent plays */}
      <div className="min-w-0 md:h-[560px] md:overflow-y-auto scrollbar-hidden">
        {/* Header row */}
        <div className="flex items-center gap-3 mb-4 select-none">
          {backButton}
          <Artwork
            src={data.imageUrl}
            alt={data.name}
            size={38}
          />
          <div className="min-w-0 flex-1">
            <div className="font-sans text-[15px] font-medium tracking-[-0.01em] text-[#EDEDE8] truncate leading-tight select-none">
              {data.name}
            </div>
            {data.kind === "track" && (data.artistName || data.albumName) && (
              <div className="font-mono text-[11.5px] text-[#6A6A64] truncate leading-tight mt-0.5 select-none">
                {[data.artistName, data.albumName].filter(Boolean).join(" · ")}
              </div>
            )}
          </div>
        </div>

        {/* ActivityChart with label PLAYS */}
        <div className="mb-6">
          <ActivityChart
            label="PLAYS"
            range={data.range}
            activityCadence={data.activityCadence}
            isLoading={status === "loading"}
            visitorTimezone={visitorTimezone}
          />
        </div>

        {/* Recent plays or empty message */}
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
              {recentPlaysWithPresentation.map((play) => (
                <React.Fragment key={play.id}>
                  {play.dayGroup && (
                    <div className="pt-3 pb-1 px-1 border-b border-[#1C1C1A] select-none">
                      <span className="font-mono text-[11px] tracking-[0.14em] text-[#5A5A55]">
                        {play.dayGroup}
                      </span>
                    </div>
                  )}
                  <div
                    className="flex items-center gap-3 px-1 h-[54px] md:h-[55px] border-b border-[#191917]"
                  >
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
                  </div>
                </React.Fragment>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right Column */}
      <div className="min-w-0 md:h-[560px] md:overflow-y-auto scrollbar-hidden">
        {data.kind === "artist" ? (
          data.plays > 0 && (
            <div className="flex flex-col gap-6">
              {/* TOP TRACKS */}
              <div>
                <div className="flex justify-between items-baseline mb-2 select-none">
                  <span className="font-mono text-[11px] tracking-[0.14em] text-[#5A5A55]">
                    [ TOP TRACKS ]
                  </span>
                  <span className="font-mono text-[11px] tracking-[0.14em] text-[#5A5A55]">
                    PLAYS
                  </span>
                </div>
                <div className="flex flex-col">
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
                </div>
              </div>

              {/* TOP ALBUMS */}
              <div>
                <div className="flex justify-between items-baseline mb-2 select-none">
                  <span className="font-mono text-[11px] tracking-[0.14em] text-[#5A5A55]">
                    [ TOP ALBUMS ]
                  </span>
                  <span className="font-mono text-[11px] tracking-[0.14em] text-[#5A5A55]">
                    PLAYS
                  </span>
                </div>
                <div className="flex flex-col" role="list">
                  {data.topAlbums.map((album, idx) => {
                    const isLast = idx === data.topAlbums.length - 1;
                    return (
                      <div
                        key={album.id || album.name}
                        role="listitem"
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
                </div>
              </div>
            </div>
          )
        ) : (
          /* Track profile: Lifetime block */
          <div>
            <div className="font-mono text-[11px] tracking-[0.14em] text-[#5A5A55] mb-2 select-none">
              [ LIFETIME ]
            </div>
            <div className="flex flex-col border border-[#191917] p-3 gap-2 font-mono text-[11px]">
              <div className="flex justify-between items-baseline select-none">
                <span className="text-[#5A5A55] tracking-[0.1em]">FIRST PLAYED</span>
                <span className="text-[#EDEDE8] tabular-nums">
                  {data.firstPlayedAt
                    ? formatLogStartDate(new Date(data.firstPlayedAt), visitorTimezone)
                    : "--"}
                </span>
              </div>
              <div className="flex justify-between items-baseline select-none">
                <span className="text-[#5A5A55] tracking-[0.1em]">LAST PLAYED</span>
                <span className="text-[#EDEDE8] tabular-nums">
                  {data.lastPlayedAt
                    ? formatLogStartDate(new Date(data.lastPlayedAt), visitorTimezone)
                    : "--"}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
