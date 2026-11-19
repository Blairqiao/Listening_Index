"use client";

import React, { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { ListeningHeader } from "@/components/listening-view/ListeningHeader";
import { ModeTabs } from "@/components/listening-view/ModeTabs";
import { ControlRow } from "@/components/listening-view/ControlRow";
import { MetricRibbon } from "@/components/listening-view/MetricRibbon";
import { LivePlayerView } from "@/components/views/live-player-view/LivePlayerView";
import { OverviewView } from "@/components/views/OverviewView";
import { StreamLogView } from "@/components/views/StreamLogView";
import { SessionView } from "@/components/views/session-view/SessionView";
import { SearchView } from "@/components/views/search-view/SearchView";
import { ProfileView } from "@/components/views/search-view/ProfileView";
import { ListeningFooter } from "@/components/listening-view/ListeningFooter";
const CustomizationModal = dynamic(
  () => import("@/components/modals/customization-modal/CustomizationModal").then((mod) => mod.CustomizationModal),
  { ssr: false }
);
const UploadModal = dynamic(
  () => import("@/components/modals/upload-modal/UploadModal").then((mod) => mod.UploadModal),
  { ssr: false }
);
const AdminSpotifyModal = dynamic(
  () => import("@/components/modals/admin-spotify-modal/AdminSpotifyModal").then((mod) => mod.AdminSpotifyModal),
  { ssr: false }
);
import { AdminLoginModal } from "@/components/modals/admin-login-modal/AdminLoginModal";
import { ConfigProvider, useConfig, SiteConfigState } from "@/context/ConfigContext";
import { PlayerProvider, usePlayer } from "@/context/PlayerContext";
import { RANGE_KEYS, type Mode, type RangeKey } from "@/lib/types";
import { DEFAULT_SEARCH_SORT, type ProfileTarget, type SearchSort } from "@/lib/search-types";
import type { OverviewData, StreamLogData, SessionData } from "@/lib/db/queries";
import { presentSession } from "@/lib/listening-presentation";
import { useDeferredEnrichment } from "@/lib/hooks/useDeferredEnrichment";
import {
  formatOverviewMetrics,
  formatStreamLogMetrics,
  formatStreamLogDateSpan,
} from "@/lib/format-utils";
import { useListeningUrlSync } from "./listening-view/useListeningUrlSync";
import { useListeningData } from "./listening-view/useListeningData";
import { useListeningSync } from "./listening-view/useListeningSync";
import { usePersistedToggle } from "./listening-view/usePersistedToggle";
import { useSpotifyStatus } from "./listening-view/useSpotifyStatus";
import { useTrackStats } from "./listening-view/useTrackStats";
import { useSearchProfile } from "./listening-view/useSearchProfile";
import {
  buildListeningUrlSearch,
  computeLivePlayerMetrics,
  formatProfileRibbonMetrics,
  resolveActiveEntity,
  sanitizeActiveMode,
  EMPTY_OVERVIEW,
  EMPTY_STREAM_LOG,
} from "./listening-view/listening-helpers";

interface ListeningViewProps {
  initialOverview?: OverviewData | Record<RangeKey, OverviewData> | null;
  initialStreamLog?: StreamLogData | null;
  initialSession?: SessionData | null;
  initialConfig?: SiteConfigState | null;
  initialVisitorTimezone?: string;
  isDbConfigured?: boolean;
  initialIsAuthenticated?: boolean;
  initialMode?: Mode;
  initialRange?: RangeKey;
  initialProfile?: ProfileTarget | null;
  initialProfileRange?: RangeKey | null;
}

const ListeningViewInner: React.FC<ListeningViewProps> = ({
  initialOverview,
  initialStreamLog,
  initialSession,
  isDbConfigured = true,
  initialMode = 0,
  initialRange = "1w",
  initialProfile = null,
  initialProfileRange = null,
}) => {
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  const {
    config,
    visitorTimezone,
    updateConfig,
    markAsDeployed,
    openModal,
    isAuthenticated,
    isAdminSpotifyModalOpen,
    openAdminSpotifyModal,
  } = useConfig();

  const spotifyStatus = useSpotifyStatus(isAuthenticated, isAdminSpotifyModalOpen);

  const {
    currentTrack,
    checkTokenStatus,
    activeDevice,
    playerStatus,
    handleTransferPlayback,
  } = usePlayer();

  // Mode state: 0 = Overview, 1 = Stream Log, 2 = Current Session, 3 = Live Player (Admin Only), 4 = Search
  const [activeMode, setActiveMode] = useState<Mode>(() => sanitizeActiveMode(initialMode, isAuthenticated));

  // Mode 3 page-level controls (layout toggle & spectrum visualizer audio source mode)
  const [sourceMode, setSourceMode] = useState<"synthetic" | "live">("synthetic");
  const handleToggleSourceMode = useCallback(() => {
    setSourceMode((m) => (m === "synthetic" ? "live" : "synthetic"));
  }, []);

  const handleToggleLayout = useCallback(() => {
    const prevLayout = config.livePlayerLayout;
    const next: "split" | "stacked" = prevLayout === "stacked" ? "split" : "stacked";
    updateConfig({ livePlayerLayout: next });
    void fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ livePlayerLayout: next }),
    })
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          markAsDeployed(data?.config ?? { ...config, livePlayerLayout: next });
        } else {
          updateConfig({ livePlayerLayout: prevLayout });
        }
      })
      .catch(() => {
        updateConfig({ livePlayerLayout: prevLayout });
      });
  }, [config, updateConfig, markAsDeployed]);

  // Safeguard: mode 3 is strictly restricted to authenticated admin, and reset upload modal on logout
  useEffect(() => {
    if (!isAuthenticated) {
      setIsUploadModalOpen(false);
      if (activeMode === 3) {
        setActiveMode(0);
      }
    }
  }, [isAuthenticated, activeMode]);

  const [searchSort, setSearchSort] = useState<SearchSort>(DEFAULT_SEARCH_SORT);
  const [searchPage, setSearchPage] = useState(1);

  const [trackRankFormat, handleToggleTrackRank] = usePersistedToggle(
    "listening_track_rank_format",
    ["rank", "percentile"] as const
  );
  const [artistRankFormat, handleToggleArtistRank] = usePersistedToggle(
    "listening_artist_rank_format",
    ["rank", "percentile"] as const
  );
  const [overviewTimeUnit, handleToggleTimeUnit] = usePersistedToggle(
    "listening_overview_time_unit",
    ["minutes", "hours"] as const
  );

  const {
    activeRange,
    setActiveRange,
    displayedRange,
    setDisplayedRange,
    isRangeLoading,
    selectRange,
    activeRangeRef,
    requestGenerationRef,
    overviewCache,
    overviewCacheRef,
    streamLogState,
    loadedPlaysCount,
    isLoadingMorePlays,
    sessionState,
    lastSyncedAt,
    setLastSyncedAt,
    handleCentralEnriched,
    fetchOverview,
    fetchStreamLog,
    fetchSession,
    handleLoadMoreStreamLog,
  } = useListeningData({
    initialOverview,
    initialStreamLog,
    initialSession,
    initialRange,
    visitorTimezone,
  });

  const { isSyncing, syncError, syncedAgoStr, handleTriggerSync, handleUploadComplete } = useListeningSync({
    isAuthenticated,
    activeRangeRef,
    requestGenerationRef,
    fetchOverview,
    fetchStreamLog,
    fetchSession,
    lastSyncedAt,
    setLastSyncedAt,
  });

  const [visibleStreamLogCount, setVisibleStreamLogCount] = useState<number | null>(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      return Math.min(25, initialStreamLog?.entries?.length || 25);
    }
    return null;
  });

  // Active Track resolved from the live player, falling back to the latest Play
  const activeEntity = resolveActiveEntity(currentTrack, streamLogState?.entries?.[0]);
  const trackStats = useTrackStats(activeEntity);

  // Track whether real overview data is ready
  const isDataReady = Boolean(overviewCache[displayedRange] || initialOverview);

  // Active session state for Mode 2
  const [selectedSessionId, setSelectedSessionId] = useState<string | undefined>(undefined);

  // Mode 4: Search & Profile state
  const {
    searchQuery,
    setSearchQuery,
    profileTarget,
    profileRange,
    profileData,
    profileStatus,
    handleOpenProfile,
    handleOpenRelatedProfile,
    handleProfileBack,
    returnsTo,
    handleSelectProfileRange,
  } = useSearchProfile({
    activeMode,
    visitorTimezone,
    initialProfile,
    initialProfileRange,
    isSyncing,
  });

  // Support query params for direct URL inspection of all modes and states
  useListeningUrlSync({
    isAuthenticated,
    rangeKeys: RANGE_KEYS,
    openModal,
    setActiveMode,
    setActiveRange,
    activeRangeRef,
    overviewCacheRef,
    setDisplayedRange,
    fetchOverview,
    setSelectedSessionId,
    sanitizeActiveMode,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const currentUrl = new URL(window.location.href);
    const nextSearch = buildListeningUrlSearch(currentUrl.search, {
      activeMode,
      profileTarget,
      profileRange,
    });
    if (nextSearch !== currentUrl.search) {
      window.history.replaceState(
        null,
        "",
        `${currentUrl.pathname}${nextSearch}${currentUrl.hash}`
      );
    }
  }, [activeMode, profileTarget, profileRange]);

  const handleSelectMode = useCallback(
    (mode: Mode) => {
      if (isSyncing) return;
      const nextMode = sanitizeActiveMode(mode, isAuthenticated);
      setActiveMode(nextMode);
      if (nextMode === 3) {
        void checkTokenStatus();
      }
    },
    [isSyncing, isAuthenticated, checkTokenStatus]
  );

  const handleSelectRange = useCallback(
    (range: RangeKey) => {
      if (isSyncing) return;
      selectRange(range);
    },
    [isSyncing, selectRange]
  );

  // Derived datasets — strictly real data, no dummy mock data fallbacks
  const currentOverview: OverviewData = overviewCache[displayedRange] || EMPTY_OVERVIEW;
  const streamLogData: StreamLogData = streamLogState || EMPTY_STREAM_LOG;

  const sessionData: SessionData = sessionState || { sessions: [] };
  const activeSession = React.useMemo(() => {
    const session = sessionData.sessions.find(session => session.id === selectedSessionId) || sessionData.sessions[0];
    return session ? presentSession(session, visitorTimezone) : null;
  }, [sessionData.sessions, selectedSessionId, visitorTimezone]);
  const totalSessions = sessionData.sessions.length || 1;
  const selectedSessionNumber = Math.max(1, sessionData.sessions.findIndex(session => session.id === selectedSessionId) + 1);

  const streamLogDateSpan = React.useMemo(() => {
    const entries = streamLogData.entries;
    if (!entries || entries.length === 0) return "STREAM LOG";
    const newest = entries[0]?.playedAt;
    const oldest = entries[entries.length - 1]?.playedAt;
    return formatStreamLogDateSpan(oldest, newest, visitorTimezone);
  }, [streamLogData.entries, visitorTimezone]);

  // Active enrichment candidates for viewport micro-enrichment across modes
  const activeEnrichmentCandidates = React.useMemo(() => {
    if (activeMode === 0) {
      return currentOverview.topTracks.map((t) => ({
        id: t.id,
        trackId: t.id,
        albumImageUrl: t.albumImageUrl,
      }));
    }
    if (activeMode === 1) {
      return streamLogData.entries.map((e) => ({
        id: e.id,
        trackId: e.trackId || e.id,
        albumImageUrl: e.albumImageUrl,
        status: e.status,
      }));
    }
    if (activeMode === 2) {
      const tracks = activeSession?.tracks || [];
      return tracks.map((t) => ({
        id: t.id,
        trackId: t.id,
        albumImageUrl: t.albumImageUrl,
        status: t.status,
      }));
    }
    return [];
  }, [
    activeMode,
    currentOverview.topTracks,
    streamLogData.entries,
    activeSession,
  ]);

  useDeferredEnrichment({
    items: activeEnrichmentCandidates,
    onEnriched: handleCentralEnriched,
    enabled: isDbConfigured,
  });

  // Derived session metrics for Mode 3
  const currentSessionMetrics = React.useMemo((): [string, string, string, string] => {
    if (activeSession) {
      return [
        activeSession.runtimeStr,
        String(activeSession.trackCount),
        String(activeSession.uniqueArtistsCount),
        activeSession.startTime,
      ];
    }
    return ["--", "--", "--", "--"];
  }, [activeSession]);

  // Active metrics per mode
  const overviewMetrics: [string, string, string, string] =
    currentOverview.rawMetrics
      ? formatOverviewMetrics(currentOverview.rawMetrics, overviewTimeUnit, displayedRange)
      : currentOverview.metrics;

  const streamMetrics: [string, string, string, string] =
    streamLogData.rawMetrics
      ? formatStreamLogMetrics(streamLogData.rawMetrics)
      : streamLogData.metrics;

  // Seeds the visualizer's synthetic pattern. The live now-playing track wins
  const latestPlay = streamLogData.entries[0];

  const livePlayerMetrics: [string, string, string, string] = computeLivePlayerMetrics(
    trackStats,
    trackRankFormat,
    artistRankFormat
  );

  const profileMetrics = formatProfileRibbonMetrics(
    profileData,
    profileStatus,
    profileTarget,
    profileRange,
    visitorTimezone,
    profileTarget?.kind === "track" ? trackRankFormat : artistRankFormat,
  );

  const metricByMode: Record<Mode, [string, string, string, string]> = {
    0: overviewMetrics,
    1: streamMetrics,
    2: currentSessionMetrics,
    3: livePlayerMetrics,
    4: profileMetrics,
  };
  const currentMetrics = metricByMode[activeMode];

  const sessionTagTime =
    activeSession?.tagTime || "--";
  const isSystemLive = sessionData.sessions[0]?.isOpen || false;


  return (
    <div id="music-page-root" className="min-h-[100dvh] bg-[#080808] text-[#EDEDE8] font-sans antialiased relative overflow-x-hidden">
      {/* Black veil holding the screen as long as needed until real data is ready */}
      <div
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-[#080808] pointer-events-none select-none transition-opacity duration-300 ease-in-out ${isDataReady ? "opacity-0" : "opacity-100"
          }`}
      />
      <main className="max-w-[1240px] w-full mx-auto px-4 py-3 sm:px-8 sm:py-4 md:px-10 md:py-5 min-h-[100dvh] flex flex-col justify-between ">
        <div className="flex-1">
          {/* 1. Header Row */}
          <ListeningHeader syncError={syncError} />

          {/* 2. Mode Tabs (Underline active styling) */}
          <ModeTabs
            activeMode={activeMode}
            onSelectMode={handleSelectMode}
            onOpenUpload={() => setIsUploadModalOpen(true)}
            onOpenSpotifyModal={openAdminSpotifyModal}
            spotifyStatus={spotifyStatus}
            isAuthenticated={isAuthenticated}
            isSyncing={isSyncing}
          />

          {(activeMode !== 4 || profileTarget) && (
            <ControlRow
              mode={activeMode}
              range={activeMode === 4 ? profileRange : activeRange}
              onSelectRange={activeMode === 4 ? handleSelectProfileRange : handleSelectRange}
              logStartDate={currentOverview.logStartDate}
              isSessionOpen={isSystemLive}
              sessionTagTime={sessionTagTime}
              isSyncing={isSyncing}
              isAuthenticated={isAuthenticated}
              onTriggerSync={handleTriggerSync}
              syncError={syncError}
              streamLogCount={visibleStreamLogCount ?? (streamLogData.entries.length || loadedPlaysCount)}
              streamLogDateSpan={streamLogDateSpan}
              sessionNumber={selectedSessionNumber}
              totalSessions={totalSessions}
              onProfileBack={() => {
                handleProfileBack();
                window.scrollTo(0, 0);
              }}
              returnsTo={returnsTo}
              profileKind={activeMode === 4 ? profileTarget?.kind ?? null : null}
              layout={config.livePlayerLayout}
              onToggleLayout={handleToggleLayout}
              activeDevice={activeDevice}
              playerStatus={playerStatus}
              onTransferPlayback={handleTransferPlayback}
            />
          )}

          {(activeMode !== 4 || profileTarget) && (
            <MetricRibbon
              mode={activeMode}
              metrics={currentMetrics}
              overviewTimeUnit={overviewTimeUnit}
              onToggleTimeUnit={activeMode === 0 ? handleToggleTimeUnit : undefined}
              trackRankFormat={trackRankFormat}
              artistRankFormat={artistRankFormat}
              onToggleTrackRank={handleToggleTrackRank}
              onToggleArtistRank={handleToggleArtistRank}
              onToggleProfileRank={activeMode === 4 && profileMetrics[1] !== "--"
                ? profileTarget?.kind === "track" ? handleToggleTrackRank : handleToggleArtistRank
                : undefined}
            />
          )}

          {/* 5. Mode Views (h-auto on mobile; locked h-[584px] for Modes 0-2, adaptive min-h-[584px] for Live Player) */}
          <div
            className={`h-auto ${activeMode === 3 || (activeMode === 4 && profileTarget) ? "md:min-h-[584px] md:h-auto" : "md:h-[584px]"
              } transition-opacity duration-150 ${isSyncing || (activeMode === 0 && isRangeLoading)
                ? "opacity-40 pointer-events-none"
                : "opacity-100"
              }`}
          >
            {activeMode === 0 && (
              <OverviewView
                range={displayedRange}
                topTracks={currentOverview.topTracks}
                topArtists={currentOverview.topArtists}
                topAlbums={currentOverview.topAlbums}
                activityCadence={currentOverview.activityCadence}
                isLoading={!overviewCache[displayedRange] && isDbConfigured}
              />
            )}

            {activeMode === 1 && (
              <StreamLogView
                entries={streamLogData.entries}
                onLoadMore={handleLoadMoreStreamLog}
                isLoadingMore={isLoadingMorePlays}
                hasMore={streamLogState?.hasMore ?? (streamLogData.entries.length >= 50)}
                totalPlays={streamLogData.metrics[0]}
                isLoading={!streamLogState && isDbConfigured}
                onVisibleCountChange={setVisibleStreamLogCount}
              />
            )}

            {activeMode === 2 && (
              <SessionView
                sessions={sessionData.sessions}
                selectedSessionId={selectedSessionId}
                onSelectSession={setSelectedSessionId}
              />
            )}

            {activeMode === 3 && (
              <LivePlayerView
                latestPlay={latestPlay}
                sourceMode={sourceMode}
                onToggleSourceMode={handleToggleSourceMode}
              />
            )}

            {activeMode === 4 && (
              profileTarget ? (
                <ProfileView
                  data={profileData}
                  status={profileStatus}
                  visitorTimezone={visitorTimezone}
                  onOpenProfile={(target) => {
                    handleOpenRelatedProfile(target);
                    window.scrollTo(0, 0);
                  }}
                />
              ) : (
                <SearchView
                  query={searchQuery}
                  onQueryChange={(query) => {
                    setSearchPage(1);
                    setSearchQuery(query);
                  }}
                  sort={searchSort}
                  page={searchPage}
                  onSortChange={(sort) => {
                    setSearchPage(1);
                    setSearchSort(sort);
                  }}
                  onPageChange={setSearchPage}
                  onOpenProfile={(target) => {
                    handleOpenProfile(target);
                    window.scrollTo(0, 0);
                  }}
                />
              )
            )}
          </div>
        </div>

        {/* 6. Footer (System status only, fixed to bottom) */}
        <ListeningFooter
          isLive={isSystemLive}
          syncedAgo={syncedAgoStr}
          isSyncing={isSyncing}
          isAuthenticated={isAuthenticated}
          onTriggerSync={handleTriggerSync}
        />
      </main>

      {/* 7. In-App Customization Settings Modal */}
      <CustomizationModal />

      {/* 8. In-App Streaming History Upload Modal */}
      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUploadComplete={handleUploadComplete}
        isDbConfigured={isDbConfigured}
      />

      {/* 9. Dedicated Admin Login Modal */}
      <AdminLoginModal />

      {/* 10. Admin Spotify Token & Refresh Generator Modal */}
      <AdminSpotifyModal />
    </div>
  );
};

export const ListeningView: React.FC<ListeningViewProps> = ({
  initialConfig,
  initialVisitorTimezone,
  isDbConfigured = true,
  initialIsAuthenticated,
  ...props
}) => {
  return (
    <ConfigProvider
      initialConfig={initialConfig || undefined}
      initialVisitorTimezone={initialVisitorTimezone}
      isDbConfigured={isDbConfigured}
      initialIsAuthenticated={initialIsAuthenticated}
    >
      <PlayerProvider>
        <ListeningViewInner isDbConfigured={isDbConfigured} {...props} />
      </PlayerProvider>
    </ConfigProvider>
  );
};

