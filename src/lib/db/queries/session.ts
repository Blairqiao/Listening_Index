import { getCompleteSessionRows } from './session-context';
import { calculateSessions, SESSION_GAP_MS } from '@/lib/session-calculation';
import { getLastSync } from './ingestion';
import { getSwatchColor } from '@/lib/color-utils';
import type { SessionData } from './types';

export async function getCurrentSession(_tzOverride?: string): Promise<SessionData> {
  const [rows,lastSyncedAt] = await Promise.all([getCompleteSessionRows(),getLastSync('spotify')]);
  const calculated = calculateSessions(rows.map(p => ({
    ...p, playedAt:new Date(p.played_at).toISOString(),durationMs:p.duration_ms,
    trackId:p.track_id,artistId:p.artist_id,albumId:p.album_id,isFirstPlay:p.is_first_play,
  })));
  const sessions = calculated.map((session,sessionIndex) => ({
    id:session.id,startedAt:session.startedAt,endedAt:session.endedAt,runtimeMs:session.runtimeMs,
    trackCount:session.plays.length,uniqueArtistsCount:session.uniqueArtistsCount,
    isOpen:sessionIndex===0 && Date.now()-Date.parse(session.endedAt)<=SESSION_GAP_MS,
    tracks:[...session.plays].reverse().map((p,index) => ({
      id:p.track_id,playId:p.id,playedAt:p.playedAt,durationMs:p.duration_ms,
      artistId:p.artist_id || undefined,albumId:p.album_id || undefined,
      albumImageUrl:p.album_image_url || null,title:p.title,artist:p.artist,album:p.album,
      swatchColor:getSwatchColor(p.track_id+p.title),
      isActive:sessionIndex===0 && index===0 && Date.now()-Date.parse(session.endedAt)<=SESSION_GAP_MS,
      isFirstPlay:Boolean(p.is_first_play),
    })),analysis:session.analysis,
  }));
  return {sessions,lastSyncedAt:lastSyncedAt ?? (rows[0] ? new Date(rows[0].played_at).toISOString() : undefined)};
}
