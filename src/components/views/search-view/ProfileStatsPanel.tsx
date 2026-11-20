"use client";

import React from "react";
import type { ProfileKind, ProfileSummaryStats } from "@/lib/search-types";
import {
  formatCompactPlayDate,
  formatListeningDuration,
  formatShare,
} from "@/lib/profile-stats";

export interface ProfileStatsPanelProps {
  kind: ProfileKind;
  stats: ProfileSummaryStats;
}

interface StatRow {
  label: string;
  value: string;
}

const HEADING_BY_KIND: Record<ProfileKind, string> = {
  track: "[ TRACK STATS ]",
  artist: "[ ARTIST STATS ]",
  album: "[ ALBUM STATS ]",
};

export const ProfileStatsPanel: React.FC<ProfileStatsPanelProps> = ({
  kind,
  stats,
}) => {
  const rows: StatRow[] = [
    {
      label: "LISTENING TIME",
      value: formatListeningDuration(stats.totalMs),
    },
    {
      label: "ACTIVE DAYS",
      value: stats.activeDays.toLocaleString(),
    },
  ];

  if (stats.longestStreakDays > 0) {
    rows.push({
      label: "LONGEST STREAK",
      value: `${stats.longestStreakDays.toLocaleString()} ${stats.longestStreakDays === 1 ? "DAY" : "DAYS"}`,
    });
  }

  if (stats.peakDay != null) {
    rows.push({
      label: "PEAK DAY",
      value: `${stats.peakDay.plays.toLocaleString()} · ${formatCompactPlayDate(`${stats.peakDay.date}T12:00:00Z`, "UTC")}`,
    });
  }

  if (kind === "track") {
    if (stats.completionRate != null) {
      rows.push({
        label: "COMPLETION",
        value: formatShare(stats.completionRate),
      });
    }
    if (stats.albumShare != null) {
      rows.push({
        label: "ALBUM SHARE",
        value: formatShare(stats.albumShare),
      });
    }
  }

  if (kind === "album") {
    if (stats.artistShare != null) {
      rows.push({
        label: "ARTIST SHARE",
        value: formatShare(stats.artistShare),
      });
    }
    if (stats.tracksHeardLifetime != null && stats.tracksHeardLifetime > 0) {
      rows.push({
        label: "TRACKS HEARD",
        value: `${(stats.tracksHeardInRange ?? 0).toLocaleString()} / ${stats.tracksHeardLifetime.toLocaleString()}`,
      });
    }
    if (stats.fullAlbumSessions != null && stats.fullAlbumSessions > 0) {
      rows.push({
        label: "FULL-ALBUM SESSIONS",
        value: stats.fullAlbumSessions.toLocaleString(),
      });
    }
  }

  return (
    <div>
      <span className="font-mono text-[11px] tracking-[0.14em] text-[#5A5A55] block mb-2 select-none">
        {HEADING_BY_KIND[kind]}
      </span>
      <div>
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex justify-between items-baseline gap-3 py-2 px-1 border-b border-[#191917] select-none"
          >
            <span className="font-mono text-[11px] tracking-[0.1em] text-[#5A5A55]">
              {row.label}
            </span>
            <span className="font-mono text-[12.5px] text-[#EDEDE8] tabular-nums">
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
