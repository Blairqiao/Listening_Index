"use client";

import React, { useMemo, useState } from "react";
import type { ProfileData, ProfileKind, ProfileTarget } from "@/lib/search-types";
import { formatHHmmTz, formatDayGroupTz } from "@/lib/db/queries/helpers";
import { formatDurationMs } from "@/lib/format-utils";
import { artistShare, buildShareSegments, formatShare, segmentIdForTrack } from "@/lib/profile-stats";
import { ProfileBox, PROFILE_ROW_HEIGHT_CLASS, type ProfileRowSize } from "./ProfileBox";
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

// Desktop row budgets per profile kind so both columns match height:
// Artist (tall): 10 = 5 + 1 heading row + 4
// Album (compact): 10 = 10
// Track (compact): 11 = 5 + 1 heading row + 5
const ARTIST_RECENT_ROWS = 10;
const ARTIST_TOP_TRACKS_ROWS = 5;
const ARTIST_TOP_ALBUMS_ROWS = 4;

const ALBUM_RECENT_ROWS = 10;
const ALBUM_TOP_TRACKS_ROWS = 10;
const TRACK_RECENT_ROWS = 11;
const TRACK_ALBUM_TRACKS_ROWS = 5;
const TRACK_RELATED_ROWS = 5;

const RECENT_ROWS_BY_KIND: Record<ProfileKind, number> = {
  artist: ARTIST_RECENT_ROWS,
  album: ALBUM_RECENT_ROWS,
  track: TRACK_RECENT_ROWS,
};

