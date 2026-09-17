import {
  getPendingTracksForEnrichment,
  recordApiCooldown,
  getActiveApiCooldown,
  getPendingTracksInAlbum,
  bulkApplyEnrichment,
  getEnrichmentProgress,
  cleanupOrphanedSyntheticEntities,
  checkAndIncrementApiQuota,
  EnrichedTrackItem,
} from "@/lib/db/queries";
import { getAccessToken } from "@/lib/spotify";
import { clearServerCache } from "@/lib/db/server-cache";

export interface EnrichmentBatchOptions {
  bucket?: "cron" | "dynamic";
  trackIds?: string[];
}

export interface EnrichmentBatchResult {
  enrichedCount: number;
  delistedCount: number;
  rateLimited?: boolean;
  retryAfterSeconds?: number;
  quotaReached?: boolean;
  reason?: string;
  isComplete: boolean;
  enriched?: EnrichedTrackItem[];
  delistedIds?: string[];
  progress: {
    pending: number;
    enriched: number;
    delisted: number;
    total: number;
  };
}

/**
 * Runs a quota-budgeted batch of metadata enrichment.
 * In 'cron' mode: applies Density-Gated Fan-Out for album clusters (up to 14 calls).
 * In 'dynamic' mode: enriches requested viewport tracks via singular track lookups (up to 5 calls).
 */
