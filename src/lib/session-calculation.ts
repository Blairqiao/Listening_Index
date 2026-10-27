import { makeAlbumGroupKey, makeArtistGroupKey } from './history-parser';

export const SESSION_GAP_MS = 1_800_000;
export interface SessionPlay {
  id: string;
  playedAt: string;
  durationMs?: number | null;
  trackId: string;
  title: string;
  artist: string;
  artistId?: string | null;
  album: string;
  albumId?: string | null;
  isFirstPlay?: boolean;
}
export function safeDuration(value?: number | null): number {
  return Number.isFinite(value) && Number(value) > 0 ? Number(value) : 0;
}
export function comparePlayIds(a: string, b: string): number {
  if (/^\d+$/.test(a) && /^\d+$/.test(b)) return BigInt(a) < BigInt(b) ? -1 : BigInt(a) > BigInt(b) ? 1 : 0;
  return a.localeCompare(b);
}
export function calculateSessions<T extends SessionPlay>(input: readonly T[]) {
  const sorted = [...input].sort((a,b) => Date.parse(a.playedAt)-Date.parse(b.playedAt) || comparePlayIds(a.id,b.id));
  const groups: T[][] = [];
  for (const play of sorted) {
    const group = groups[groups.length-1];
    if (!group || Date.parse(play.playedAt)-Date.parse(group[group.length-1].playedAt)>SESSION_GAP_MS) groups.push([play]);
    else group.push(play);
  }
  return groups.map(plays => {
    const earliest = plays[0];
    const latest = plays[plays.length-1];
    const runtimeMs = Math.max(Date.parse(latest.playedAt)-Date.parse(earliest.playedAt)+safeDuration(earliest.durationMs),plays.reduce((sum,p)=>sum+safeDuration(p.durationMs),0));
    const recent = [...plays].reverse();
    const top = (key: (p:T)=>string) => {
      const counts = new Map<string,number>();
      for (const p of plays) counts.set(key(p),(counts.get(key(p))||0)+1);
      let winner = recent[0];
      for (const p of recent) if (counts.get(key(p))!>counts.get(key(winner))!) winner=p;
      return {play:winner,count:counts.get(key(winner))!};
    };
    const track=top(p=>p.trackId);
    const album=top(p=>p.albumId || makeAlbumGroupKey(p.artist,p.album));
    const artist=top(p=>p.artistId || makeArtistGroupKey(p.artist));
    return {id:earliest.id,plays,runtimeMs,startedAt:earliest.playedAt,endedAt:latest.playedAt,analysis:{
      firstPlaysCount:plays.filter(p=>p.isFirstPlay).length,totalTracks:plays.length,
      topTrack:{id:track.play.trackId,title:track.play.title,artist:track.play.artist,count:track.count},
      topAlbum:{id:album.play.albumId || undefined,title:album.play.album,artist:album.play.artist,count:album.count},
      topArtist:{id:artist.play.artistId || undefined,name:artist.play.artist,count:artist.count},
    },uniqueArtistsCount:new Set(plays.map(p=>p.artistId || makeArtistGroupKey(p.artist))).size};
  }).reverse();
}
