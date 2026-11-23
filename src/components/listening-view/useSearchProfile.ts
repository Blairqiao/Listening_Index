import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_PROFILE_RANGE,
  type ProfileData,
  type ProfileHistoryEntry,
  type ProfileTarget,
} from "@/lib/search-types";
import type { Mode } from "@/lib/types";
import {
  formatRangeParam,
  isSameRange,
  type RangeSelection,
} from "@/lib/range";
import {
  getProfileCacheKey,
  resolveDisplayedProfileData,
  type ProfileStatus,
} from "./listening-helpers";

const MAX_PROFILE_HISTORY = 20;

export interface UseSearchProfileParams {
  activeMode: Mode;
  visitorTimezone: string;
  initialProfile?: ProfileTarget | null;
  initialProfileRange?: RangeSelection | null;
  initialSearchQuery?: string;
  isSyncing?: boolean;
  onRequestPushHistory?: () => void;
}

export function useSearchProfile({
  activeMode,
  visitorTimezone,
  initialProfile,
  initialProfileRange,
  initialSearchQuery,
  isSyncing = false,
  onRequestPushHistory,
}: UseSearchProfileParams) {
  const [searchQuery, setSearchQuery] = useState<string>(() => initialSearchQuery ?? "");
  const [profileTarget, setProfileTarget] = useState<ProfileTarget | null>(
    () => initialProfile ?? null
  );
  const [profileRange, setProfileRange] = useState<RangeSelection>(() => {
    return initialProfileRange ?? DEFAULT_PROFILE_RANGE;
  });
  const [profileHistory, setProfileHistory] = useState<ProfileHistoryEntry[]>([]);
  const [rawProfileData, setRawProfileData] = useState<ProfileData | null>(null);
  const [profileStatus, setProfileStatus] = useState<ProfileStatus>("loading");
  const [cacheVersion, setCacheVersion] = useState(0);

  const profileCacheRef = useRef<Map<string, ProfileData>>(new Map());
  const requestGenerationRef = useRef(0);

  const profileData = resolveDisplayedProfileData(rawProfileData, profileTarget);

  const openProfileAt = useCallback(
    (target: ProfileTarget, nextRange: RangeSelection) => {
      const cacheKey = getProfileCacheKey(target, nextRange, visitorTimezone);
      const cached = profileCacheRef.current.get(cacheKey);

      setProfileRange(nextRange);

      if (cached) {
        const canonicalTarget: ProfileTarget = { kind: cached.kind, key: cached.key };
        const canonicalCacheKey = getProfileCacheKey(
          canonicalTarget,
          nextRange,
          visitorTimezone
        );
        profileCacheRef.current.set(canonicalCacheKey, cached);
        setRawProfileData(cached);
        setProfileStatus("ready");
        setProfileTarget(canonicalTarget);
        return;
      }

      setProfileTarget(target);
      setRawProfileData((prev) => resolveDisplayedProfileData(prev, target));
      setProfileStatus("loading");
    },
    [visitorTimezone]
  );

  const handleReturnToSearch = useCallback(() => {
    requestGenerationRef.current++;
    setProfileHistory([]);
    setProfileTarget(null);
    setRawProfileData(null);
    setProfileStatus("loading");
  }, []);

  const handleOpenProfile = useCallback(
    (target: ProfileTarget) => {
      setProfileHistory([]);
      openProfileAt(target, DEFAULT_PROFILE_RANGE);
    },
    [openProfileAt]
  );

  const handleOpenRelatedProfile = useCallback(
    (target: ProfileTarget) => {
      if (
        profileTarget &&
        (target.kind !== profileTarget.kind || target.key !== profileTarget.key)
      ) {
        setProfileHistory((prev) => {
          const top = prev.at(-1);
          if (top && top.target.kind === target.kind && top.target.key === target.key) {
            return prev.slice(0, -1);
          }
          const next = [
            ...prev,
            {
              target: profileTarget,
              range: profileRange,
              name: profileData?.name,
            },
          ];
          return next.length > MAX_PROFILE_HISTORY
            ? next.slice(next.length - MAX_PROFILE_HISTORY)
            : next;
        });
      }
      openProfileAt(target, profileRange);
    },
    [openProfileAt, profileData?.name, profileRange, profileTarget]
  );

  const handleProfileBack = useCallback(() => {
    if (profileHistory.length > 0) {
      const previous = profileHistory[profileHistory.length - 1];
      setProfileHistory((prev) => prev.slice(0, -1));
      openProfileAt(previous.target, previous.range);
      return;
    }

    handleReturnToSearch();
  }, [profileHistory, openProfileAt, handleReturnToSearch]);

  const handleJumpToHistory = useCallback(
    (index: number) => {
      if (index < 0) {
        handleReturnToSearch();
        return;
      }
      if (index >= profileHistory.length) return;
      const entry = profileHistory[index];
      setProfileHistory((prev) => prev.slice(0, index));
      openProfileAt(entry.target, entry.range);
    },
    [profileHistory, openProfileAt, handleReturnToSearch]
  );

  const syncFromLocation = useCallback(
    (
      target: ProfileTarget | null,
      range: RangeSelection | null,
      history?: ProfileHistoryEntry[]
    ) => {
      if (!target) {
        handleReturnToSearch();
        return;
      }
      if (history !== undefined) {
        const bounded =
          history.length > MAX_PROFILE_HISTORY
            ? history.slice(history.length - MAX_PROFILE_HISTORY)
            : history.slice();
        setProfileHistory(bounded);
      } else {
        setProfileHistory((prev) => {
          const top = prev.at(-1);
          if (top && top.target.kind === target.kind && top.target.key === target.key) {
            return prev.slice(0, -1);
          }
          return prev;
        });
      }
      openProfileAt(target, range ?? DEFAULT_PROFILE_RANGE);
    },
    [openProfileAt, handleReturnToSearch]
  );

  const clearProfileCache = useCallback(() => {
    profileCacheRef.current.clear();
    requestGenerationRef.current++;
    setCacheVersion((v) => v + 1);
  }, []);

  const handleSelectProfileRange = useCallback(
    (range: RangeSelection, opts?: { push?: boolean }) => {
      if (isSyncing || isSameRange(range, profileRange)) return;
      if (opts?.push) {
        onRequestPushHistory?.();
      }
      setProfileRange(range);
      if (!profileTarget) return;

      const cacheKey = getProfileCacheKey(profileTarget, range, visitorTimezone);
      const cached = profileCacheRef.current.get(cacheKey);
      if (cached) {
        const canonicalTarget: ProfileTarget = { kind: cached.kind, key: cached.key };
        const canonicalCacheKey = getProfileCacheKey(
          canonicalTarget,
          range,
          visitorTimezone
        );
        profileCacheRef.current.set(canonicalCacheKey, cached);
        setRawProfileData(cached);
        setProfileStatus("ready");
        if (
          canonicalTarget.key !== profileTarget.key ||
          canonicalTarget.kind !== profileTarget.kind
        ) {
          setProfileTarget(canonicalTarget);
        }
        return;
      }

      setRawProfileData((prev) => resolveDisplayedProfileData(prev, profileTarget));
      setProfileStatus("loading");
    },
    [isSyncing, onRequestPushHistory, profileRange, profileTarget, visitorTimezone]
  );

  useEffect(() => {
    if (activeMode !== 4 || !profileTarget) {
      return;
    }

    const requestedTarget = profileTarget;
    const requestedRange = profileRange;
    const requestedTz = visitorTimezone;
    const cacheKey = getProfileCacheKey(requestedTarget, requestedRange, requestedTz);
    const cached = profileCacheRef.current.get(cacheKey);

    if (cached) {
      const canonicalTarget: ProfileTarget = { kind: cached.kind, key: cached.key };
      const canonicalCacheKey = getProfileCacheKey(
        canonicalTarget,
        requestedRange,
        requestedTz
      );
      profileCacheRef.current.set(canonicalCacheKey, cached);
      setRawProfileData(cached);
      setProfileStatus("ready");
      if (
        canonicalTarget.key !== requestedTarget.key ||
        canonicalTarget.kind !== requestedTarget.kind
      ) {
        setProfileTarget(canonicalTarget);
      }
      return;
    }

    let cancelled = false;
    const generation = ++requestGenerationRef.current;
    const controller = new AbortController();

    setProfileStatus("loading");
    setRawProfileData((prev) => resolveDisplayedProfileData(prev, requestedTarget));

    const params = new URLSearchParams();
    params.set(requestedTarget.kind, requestedTarget.key);
    params.set("prange", formatRangeParam(requestedRange));
    params.set("tz", requestedTz);

    fetch(`/api/listening/profile?${params.toString()}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (res) => {
        if (
          cancelled ||
          controller.signal.aborted ||
          generation !== requestGenerationRef.current
        ) {
          return;
        }

        if (res.status === 404) {
          setRawProfileData(null);
          setProfileStatus("not_found");
          return;
        }

        if (!res.ok) {
          setRawProfileData(null);
          setProfileStatus("error");
          return;
        }

        const data = (await res.json()) as ProfileData;
        if (
          cancelled ||
          controller.signal.aborted ||
          generation !== requestGenerationRef.current
        ) {
          return;
        }

        const canonicalTarget: ProfileTarget = { kind: data.kind, key: data.key };
        const canonicalCacheKey = getProfileCacheKey(
          canonicalTarget,
          requestedRange,
          requestedTz
        );
        profileCacheRef.current.set(cacheKey, data);
        profileCacheRef.current.set(canonicalCacheKey, data);

        setRawProfileData(data);
        setProfileStatus("ready");

        if (
          canonicalTarget.key !== requestedTarget.key ||
          canonicalTarget.kind !== requestedTarget.kind
        ) {
          setProfileTarget(canonicalTarget);
        }
      })
      .catch((err: unknown) => {
        if (
          cancelled ||
          (err as Error)?.name === "AbortError" ||
          controller.signal.aborted ||
          generation !== requestGenerationRef.current
        ) {
          return;
        }
        setRawProfileData(null);
        setProfileStatus("error");
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [activeMode, profileTarget, profileRange, visitorTimezone, cacheVersion]);

  return {
    searchQuery,
    setSearchQuery,
    profileTarget,
    profileRange,
    profileData,
    profileStatus,
    profileHistory,
    handleOpenProfile,
    handleOpenRelatedProfile,
    handleProfileBack,
    handleJumpToHistory,
    handleReturnToSearch,
    syncFromLocation,
    clearProfileCache,
    returnsTo: profileHistory.at(-1)?.target.kind ?? null,
    handleSelectProfileRange,
  };
}
