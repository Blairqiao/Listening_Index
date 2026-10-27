import type { StreamLogItem, SessionItem, SessionRecord } from './types';
import { formatHHmmTz, formatDayGroupTz, formatTimeTz, formatDurationHoursMinutes, formatSessionAge } from './db/queries/helpers';
import { formatDurationMs } from './format-utils';

export function presentStreamLog(entries: readonly StreamLogItem[], timezone: string) {
  let previousDay: string | undefined;
  return entries.map(entry => {
    const date = new Date(entry.playedAt!);
    const day = formatDayGroupTz(date, timezone);
    const dayGroup = day === previousDay ? undefined : day;
    previousDay = day;
    return { ...entry, timeStr: formatHHmmTz(date, timezone), duration: formatDurationMs(entry.durationMs || 0), dayGroup,
      sessionGap: entry.sessionGap ? { ...entry.sessionGap,
        durationStr: formatDurationHoursMinutes(entry.sessionGap.durationMs),
        sittingLabel: 'PREVIOUS SESSION',
      } : undefined };
  });
}

export function presentSessionItem(track: SessionItem, timezone: string) {
  return { ...track, timestamp: formatHHmmTz(new Date(track.playedAt!), timezone), duration: formatDurationMs(track.durationMs || 0) };
}

export function presentSession(session: SessionRecord, timezone: string) {
  const started = new Date(session.startedAt!);
  const ended = new Date(session.endedAt!);
  const runtimeMs = session.runtimeMs || 0;
  return { ...session,
    dateStr: formatDayGroupTz(started, timezone),
    runtimeStr: formatDurationHoursMinutes(Math.max(60_000, runtimeMs)),
    runtimeMinutes: Math.max(1, Math.round(runtimeMs / 60_000)),
    startTime: formatTimeTz(started, timezone),
    tagTime: session.isOpen ? formatTimeTz(ended, timezone) : formatSessionAge(Date.now() - ended.getTime()),
    tracks: session.tracks.map(track => presentSessionItem(track, timezone)),
  };
}

export type PresentedSession = ReturnType<typeof presentSession>;
export type PresentedSessionItem = ReturnType<typeof presentSessionItem>;

export function presentSessionHistogram(sessions: readonly SessionRecord[], timezone: string) {
  const presented = sessions.slice(0, 20).map(session => presentSession(session, timezone)).reverse();
  return {
    avgRuntimeMinutes: presented.length ? Math.round(presented.reduce((sum, session) => sum + session.runtimeMinutes, 0) / presented.length) : 0,
    oldestDate: presented[0]?.dateStr || "--",
    newestDate: presented[presented.length - 1]?.dateStr || "--",
    bars: presented.map(session => ({ id: session.id, runtimeMinutes: session.runtimeMinutes, dateStr: session.dateStr, trackCount: session.trackCount, title: `${session.dateStr} · ${session.runtimeStr}` })),
  };
}
