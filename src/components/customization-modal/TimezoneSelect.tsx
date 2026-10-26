"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Clock, Search, ChevronDown, X, Compass } from "lucide-react";
import { detectLocalTimezone } from "@/lib/timezone-utils";

// Major timezones fallback if Intl.supportedValuesOf is unavailable
const POPULAR_TIMEZONES = [
  "America/Chicago",
  "America/New_York",
  "America/Los_Angeles",
  "America/Denver",
  "America/Phoenix",
  "America/Toronto",
  "America/Vancouver",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Amsterdam",
  "Europe/Rome",
  "Europe/Madrid",
  "Europe/Stockholm",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Hong_Kong",
  "Asia/Singapore",
  "Asia/Seoul",
  "Asia/Taipei",
  "Asia/Bangkok",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Pacific/Auckland",
  "Pacific/Honolulu",
  "UTC",
];

export interface TimezoneSelectProps {
  timezone: string;
  onChange: (tz: string) => void;
}

export const TimezoneSelect: React.FC<TimezoneSelectProps> = ({ timezone, onChange }) => {
  const [tzSearch, setTzSearch] = useState<string>("");
  const [currentTimeStr, setCurrentTimeStr] = useState<string>("");
  const [isTzOpen, setIsTzOpen] = useState<boolean>(false);
  const tzContainerRef = useRef<HTMLDivElement>(null);
  const detectedTz = useMemo(() => detectLocalTimezone(), []);

  // Click-outside listener to collapse timezone dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (tzContainerRef.current && !tzContainerRef.current.contains(e.target as Node)) {
        setIsTzOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Compute live time in the selected timezone
  const updateCurrentTime = useCallback((tz: string) => {
    try {
      const now = new Date();
      const formatted = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
        timeZoneName: "short",
      }).format(now);
      setCurrentTimeStr(formatted);
    } catch {
      setCurrentTimeStr("--:--:--");
    }
  }, []);

  useEffect(() => {
    updateCurrentTime(timezone);
    const interval = setInterval(() => {
      updateCurrentTime(timezone);
    }, 1000);
    return () => clearInterval(interval);
  }, [timezone, updateCurrentTime]);

  // Comprehensive list of available IANA timezones
  const allTimezones = useMemo(() => {
    try {
      if (typeof Intl !== "undefined" && typeof Intl.supportedValuesOf === "function") {
        const supported = Intl.supportedValuesOf("timeZone");
        return Array.from(new Set([...POPULAR_TIMEZONES, ...supported]));
      }
    } catch (e) {
      console.warn("[TIMEZONE] Intl.supportedValuesOf error:", e);
    }
    return POPULAR_TIMEZONES;
  }, []);

  // Filtered timezone list for search
  const filteredTimezones = useMemo(() => {
    if (!tzSearch.trim()) return allTimezones;
    const q = tzSearch.toLowerCase();
    return allTimezones.filter((tz) => tz.toLowerCase().includes(q));
  }, [allTimezones, tzSearch]);

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between border-b border-[#1F1F1C] pb-1.5">
        <span className="font-mono text-[10px] tracking-[0.16em] text-[#8A8A82] uppercase">
          [ TIMEZONE ]
        </span>
        {currentTimeStr && (
          <span className="font-mono text-[10px] tracking-[0.08em] text-[#A0A09A] flex items-center gap-1">
            <Clock className="w-3 h-3 text-music-accent" />
            <span>{currentTimeStr}</span>
          </span>
        )}
      </div>

      <div ref={tzContainerRef} className="relative space-y-2">
        <div className="flex items-center bg-[#141413] border border-[#26261F] focus-within:border-music-accent transition-colors">
          <Search className="w-3.5 h-3.5 text-[#6A6A64] ml-3 flex-shrink-0" />
          <input
            type="text"
            value={tzSearch}
            onChange={(e) => {
              setTzSearch(e.target.value);
              setIsTzOpen(true);
            }}
            onFocus={() => setIsTzOpen(true)}
            placeholder="Search timezones (e.g. Chicago, London, Tokyo, UTC)..."
            className="w-full bg-transparent border-0 text-[#EDEDE8] font-mono text-[12px] px-2.5 py-2 focus:outline-none"
          />
          {tzSearch ? (
            <button
              type="button"
              onClick={() => {
                setTzSearch("");
                setIsTzOpen(true);
              }}
              className="px-3 text-[#6A6A64] hover:text-[#EDEDE8] cursor-pointer"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsTzOpen((prev) => !prev)}
              className="px-3 text-[#6A6A64] hover:text-[#EDEDE8] cursor-pointer"
              title={isTzOpen ? "Close list" : "Browse all timezones"}
            >
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isTzOpen ? "rotate-180" : ""}`} />
            </button>
          )}
        </div>

        {/* Collapsed dropdown menu - opens when search bar is focused or clicked */}
        {isTzOpen && (
          <div className="absolute z-30 left-0 right-0 top-[38px] max-h-52 overflow-y-auto bg-[#141413] border border-[#26261F] shadow-2xl divide-y divide-[#1C1C1A] scrollbar-hidden">
            {filteredTimezones.length === 0 ? (
              <div className="p-3 font-mono text-[11px] text-[#6A6A64] text-center">
                NO MATCHING TIMEZONES FOUND
              </div>
            ) : (
              filteredTimezones.map((tz) => {
                const isActive = timezone === tz;
                return (
                  <button
                    key={tz}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onChange(tz);
                      setIsTzOpen(false);
                      setTzSearch("");
                    }}
                    className={`w-full text-left font-mono text-[12px] px-3 py-2 flex items-center justify-between transition-colors cursor-pointer ${
                      isActive
                        ? "bg-[#1C1C19] text-music-accent font-medium"
                        : "text-[#EDEDE8] hover:bg-[#1A1A18] hover:text-white"
                    }`}
                  >
                    <span>{tz}</span>
                    {isActive && (
                      <span className="text-[10px] text-music-accent tracking-widest">[ACTIVE]</span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        )}

        {/* Active Timezone Indicator & Auto-detect Action */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 pt-0.5 font-mono text-[10px] tracking-[0.08em]">
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-[#6A6A64]">ACTIVE:</span>
            <span className="text-music-accent font-medium">{timezone}</span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {detectedTz && (
              <button
                type="button"
                onClick={() => {
                  onChange(detectedTz);
                  setIsTzOpen(false);
                }}
                title={`Set timezone to your detected local environment (${detectedTz})`}
                className={`inline-flex items-center gap-1 text-[9px] px-2 py-0.5 border transition-colors cursor-pointer ${
                  timezone === detectedTz
                    ? "border-music-accent/40 text-music-accent bg-music-accent/10"
                    : "border-[#26261F] text-[#8A8A82] hover:text-[#EDEDE8] hover:border-[#3A3A32]"
                }`}
              >
                <Compass className="w-2.5 h-2.5" />
                <span>{timezone === detectedTz ? `[ LOCAL: ${detectedTz} ]` : `[ DETECT LOCAL: ${detectedTz} ]`}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsTzOpen((prev) => !prev)}
              className="text-[#6A6A64] hover:text-[#EDEDE8] underline text-[9px] cursor-pointer"
            >
              {isTzOpen ? "COLLAPSE LIST" : "BROWSE ALL"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