export async function runEnrichmentBatch(
  options: EnrichmentBatchOptions = {}
): Promise<EnrichmentBatchResult> {
  const bucket = options.bucket || (options.trackIds && options.trackIds.length > 0 ? "dynamic" : "cron");

  // 1. Check global rate limit cooldown (HTTP 429)
  const cooldown = await getActiveApiCooldown("spotify");
  if (cooldown.active) {
    const progress = await getEnrichmentProgress();
    return {
      enrichedCount: 0,
      delistedCount: 0,
      rateLimited: true,
      retryAfterSeconds: 15,
      reason: cooldown.reason || "Rate limit cooldown active",
      isComplete: progress.pending === 0,
      progress,
    };
  }

  // 2. Check persistent daily quota ledger
  const initialQuotaCheck = await checkAndIncrementApiQuota(bucket, 0);
  if (!initialQuotaCheck.allowed || initialQuotaCheck.remaining <= 0) {
    const progress = await getEnrichmentProgress();
    return {
      enrichedCount: 0,
      delistedCount: 0,
      quotaReached: true,
      reason: `Daily quota ceiling reached for bucket: ${bucket}`,
      isComplete: progress.pending === 0,
      progress,
    };
  }

  const batchCeiling = bucket === "dynamic" ? 5 : 14;
  const limit = Math.max(1, Math.min(batchCeiling, initialQuotaCheck.remaining));

  // 3. Fetch pending tracks (explicit trackIds for viewport, or chronologically ordered for cron)
  const pendingTracks = await getPendingTracksForEnrichment(limit, {
    trackIds: options.trackIds,
  });

  if (pendingTracks.length === 0) {
    const progress = await getEnrichmentProgress();
    const isComplete = progress.pending === 0;
    if (isComplete) {
      await cleanupOrphanedSyntheticEntities();
      clearServerCache();
    }
    return {
      enrichedCount: 0,
      delistedCount: 0,
      isComplete,
      progress,
    };
  }

  let token = await getAccessToken();
  const enrichedItems: EnrichedTrackItem[] = [];
  const delistedIds: string[] = [];
  const resolvedTrackIds = new Set<string>();

  // 4. Density-Gated Fan-Out Analysis (Exclusively for background cron)
  if (bucket === "cron") {
    const albumGroups = new Map<string, Array<(typeof pendingTracks)[0]>>();
    for (const track of pendingTracks) {
      const key = track.albumGroupKey;
      const existing = albumGroups.get(key) || [];
      existing.push(track);
      albumGroups.set(key, existing);
    }

    for (const [albumKey, tracksInGroup] of albumGroups.entries()) {
      try {
        const pendingSiblings = await getPendingTracksInAlbum(albumKey);

        // Density threshold: if 3 or more tracks belong to this album, attempt album fan-out
        if (pendingSiblings.length >= 3 && tracksInGroup.length > 0) {
          const seed = tracksInGroup[0];

          // Check quota for seed track request
          const seedQuota = await checkAndIncrementApiQuota("cron", 1);
          if (!seedQuota.allowed) break;

          const seedRes = await fetch(
            `https://api.spotify.com/v1/tracks/${encodeURIComponent(seed.id)}`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
            }
          );

          if (seedRes.status === 429) {
            const retryAfter = parseInt(seedRes.headers.get("Retry-After") || "10", 10);
            await recordApiCooldown("spotify", retryAfter, "HTTP 429 Too Many Requests");
            if (enrichedItems.length > 0 || delistedIds.length > 0) {
              await bulkApplyEnrichment({ enriched: enrichedItems, delistedIds });
            }
            const progress = await getEnrichmentProgress();
            return {
              enrichedCount: enrichedItems.length,
              delistedCount: delistedIds.length,
              rateLimited: true,
              retryAfterSeconds: retryAfter,
              isComplete: false,
              progress,
            };
          }

          if (seedRes.ok) {
            const seedData = (await seedRes.json()) as any;
            const albumObj = seedData.album;
            const albumId = albumObj?.id;
            const albumImageUrl = albumObj?.images?.[0]?.url || null;
            const albumName = albumObj?.name || seed.albumName;
            const primaryArtist = seedData.artists?.[0];

            if (albumId && primaryArtist) {
              enrichedItems.push({
                requestedId: seed.id,
                name: seedData.name || seed.name,
                durationMs: seedData.duration_ms || 0,
                artistId: primaryArtist.id,
                artistName: primaryArtist.name || seed.artistName,
                albumId: albumId,
                albumName: albumName,
                albumImageUrl: albumImageUrl,
              });
              resolvedTrackIds.add(seed.id);

              // Unmatched sibling tracks for this album
              const unmatchedSiblings = new Map<string, (typeof pendingSiblings)[0]>();
              for (const sibling of pendingSiblings) {
                if (sibling.id !== seed.id && !resolvedTrackIds.has(sibling.id)) {
                  unmatchedSiblings.set(sibling.id, sibling);
                }
              }

              // Fetch album tracks with conditional pagination (tracks 1-50, then 51-100+ if needed)
              let nextUrl: string | null = `https://api.spotify.com/v1/albums/${encodeURIComponent(albumId)}/tracks?limit=50`;
              let pageCount = 0;
              const MAX_PAGES = 3; // Up to 150 tracks max

              while (nextUrl && unmatchedSiblings.size > 0 && pageCount < MAX_PAGES) {
                const albumQuota = await checkAndIncrementApiQuota("cron", 1);
                if (!albumQuota.allowed) break;

                const albumTracksRes = await fetch(nextUrl, {
                  headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                  },
                });

                if (albumTracksRes.status === 429) {
                  const retryAfter = parseInt(albumTracksRes.headers.get("Retry-After") || "10", 10);
                  await recordApiCooldown("spotify", retryAfter, "HTTP 429 Too Many Requests");
                  break;
                }

                if (!albumTracksRes.ok) {
                  break;
                }

                const albumTracksData = (await albumTracksRes.json()) as any;
                const items: any[] = albumTracksData.items || [];

                for (const item of items) {
                  if (!item?.id) continue;
                  const sibling = unmatchedSiblings.get(item.id);
                  if (sibling) {
                    const siblingArtist = item.artists?.[0] || primaryArtist;
                    enrichedItems.push({
                      requestedId: sibling.id,
                      name: item.name || sibling.name,
                      durationMs: item.duration_ms || 0,
                      artistId: siblingArtist.id,
                      artistName: siblingArtist.name || sibling.artistName,
                      albumId: albumId,
                      albumName: albumName,
                      albumImageUrl: albumImageUrl,
                    });
                    resolvedTrackIds.add(sibling.id);
                    unmatchedSiblings.delete(sibling.id);
                  }
                }

                pageCount++;
                // Only advance to next page if there are still unmatched siblings from our DB
                nextUrl = unmatchedSiblings.size > 0 ? (albumTracksData.next || null) : null;
              }
            }
          } else if (seedRes.status === 404) {
            delistedIds.push(seed.id);
            resolvedTrackIds.add(seed.id);
          }
        }
      } catch {
        // Continue to next album cluster
      }
    }
  }

  // 5. Resolve remaining tracks via singular GET /v1/tracks/:id
  const remainingTracks = pendingTracks.filter((t) => !resolvedTrackIds.has(t.id));
  const CONCURRENCY = bucket === "dynamic" ? 5 : 3;

  for (let i = 0; i < remainingTracks.length; i += CONCURRENCY) {
    const chunk = remainingTracks.slice(i, i + CONCURRENCY);

    // Atomically reserve quota for this chunk
    const quotaCheck = await checkAndIncrementApiQuota(bucket, chunk.length);
    if (!quotaCheck.allowed) {
      break;
    }

    const results = await Promise.all(
      chunk.map(async (t) => {
        try {
          const res = await fetch(`https://api.spotify.com/v1/tracks/${encodeURIComponent(t.id)}`, {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          });

          if (res.status === 429) {
            const retryAfter = parseInt(res.headers.get("Retry-After") || "10", 10);
            return { id: t.id, rateLimited: true, retryAfterSeconds: retryAfter };
          }

          if (res.status === 404) {
            return { id: t.id, isDelisted: true };
          }

          if (res.status >= 500 || !res.ok) {
            return { id: t.id, isTransient: true, error: `HTTP ${res.status}` };
          }

          const trackData = await res.json();
          return { id: t.id, track: trackData };
        } catch (err: any) {
          return { id: t.id, isTransient: true, error: err?.message || "Network error" };
        }
      })
    );

    for (const r of results) {
      if ("rateLimited" in r && r.rateLimited) {
        await recordApiCooldown("spotify", r.retryAfterSeconds, "HTTP 429 Too Many Requests");
        if (enrichedItems.length > 0 || delistedIds.length > 0) {
          await bulkApplyEnrichment({ enriched: enrichedItems, delistedIds });
        }
        const progress = await getEnrichmentProgress();
        return {
          enrichedCount: enrichedItems.length,
          delistedCount: delistedIds.length,
          rateLimited: true,
          retryAfterSeconds: r.retryAfterSeconds,
          isComplete: false,
          progress,
        };
      }

      if ("isDelisted" in r && r.isDelisted) {
        delistedIds.push(r.id);
        continue;
      }

      if ("isTransient" in r && r.isTransient) {
        continue;
      }

      const spTrack = (r as any).track;
      if (!spTrack) {
        delistedIds.push(r.id);
        continue;
      }

      const primaryArtist = spTrack.artists?.[0];
      const album = spTrack.album;

      if (!primaryArtist?.id || !album?.id) {
        delistedIds.push(r.id);
        continue;
      }

      enrichedItems.push({
        requestedId: r.id,
        name: spTrack.name || "Unknown Track",
        durationMs: spTrack.duration_ms || 0,
        artistId: primaryArtist.id,
        artistName: primaryArtist.name || "Unknown Artist",
        albumId: album.id,
        albumName: album.name || "Unknown Album",
        albumImageUrl: album.images?.[0]?.url || null,
      });
    }
  }

  // 6. Apply enrichment in PostgreSQL
  await bulkApplyEnrichment({
    enriched: enrichedItems,
    delistedIds,
  });

  const progress = await getEnrichmentProgress();
  const isComplete = progress.pending === 0;

  if (isComplete) {
    await cleanupOrphanedSyntheticEntities();
  }
  clearServerCache();

  return {
    enrichedCount: enrichedItems.length,
    delistedCount: delistedIds.length,
    isComplete,
    enriched: enrichedItems,
    delistedIds,
    progress,
  };
}