const RANKED_MOBILE_LIMIT = 4;

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
        <div role="status" className="mt-6 font-mono text-[11px] text-[#5A5A55]">
          {status === "not_found" ? "Not in archive" : "Couldn't load profile"}
        </div>
      </div>
    );
  }

  if (status === "loading" && !data) {
    const skeletonRowSize: ProfileRowSize = pendingKind === "artist" ? "tall" : "compact";
    const skeletonRecentRows = RECENT_ROWS_BY_KIND[pendingKind];
    const loadingScrollKey = `loading-${pendingKind}`;

    return (
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-4 md:gap-[26px] mt-4 md:mt-6 select-none">
        <div className="min-w-0 md:col-span-full">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="w-[88px] h-[88px] bg-[#141413] animate-pulse flex-none" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-3 bg-[#191917] rounded w-16 animate-pulse" />
              <div className="h-6 bg-[#191917] rounded w-48 max-w-[75%] animate-pulse" />
              {pendingKind !== "artist" && (
                <div className="h-3 bg-[#141413] rounded w-32 animate-pulse" />
              )}
            </div>
          </div>
          <div className="mt-3 md:mt-4 flex flex-wrap md:justify-between gap-x-6 gap-y-2.5 border-t border-[#191917] pt-2.5 md:pt-3">
            {Array.from({ length: 8 }).map((_, idx) => (
              <div key={idx} className="flex flex-col gap-1">
                <div className="h-2.5 w-12 bg-[#141413] rounded animate-pulse" />
                <div className="h-3.5 w-10 bg-[#191917] rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>

        <div className="md:col-span-full">
          <ActivityChart
            range="1m"
            activityCadence={[]}
            isLoading={true}
            label="Plays"
            visitorTimezone={visitorTimezone}
          />
        </div>

        <ProfileBox
          heading="Recent plays"
          rows={skeletonRecentRows}
          rowSize={skeletonRowSize}
          itemCount={0}
          scrollKey={`${loadingScrollKey}-recent`}
        >
          {null}
        </ProfileBox>

        {pendingKind === "artist" && (
          <div className="flex min-w-0 flex-col gap-4 md:gap-0">
            <ProfileBox
              heading="Top tracks"
              rightLabel="Plays"
              rows={ARTIST_TOP_TRACKS_ROWS}
              rowSize="tall"
              itemCount={0}
              scrollKey={`${loadingScrollKey}-tracks`}
            >
              {null}
            </ProfileBox>
            <ProfileBox
              heading="Top albums"
              rightLabel="Plays"
              rows={ARTIST_TOP_ALBUMS_ROWS}
              rowSize="tall"
              itemCount={0}
              headingAsRow={true}
              scrollKey={`${loadingScrollKey}-albums`}
            >
              {null}
            </ProfileBox>
          </div>
        )}

        {pendingKind === "album" && (
          <ProfileBox
            heading="Top tracks"
            rightLabel="Plays"
            rows={ALBUM_TOP_TRACKS_ROWS}
            rowSize="compact"
            itemCount={0}
            scrollKey={`${loadingScrollKey}-tracks`}
          >
            {null}
          </ProfileBox>
        )}

        {pendingKind === "track" && (
          <div className="flex min-w-0 flex-col gap-4 md:gap-0">
            <ProfileBox
              heading="From this album"
              rightLabel="Plays"
              rows={TRACK_ALBUM_TRACKS_ROWS}
              rowSize="compact"
              itemCount={0}
              scrollKey={`${loadingScrollKey}-album`}
            >
              {null}
            </ProfileBox>
            <ProfileBox
              heading="Often played with"
              rightLabel="Co-plays"
              rows={TRACK_RELATED_ROWS}
              rowSize="compact"
              itemCount={0}
              headingAsRow={true}
              scrollKey={`${loadingScrollKey}-related`}
            >
              {null}
            </ProfileBox>
          </div>
        )}
      </div>
    );
  }

  if (!data) return null;

  const isTrack = data.kind === "track";
  const albumTracks = data.albumTracks ?? [];
  const relatedTracks = data.relatedTracks ?? [];
  const scrollKey = `${data.kind}-${data.key}-${data.range}`;

  const hours = data.plays > 0 ? data.hourOfDay : undefined;
  const dayOfWeek = data.plays > 0 ? data.dayOfWeek : undefined;

  const renderTopTrack = (
    track: ProfileData["topTracks"][number],
    idx: number,
    showArtwork: boolean,
    rowSize: ProfileRowSize,
  ) => (
    <button
      key={track.id}
      type="button"
      onClick={() => onOpenProfile({ kind: "track", key: track.id })}
      onMouseEnter={() => setActiveSegmentId(track.id)}
      onMouseLeave={() => setActiveSegmentId(null)}
      className={`group flex items-center gap-3 px-1 ${PROFILE_ROW_HEIGHT_CLASS[rowSize]} w-full text-left cursor-pointer hover:bg-[#111110] focus-visible:bg-[#111110] transition-none border-b border-[#191917] ${activeSegmentId === track.id ? "bg-[#111110]" : ""}`}
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
      <span className={`font-sans ${rowSize === "compact" ? "text-[13px]" : "text-[14px]"} tracking-[-0.01em] flex-1 truncate group-hover:text-music-accent transition-none leading-snug ${activeSegmentId === track.id ? "text-music-accent" : "text-[#EDEDE8]"}`}>
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

  const renderAlbumRow = (album: ProfileData["topAlbums"][number], idx: number) => {
    const key = album.key;
    const Row = key ? "button" : "div";
    return (
      <Row
        key={key || album.id || album.name}
        type={key ? "button" : undefined}
        onClick={key ? () => onOpenProfile({ kind: "album", key }) : undefined}
        className={`group flex items-center gap-3 px-1 h-[54px] md:h-[55px] border-b border-[#191917]${
          key ? " w-full text-left cursor-pointer hover:bg-[#111110] focus-visible:bg-[#111110] transition-none" : ""
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
      aria-busy={status === "loading" || undefined}
      className={`grid grid-cols-1 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-4 md:gap-[26px] mt-4 md:mt-6 select-none ${
        status === "loading" ? "opacity-60 pointer-events-none" : ""
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
            heading={`Share of ${data.artistName || "artist"}`}
            part={data.plays}
            total={data.stats?.artistPlays ?? data.trackStats?.artistPlays ?? 0}
          />
        </div>
      )}

      {(isArtist || isAlbum) && data.plays > 0 && (
        <div className="min-w-0 md:col-span-full">
          <SegmentedShareBar
            heading="Share of plays"
            segments={segments}
            total={data.plays}
            activeId={activeSegmentId}
            onActiveChange={setActiveSegmentId}
          />
        </div>
      )}

      {/* Bottom section: zero-plays state or 2-column fixed-height boxes */}
      {data.plays === 0 ? (
        <div className="min-w-0 md:col-span-full">
          <div className="font-mono text-[11px] text-[#5A5A55] py-4 select-none">
            No plays in this range
          </div>
        </div>
      ) : (
        <>
          {/* Left column: recent plays */}
          {isArtist && (
            <ProfileBox
              heading="Recent plays"
              rows={ARTIST_RECENT_ROWS}
              rowSize="tall"
              itemCount={recentPlaysWithPresentation.length}
              scrollKey={scrollKey}
            >
              {recentPlaysWithPresentation.map((play) => {
                const segmentId = segmentIdForTrack(play.trackId, segments);
                const isActive = segmentId !== null && segmentId === activeSegmentId;

                return (
                  <button
                    key={play.id}
                    type="button"
                    aria-label={`Open Track profile for ${play.title}`}
                    onClick={() => onOpenProfile({ kind: "track", key: play.trackId })}
                    onMouseEnter={() => setActiveSegmentId(segmentId)}
                    onMouseLeave={() => setActiveSegmentId(null)}
                    className={`flex w-full items-center gap-3 border-b border-[#191917] px-1 h-[54px] md:h-[55px] text-left cursor-pointer hover:bg-[#111110] focus-visible:outline-music-accent ${isActive ? "bg-[#111110]" : ""}`}
                  >
                    <div className="flex w-[56px] flex-none flex-col justify-center font-mono select-none">
                      {play.dayGroup && (
                        <span className="text-[10px] text-[#5A5A55] leading-tight">
                          {play.dayGroup}
                        </span>
                      )}
                      <span className="text-[11px] text-[#5A5A55] tabular-nums leading-tight">
                        {play.timeStr}
                      </span>
                    </div>
                    <Artwork
                      src={play.albumImageUrl}
                      alt={play.album || play.title}
                      size={38}
                    />
                    <div className="min-w-0 flex-1 pl-1">
                      <span className={`block font-sans text-[14px] tracking-[-0.01em] truncate leading-snug select-none ${isActive ? "text-music-accent" : "text-[#EDEDE8]"}`}>
                        {play.title}
                      </span>
                      {play.album && (
                        <span className="block font-mono text-[11.5px] text-[#6A6A64] truncate leading-tight mt-0.5 select-none">
                          {play.album}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </ProfileBox>
          )}

          {isAlbum && (
            <ProfileBox
              heading="Recent plays"
              rows={ALBUM_RECENT_ROWS}
              rowSize="compact"
              itemCount={recentPlaysWithPresentation.length}
              scrollKey={scrollKey}
            >
              {recentPlaysWithPresentation.map((play) => {
                const segmentId = segmentIdForTrack(play.trackId, segments);
                const isActive = segmentId !== null && segmentId === activeSegmentId;
                const hasMsPlayed = play.msPlayed != null && play.msPlayed > 0;

                return (
                  <button
                    key={play.id}
                    type="button"
                    aria-label={`Open Track profile for ${play.title}`}
                    onClick={() => onOpenProfile({ kind: "track", key: play.trackId })}
                    onMouseEnter={() => setActiveSegmentId(segmentId)}
                    onMouseLeave={() => setActiveSegmentId(null)}
                    className={`grid grid-cols-[72px_56px_1fr_auto] items-center h-8 w-full px-1 border-b border-[#191917] text-left cursor-pointer hover:bg-[#111110] focus-visible:outline-music-accent ${isActive ? "bg-[#111110]" : ""}`}
                  >
                    <span className="font-mono text-[11.5px] text-[#5A5A55] select-none">
                      {play.dayGroup ?? null}
                    </span>
                    <span className="font-mono text-[11.5px] text-[#8A8A83] tabular-nums select-none">
                      {play.timeStr}
                    </span>
                    <span className={`min-w-0 font-sans text-[13px] tracking-[-0.01em] truncate leading-snug select-none ${isActive ? "text-music-accent" : "text-[#EDEDE8]"}`}>
                      {play.title}
                    </span>
                    <span className="pl-2 font-mono text-[11px] text-[#6A6A64] text-right tabular-nums select-none">
                      {hasMsPlayed ? formatDurationMs(play.msPlayed!) : ""}
                    </span>
                  </button>
                );
              })}
            </ProfileBox>
          )}

          {isTrack && (
            <ProfileBox
              heading="Recent plays"
              rows={TRACK_RECENT_ROWS}
              rowSize="compact"
              itemCount={recentPlaysWithPresentation.length}
              scrollKey={scrollKey}
            >
              {recentPlaysWithPresentation.map((play) => {
                const hasMsPlayed = play.msPlayed != null && play.msPlayed > 0;
                const isPartial = hasMsPlayed && play.durationMs > 0 && play.msPlayed! < play.durationMs * 0.85;
                return (
                  <div
                    key={play.id}
                    className="grid grid-cols-[72px_56px_1fr] items-center h-8 px-1 border-b border-[#191917] font-mono text-[11.5px]"
                  >
                    <span className="text-[#5A5A55]">
                      {play.dayGroup ?? null}
                    </span>
                    <span className="text-[#8A8A83] tabular-nums">{play.timeStr}</span>
                    <span className="text-right tabular-nums text-[#6A6A64]">
                      {hasMsPlayed && (
                        <>
                          {formatDurationMs(play.msPlayed!)}
                          {isPartial && (
                            <span className="ml-1.5 text-[10px] text-[#5A5A55]">Partial</span>
                          )}
                        </>
                      )}
                    </span>
                  </div>
                );
              })}
            </ProfileBox>
          )}

          {/* Right column: Artist */}
          {isArtist && (
            <div className="flex min-w-0 flex-col gap-4 md:gap-0">
              <ProfileBox
                heading="Top tracks"
                rightLabel="Plays"
                rows={ARTIST_TOP_TRACKS_ROWS}
                rowSize="tall"
                itemCount={data.topTracks.length}
                mobileLimit={RANKED_MOBILE_LIMIT}
                scrollKey={scrollKey}
              >
                {data.topTracks.map((track, idx) => renderTopTrack(track, idx, true, "tall"))}
              </ProfileBox>
              <ProfileBox
                heading="Top albums"
                rightLabel="Plays"
                rows={ARTIST_TOP_ALBUMS_ROWS}
                rowSize="tall"
                itemCount={data.topAlbums.length}
                headingAsRow={true}
                mobileLimit={RANKED_MOBILE_LIMIT}
                scrollKey={scrollKey}
              >
                {data.topAlbums.map((album, idx) => renderAlbumRow(album, idx))}
              </ProfileBox>
            </div>
          )}

          {/* Right column: Album */}
          {isAlbum && (
            <ProfileBox
              heading="Top tracks"
              rightLabel="Plays"
              rows={ALBUM_TOP_TRACKS_ROWS}
              rowSize="compact"
              itemCount={data.topTracks.length}
              mobileLimit={RANKED_MOBILE_LIMIT}
              scrollKey={scrollKey}
            >
              {data.topTracks.map((track, idx) => renderTopTrack(track, idx, false, "compact"))}
            </ProfileBox>
          )}

          {/* Right column: Track */}
          {isTrack && (
            <div className="flex min-w-0 flex-col gap-4 md:gap-0">
              <ProfileBox
                heading="From this album"
                rightLabel="Plays"
                rows={TRACK_ALBUM_TRACKS_ROWS}
                rowSize="compact"
                itemCount={albumTracks.length}
                mobileLimit={RANKED_MOBILE_LIMIT}
                scrollKey={scrollKey}
              >
                {albumTracks.map((track, idx) => {
                  const rowClass = "group flex items-center gap-3 px-1 h-8 w-full text-left border-b border-[#191917]";
                  const row = (
                    <>
                      <span className="font-mono text-[11px] text-[#4A4A46] w-[18px] flex-none tabular-nums select-none">
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                      <span className={`font-sans text-[13px] tracking-[-0.01em] flex-1 truncate leading-snug ${track.isCurrent ? "text-music-accent" : "text-[#EDEDE8] group-hover:text-music-accent"}`}>
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
              </ProfileBox>
              <ProfileBox
                heading="Often played with"
                rightLabel="Co-plays"
                rows={TRACK_RELATED_ROWS}
                rowSize="compact"
                itemCount={relatedTracks.length}
                headingAsRow={true}
                mobileLimit={RANKED_MOBILE_LIMIT}
                scrollKey={scrollKey}
              >
                {relatedTracks.map((track) => (
                  <button
                    key={track.id}
                    type="button"
                    onClick={() => onOpenProfile({ kind: "track", key: track.id })}
                    className="group flex items-center gap-2.5 px-1 h-8 w-full text-left cursor-pointer hover:bg-[#111110] focus-visible:bg-[#111110] transition-none border-b border-[#191917]"
                  >
                    <Artwork
                      src={track.albumImageUrl}
                      alt={track.name}
                      size={24}
                    />
                    <span className="min-w-0 flex-1 truncate leading-snug">
                      <span className="font-sans text-[13px] tracking-[-0.01em] text-[#EDEDE8] group-hover:text-music-accent transition-none">
                        {track.name}
                      </span>
                      <span className="font-mono text-[11px] text-[#6A6A64]">
                        {` · ${track.artist}`}
                      </span>
                    </span>
                    <span className="font-mono text-[11px] text-[#8A8A83] flex-none tabular-nums">
                      {track.coPlays.toLocaleString()}×
                    </span>
                  </button>
                ))}
              </ProfileBox>
            </div>
          )}
        </>
      )}
    </div>
  );
};
