"use client";

import React, { useMemo, useState } from "react";
import type { ProfileData, ProfileKind, ProfileTarget } from "@/lib/search-types";
import { formatHHmmTz, formatDayGroupTz } from "@/lib/db/queries/helpers";
import { formatDurationMs } from "@/lib/format-utils";
import { artistShare, buildShareSegments, formatShare, segmentIdForTrack } from "@/lib/profile-stats";
import { ProfileChart } from "./ProfileChart";
import { ProfileHeader } from "./ProfileHeader";
import { ProportionShareBar, SegmentedShareBar } from "./ShareBar";
import { Artwork } from "../../Artwork";
import { ActivityChart } from "../ActivityChart";

export interface ProfileViewProps {
  data: ProfileData | null;
  status: "loading" | "ready" | "not_found" | "error";
  visitorTimezone: string;
  onOpenProfile: (target: ProfileTarget) => void;
  pendingKind?: ProfileKind;
  rankFormat?: "rank" | "percentile";
  onToggleRankFormat?: () => void;
}

function ProfileRankedList({
  label,
  heading,
  rightLabel = "PLAYS",
  children,
}: {
  label: string;
  heading?: string;
  rightLabel?: string;
  children: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const count = React.Children.count(children);

  return (
    <div>
      <div className="mb-2 flex justify-between font-mono text-[11px] tracking-[0.14em] text-[#5A5A55]">
        <span>{heading ?? <>[ TOP {label} ]</>}</span>
        <span>{rightLabel}</span>
      </div>
      <div className={`md:max-h-[220px] md:overflow-y-auto scrollbar-hidden ${expanded ? "" : "max-md:[&>*:nth-child(n+5)]:hidden"}`}>
        {children}
      </div>
      {count > 4 && (
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
  pendingKind = "track",
  rankFormat,
  onToggleRankFormat,
}) => {
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
  const profileIdentity = data ? JSON.stringify([data.kind, data.key, data.range]) : null;
  const [previousProfileIdentity, setPreviousProfileIdentity] = useState(profileIdentity);
  if (profileIdentity !== previousProfileIdentity) {
    setPreviousProfileIdentity(profileIdentity);
    setActiveSegmentId(null);
  }

  const isAlbum = data?.kind === "album";
  const isArtist = data?.kind === "artist";
  const rankedTracks = isArtist || isAlbum ? data.topTracks : undefined;
  const plays = data?.plays ?? 0;
  const segments = useMemo(() => buildShareSegments(rankedTracks ?? [], plays), [rankedTracks, plays]);

  const recentPlaysWithPresentation = useMemo(() => {
    if (!data?.recentPlays) return [];
    let previousDay: string | undefined;
    return data.recentPlays.map((play) => {
      const d = new Date(play.playedAt);
      const day = formatDayGroupTz(d, visitorTimezone);
      const dayGroup = day === previousDay ? undefined : day;
      previousDay = day;
      const timeStr = formatHHmmTz(d, visitorTimezone);
      return { ...play, day, dayGroup, timeStr };
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
    const skeletonRightHeading = pendingKind === "track" ? "[ TRACK STATS ]" : "[ TOP TRACKS ]";
    return (
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-4 md:gap-[26px] mt-4 md:mt-6 select-none">
        <div className="flex items-center gap-3 md:gap-4 md:col-span-full">
          <div className="w-[88px] h-[88px] bg-[#141413] animate-pulse flex-none" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3 bg-[#191917] rounded w-16 animate-pulse" />
            <div className="h-6 bg-[#191917] rounded w-48 max-w-[75%] animate-pulse" />
            {pendingKind !== "artist" && (
              <div className="h-3 bg-[#141413] rounded w-32 animate-pulse" />
            )}
          </div>
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
                {pendingKind === "artist" && (
                  <div className="w-[38px] h-[38px] rounded bg-[#141413] flex-none" />
                )}
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
            {skeletonRightHeading}
          </div>
          <div className="flex flex-col" role="list">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div
                key={idx}
                className={`flex items-center gap-3 px-1 h-[54px] md:h-[55px] animate-pulse ${
                  idx === 3 ? "border-b-0" : "border-b border-[#191917]"
                }`}
              >
                <span className="font-mono text-[11px] text-[#2E2E2A] w-[18px] flex-none">
                  {String(idx + 1).padStart(2, "0")}
                </span>
                {pendingKind === "artist" && (
                  <div className="w-[38px] h-[38px] rounded bg-[#141413] flex-none" />
                )}
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

  const isTrack = data.kind === "track";
  const albumTracks = data.albumTracks ?? [];
  const hasAlbumList = isTrack && albumTracks.length >= 2;
  const relatedTracks = data.relatedTracks ?? [];
  const hasRelatedTracks = isTrack && relatedTracks.length > 0;
  const moreAlbums = data.moreAlbums ?? [];
  const hasMoreAlbums = isAlbum && moreAlbums.length > 0;
  const hasTrackRightColumn = isTrack && (hasAlbumList || hasRelatedTracks);

  // Without right-column content the Track's recent plays take the full width, split into two columns.
  const recentSpansFull = data.plays === 0 || (isTrack && !hasTrackRightColumn);
  const half = Math.ceil(recentPlaysWithPresentation.length / 2);
  const trackColumns = isTrack && !hasTrackRightColumn && recentPlaysWithPresentation.length > 1
    ? [recentPlaysWithPresentation.slice(0, half), recentPlaysWithPresentation.slice(half)]
    : [recentPlaysWithPresentation];

  const hours = data.plays > 0 ? data.hourOfDay : undefined;
  const dayOfWeek = data.plays > 0 ? data.dayOfWeek : undefined;

  const renderTopTrack = (track: ProfileData["topTracks"][number], idx: number, showArtwork: boolean) => (
    <button
      key={track.id}
      type="button"
      onClick={() => onOpenProfile({ kind: "track", key: track.id })}
      onMouseEnter={() => setActiveSegmentId(track.id)}
      onMouseLeave={() => setActiveSegmentId(null)}
      className={`group flex items-center gap-3 px-1 h-[54px] md:h-[55px] w-full text-left cursor-pointer hover:bg-[#111110] focus-visible:bg-[#111110] transition-none border-b border-[#191917] ${activeSegmentId === track.id ? "bg-[#111110]" : ""}`}
    >
      <span className="font-mono text-[11px] text-[#4A4A46] w-[18px] flex-none tabular-nums select-none">
        {String(idx + 1).padStart(2, "0")}
      </span>
      {showArtwork && (
        <Artwork
          src={track.albumImageUrl}
          alt={track.name}
          size={38}
        />
      )}
      <span className={`font-sans text-[14px] tracking-[-0.01em] flex-1 truncate group-hover:text-music-accent transition-none leading-snug ${activeSegmentId === track.id ? "text-music-accent" : "text-[#EDEDE8]"}`}>
        {track.name}
      </span>
      <span className="font-mono text-[11px] text-[#5A5A55] w-[34px] shrink-0 text-right tabular-nums">
        {formatShare(artistShare(track.plays, plays))}
      </span>
      <span className="font-mono text-[11px] text-[#8A8A83] flex-none tabular-nums">
        {track.plays.toLocaleString()}
      </span>
    </button>
  );

  const renderAlbumRow = (album: ProfileData["topAlbums"][number], idx: number, totalRows: number) => {
    const key = album.key;
    const Row = key ? "button" : "div";
    const isLast = idx === totalRows - 1;
    return (
      <Row
        key={key || album.id || album.name}
        type={key ? "button" : undefined}
        onClick={key ? () => onOpenProfile({ kind: "album", key }) : undefined}
        className={`group flex items-center gap-3 px-1 h-[54px] md:h-[55px] ${
          isLast ? "border-b-0" : "border-b border-[#191917]"
        }${key ? " w-full text-left cursor-pointer hover:bg-[#111110] focus-visible:bg-[#111110] transition-none" : ""}`}
      >
        <span className="font-mono text-[11px] text-[#4A4A46] w-[18px] flex-none tabular-nums select-none">
          {String(idx + 1).padStart(2, "0")}
        </span>
        <Artwork
          src={album.imageUrl}
          alt={album.name}
          size={38}
        />
        <span className={`font-sans text-[13px] text-[#EDEDE8] flex-1 truncate leading-snug${key ? " group-hover:text-music-accent transition-none" : ""}`}>
          {album.name}
        </span>
        <span className="font-mono text-[11px] text-[#8A8A83] flex-none tabular-nums">
          {album.plays.toLocaleString()}
        </span>
      </Row>
    );
  };

  return (
    <div
      className={`grid grid-cols-1 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-4 md:gap-[26px] mt-4 md:mt-6 select-none ${
        status === "loading" ? "opacity-60" : ""
      }`}
    >
      <ProfileHeader
        data={data}
        visitorTimezone={visitorTimezone}
        onOpenProfile={onOpenProfile}
        rankFormat={rankFormat}
        onToggleRankFormat={onToggleRankFormat}
      />

      {/* Chart */}
      <div className="min-w-0 md:col-span-full">
        <ProfileChart
          range={data.range}
          activityCadence={data.activityCadence}
          monthlyCadence={data.monthlyCadence}
          isLoading={status === "loading"}
          visitorTimezone={visitorTimezone}
          hourOfDay={hours}
          dayOfWeek={dayOfWeek}
        />
      </div>

      {/* Share bars */}
      {isTrack && data.plays > 0 && (
        <div className="min-w-0 md:col-span-full">
          <ProportionShareBar
            heading={`[ SHARE OF ${data.artistName?.toUpperCase() || "ARTIST"} ]`}
            part={data.plays}
            total={data.stats?.artistPlays ?? data.trackStats?.artistPlays ?? 0}
          />
        </div>
      )}

      {(isArtist || isAlbum) && data.plays > 0 && (
        <div className="min-w-0 md:col-span-full">
          <SegmentedShareBar
            heading="[ SHARE OF PLAYS ]"
            segments={segments}
            total={data.plays}
            activeId={activeSegmentId}
            onActiveChange={setActiveSegmentId}
          />
        </div>
      )}

      {/* Bottom section: zero-plays state or explicit 2-column layout */}
      {data.plays === 0 ? (
        <div className="min-w-0 md:col-span-full">
          <div className="font-mono text-[11px] tracking-[0.14em] text-[#5A5A55] py-4 select-none">
            [ NO PLAYS IN THIS RANGE ]
          </div>
        </div>
      ) : (
        <>
          {/* Left column: [ RECENT PLAYS ] */}
          <div className={`min-w-0 ${isTrack ? "" : "md:max-h-[540px] md:overflow-y-auto scrollbar-hidden "}${recentSpansFull ? "md:col-span-full" : ""}`}>
            <div>
              <div className="flex justify-between items-baseline mb-2 select-none">
                <span className="font-mono text-[11px] tracking-[0.14em] text-[#5A5A55]">
                  [ RECENT PLAYS ]
                </span>
              </div>
              {isTrack ? (
                <div className="grid grid-cols-1 md:grid-cols-2 md:gap-x-[26px]">
                  {trackColumns.map((column, columnIndex) => (
                    <div key={columnIndex} className={`flex flex-col${trackColumns.length === 1 ? " md:col-span-2" : ""}`}>
                      {column.map((play, rowIndex) => {
                        const hasMsPlayed = play.msPlayed != null && play.msPlayed > 0;
                        const isPartial = hasMsPlayed && play.durationMs > 0 && play.msPlayed! < play.durationMs * 0.85;
                        return (
                          <div key={play.id} className="grid grid-cols-[72px_56px_1fr] items-center h-8 px-1 border-b border-[#191917] font-mono text-[11.5px]">
                            <span className="text-[#5A5A55] tracking-[0.08em]">
                              {play.dayGroup ?? (columnIndex > 0 && rowIndex === 0 ? <span className="hidden md:inline">{play.day}</span> : null)}
                            </span>
                            <span className="text-[#8A8A83] tabular-nums">{play.timeStr}</span>
                            <span className="text-right tabular-nums text-[#6A6A64]">
                              {hasMsPlayed && (
                                <>
                                  {formatDurationMs(play.msPlayed!)}
                                  {isPartial && (
                                    <span className="ml-1.5 text-[10px] tracking-[0.08em] text-[#5A5A55]">PARTIAL</span>
                                  )}
                                </>
                              )}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col">
                  {recentPlaysWithPresentation.map((play) => {
                    const segmentId = segmentIdForTrack(play.trackId, segments);
                    const isActive = segmentId !== null && segmentId === activeSegmentId;
                    const hasMsPlayed = play.msPlayed != null && play.msPlayed > 0;

                    return (
                      <React.Fragment key={play.id}>
                        {play.dayGroup && (
                          <div className="pt-3 pb-1 px-1 border-b border-[#1C1C1A] select-none">
                            <span className="font-mono text-[11px] tracking-[0.14em] text-[#5A5A55]">
                              {play.dayGroup}
                            </span>
                          </div>
                        )}
                        <button
                          type="button"
                          aria-label={`Open Track profile for ${play.title}`}
                          onClick={() => onOpenProfile({ kind: "track", key: play.trackId })}
                          onMouseEnter={() => setActiveSegmentId(segmentId)}
                          onMouseLeave={() => setActiveSegmentId(null)}
                          className={`flex w-full items-center gap-3 border-b border-[#191917] px-1 h-[54px] md:h-[55px] text-left cursor-pointer hover:bg-[#111110] focus-visible:outline-music-accent ${isActive ? "bg-[#111110]" : ""}`}
                        >
                          <span className="font-mono text-[11px] text-[#5A5A55] tabular-nums select-none flex-none w-[44px]">
                            {play.timeStr}
                          </span>
                          {!isAlbum && (
                            <Artwork
                              src={play.albumImageUrl}
                              alt={play.album || play.title}
                              size={38}
                            />
                          )}
                          <div className={`min-w-0 flex-1${isAlbum ? "" : " pl-1"}`}>
                            <span className={`block font-sans text-[14px] tracking-[-0.01em] truncate leading-snug select-none ${isActive ? "text-music-accent" : "text-[#EDEDE8]"}`}>
                              {play.title}
                            </span>
                            {!isAlbum && play.album && (
                              <span className="block font-mono text-[11.5px] text-[#6A6A64] truncate leading-tight mt-0.5 select-none">
                                {play.album}
                              </span>
                            )}
                          </div>
                          {isAlbum && hasMsPlayed && (
                            <span className="font-mono text-[11px] text-[#6A6A64] flex-none tabular-nums">
                              {formatDurationMs(play.msPlayed!)}
                            </span>
                          )}
                        </button>
                      </React.Fragment>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right column: Artist */}
          {isArtist && (
            <div className="flex min-w-0 flex-col gap-6">
              <ProfileRankedList key={`${data.key}-tracks`} label="TRACKS">
                {data.topTracks.map((track, idx) => renderTopTrack(track, idx, true))}
              </ProfileRankedList>
              <ProfileRankedList key={`${data.key}-albums`} label="ALBUMS">
                {data.topAlbums.map((album, idx) => renderAlbumRow(album, idx, data.topAlbums.length))}
              </ProfileRankedList>
            </div>
          )}

          {/* Right column: Album */}
          {isAlbum && (
            <div className="flex min-w-0 flex-col gap-6">
              <ProfileRankedList key={`${data.key}-tracks`} label="TRACKS">
                {data.topTracks.map((track, idx) => renderTopTrack(track, idx, false))}
              </ProfileRankedList>
              {hasMoreAlbums && (
                <ProfileRankedList
                  key={`${data.key}-more-albums`}
                  label="ALBUMS"
                  heading={`[ MORE BY ${data.artistName?.toUpperCase() || "ARTIST"} ]`}
                >
                  {moreAlbums.slice(0, 4).map((album, idx, arr) => renderAlbumRow(album, idx, arr.length))}
                </ProfileRankedList>
              )}
            </div>
          )}

          {/* Right column: Track */}
          {hasTrackRightColumn && (
            <div className="flex min-w-0 flex-col gap-6">
              {hasAlbumList && (
                <ProfileRankedList key={data.key} label="TRACKS" heading="[ FROM THIS ALBUM ]">
                  {albumTracks.map((track, idx) => {
                    const rowClass = "group flex items-center gap-3 px-1 h-[54px] md:h-[55px] w-full text-left border-b border-[#191917]";
                    const row = (
                      <>
                        <span className="font-mono text-[11px] text-[#4A4A46] w-[18px] flex-none tabular-nums select-none">
                          {String(idx + 1).padStart(2, "0")}
                        </span>
                        <span className={`font-sans text-[14px] tracking-[-0.01em] flex-1 truncate leading-snug ${track.isCurrent ? "text-music-accent" : "text-[#EDEDE8] group-hover:text-music-accent"}`}>
                          {track.name}
                        </span>
                        <span className="font-mono text-[11px] text-[#8A8A83] flex-none tabular-nums">
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
              {hasRelatedTracks && (
                <ProfileRankedList
                  key={`${data.key}-related`}
                  label="TRACKS"
                  heading="[ OFTEN PLAYED WITH ]"
                  rightLabel="CO-PLAYS"
                >
                  {relatedTracks.slice(0, 4).map((track, idx, arr) => {
                    const isLast = idx === arr.length - 1;
                    return (
                      <button
                        key={track.id}
                        type="button"
                        onClick={() => onOpenProfile({ kind: "track", key: track.id })}
                        className={`group flex items-center gap-3 px-1 h-[54px] md:h-[55px] w-full text-left cursor-pointer hover:bg-[#111110] focus-visible:bg-[#111110] transition-none ${
                          isLast ? "border-b-0" : "border-b border-[#191917]"
                        }`}
                      >
                        <Artwork
                          src={track.albumImageUrl}
                          alt={track.name}
                          size={38}
                        />
                        <div className="min-w-0 flex-1">
                          <span className="block font-sans text-[14px] tracking-[-0.01em] text-[#EDEDE8] group-hover:text-music-accent truncate leading-snug transition-none">
                            {track.name}
                          </span>
                          <span className="block font-mono text-[11px] text-[#6A6A64] truncate leading-tight mt-0.5">
                            {track.artist}
                          </span>
                        </div>
                        <span className="font-mono text-[11px] text-[#8A8A83] flex-none tabular-nums">
                          {track.coPlays.toLocaleString()}×
                        </span>
                      </button>
                    );
                  })}
                </ProfileRankedList>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};
