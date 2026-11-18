import { useCallback, useEffect, useRef, useState } from "react";
import type { ProfileData, ProfileTarget } from "@/lib/search-types";
import type { Mode, RangeKey } from "@/lib/types";
import {
  getProfileCacheKey,
  resolveDisplayedProfileData,
  type ProfileStatus,
} from "./listening-helpers";

export interface UseSearchProfileParams {
  activeMode: Mode;
  activeRange: RangeKey;
  visitorTimezone: string;
  initialRange: RangeKey;
  initialProfile?: ProfileTarget | null;
  initialProfileRange?: RangeKey | null;
  isSyncing?: boolean;
}

export function useSearchProfile({
  activeMode,
  activeRange,
  visitorTimezone,
  initialRange,
  initialProfile,
  initialProfileRange,
  isSyncing = false,
}: UseSearchProfileParams) {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [profileTarget, setProfileTarget] = useState<ProfileTarget | null>(
    () => initialProfile ?? null
  );
  const [profileRange, setProfileRange] = useState<RangeKey>(
    () => initialProfileRange ?? initialRange
  );
  const [rawProfileData, setRawProfileData] = useState<ProfileData | null>(null);
  const [profileStatus, setProfileStatus] = useState<ProfileStatus>("loading");

  const profileCacheRef = useRef<Map<string, ProfileData>>(new Map());
  const requestGenerationRef = useRef(0);

  const openProfileAt = useCallback(
    (target: ProfileTarget, nextRange: RangeKey) => {
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

  // From Search results: start at Overview's current range.
  const handleOpenProfile = useCallback(
    (target: ProfileTarget) => openProfileAt(target, activeRange),
    [openProfileAt, activeRange]
  );

  // From inside a profile (a top Track): keep the profile's range, since its lists were ranked in it.
  const handleOpenRelatedProfile = useCallback(
    (target: ProfileTarget) => openProfileAt(target, profileRange),
    [openProfileAt, profileRange]
  );

  const handleProfileBack = useCallback(() => {
    requestGenerationRef.current++;
    setProfileTarget(null);
    setRawProfileData(null);
    setProfileStatus("loading");
  }, []);

  const handleSelectProfileRange = useCallback(
    (range: RangeKey) => {
      if (isSyncing || range === profileRange) return;
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
    [isSyncing, profileRange, profileTarget, visitorTimezone]
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
    params.set("prange", requestedRange);
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
  }, [activeMode, profileTarget, profileRange, visitorTimezone]);

  const profileData = resolveDisplayedProfileData(rawProfileData, profileTarget);

  return {
    searchQuery,
    setSearchQuery,
    profileTarget,
    profileRange,
    profileData,
    profileStatus,
    handleOpenProfile,
    handleOpenRelatedProfile,
    handleProfileBack,
    handleSelectProfileRange,
  };
}
