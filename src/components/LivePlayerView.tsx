"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useConfig } from "@/context/ConfigContext";
import { hexToHsv, hsvToHex, normalizeHex } from "@/lib/color-utils";
import {
  BAND_COUNT,
  LiveAudioSpectrumSource,
  SpectrumSource,
  SyntheticSpectrumSource,
} from "@/lib/spectrum-source";
import {
  beginLogin,
  beginLoginPopup,
  clearToken,
  getClientId,
  setConfiguredClientId,
} from "@/lib/spotify-auth";

const SDK_SRC = "https://sdk.scdn.co/spotify-player.js";
const DEVICE_NAME = "Listening Index";

export interface LivePlayerProps {
  latestPlay?: {
    title: string;
    artist: string;
    album: string;
    albumImageUrl?: string | null;
  } | null;
  initialTrack?: {
    name: string;
    artist: string;
    album: string;
    imageUrl?: string;
    durationMs: number;
  };
}

const DEFAULT_FALLBACK_TRACK = {
  name: "Starless",
  artist: "King Crimson",
  album: "Red",
  imageUrl: "https://i.scdn.co/image/ab67616d0000b2734a7428cead5a49479b8c0a87",
  durationMs: 738000,
};

export function msToClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export function gradientStops(accent: string): [string, string, string] {
  const { h, s, v } = hexToHsv(normalizeHex(accent));
  return [
    hsvToHex(h, Math.min(100, s + 10), Math.max(30, v - 45)),
    hsvToHex(h, s, v),
    hsvToHex((h + 18) % 360, Math.max(0, s - 35), Math.min(100, v + 12)),
  ];
}

/** Loads the SDK script once per page and resolves when ready. */
let sdkPromise: Promise<void> | null = null;
function loadSdk(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.Spotify) return Promise.resolve();
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise<void>((resolve, reject) => {
    window.onSpotifyWebPlaybackSDKReady = () => resolve();
    const tag = document.createElement("script");
    tag.src = SDK_SRC;
    tag.async = true;
    tag.onerror = () => reject(new Error("Could not load the Spotify SDK script"));
    document.body.appendChild(tag);
  });
  return sdkPromise;
}

/**
 * Reusable Canvas Visualizer component for Variant B
 */
const SpectrumCanvas: React.FC<{
  trackKey: string;
  isLive: boolean;
  accentColor: string;
  sourceMode: "synthetic" | "live";
  onToggleSource: () => void;
  className?: string;
  heightClass?: string;
}> = ({
  trackKey,
  isLive,
  accentColor,
  sourceMode,
  onToggleSource,
  className = "",
  heightClass = "h-[220px]",
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sourceRef = useRef<SpectrumSource | null>(null);
  const syntheticRef = useRef<SyntheticSpectrumSource | null>(null);
  const liveRef = useRef<LiveAudioSpectrumSource | null>(null);
  const bandsRef = useRef(new Float32Array(BAND_COUNT));
  const peaksRef = useRef(new Float32Array(BAND_COUNT));
  const accentRef = useRef(accentColor);
  accentRef.current = accentColor;

  const trackRef = useRef({ trackKey, isLive });
  trackRef.current = { trackKey, isLive };

  useEffect(() => {
    syntheticRef.current?.setTrack(trackKey, isLive);
  }, [trackKey, isLive]);

  // Handle switching between synthetic and live audio modes
  useEffect(() => {
    let cancelled = false;

    if (sourceMode === "live") {
      void (async () => {
        try {
          const live = await LiveAudioSpectrumSource.create();
          if (cancelled) {
            live.stop();
            return;
          }
          live.onEnded(() => {
            onToggleSource();
          });
          sourceRef.current?.stop();
          liveRef.current = live;
          sourceRef.current = live;
          syntheticRef.current = null;
        } catch (e) {
          console.warn("[SPECTRUM] Live audio stream declined or unavailable:", e);
          if (!cancelled) onToggleSource();
        }
      })();
    } else {
      sourceRef.current?.stop();
      liveRef.current = null;
      const { trackKey: k, isLive: l } = trackRef.current;
      const synthetic = new SyntheticSpectrumSource(k, l);
      syntheticRef.current = synthetic;
      sourceRef.current = synthetic;
    }

    return () => {
      cancelled = true;
      sourceRef.current?.stop();
    };
  }, [sourceMode, onToggleSource]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let last = performance.now();
    let cssWidth = 0;
    let cssHeight = 0;
    let lastAccent = "";
    let stops: [string, string, string] = gradientStops(accentRef.current);

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      cssWidth = canvas.clientWidth;
      cssHeight = canvas.clientHeight;
      if (
        canvas.width !== Math.floor(cssWidth * dpr) ||
        canvas.height !== Math.floor(cssHeight * dpr)
      ) {
        canvas.width = Math.floor(cssWidth * dpr);
        canvas.height = Math.floor(cssHeight * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;

      const source = sourceRef.current;
      const bands = bandsRef.current;
      const peaks = peaksRef.current;
      if (source) source.read(bands, dt);

      if (accentRef.current !== lastAccent) {
        lastAccent = accentRef.current;
        stops = gradientStops(lastAccent);
      }

      ctx.clearRect(0, 0, cssWidth, cssHeight);
      if (cssWidth <= 0 || cssHeight <= 0) {
        raf = requestAnimationFrame(frame);
        return;
      }

      const reflectH = Math.max(8, Math.min(30, cssHeight * 0.12));
      const baseline = cssHeight - reflectH;
      const availableH = baseline - 8;

      const gap = 3;
      const barW = Math.max(2, (cssWidth - gap * (BAND_COUNT - 1)) / BAND_COUNT);

      const grad = ctx.createLinearGradient(0, baseline, 0, 8);
      grad.addColorStop(0, stops[0]);
      grad.addColorStop(0.55, stops[1]);
      grad.addColorStop(1, stops[2]);

      const reflGrad = ctx.createLinearGradient(0, baseline, 0, cssHeight);
      reflGrad.addColorStop(0, stops[0] + "55");
      reflGrad.addColorStop(1, "transparent");

      ctx.fillStyle = grad;
      for (let i = 0; i < BAND_COUNT; i++) {
        const v = bands[i];
        const h = Math.max(2, Math.pow(Math.max(0, v), 0.85) * availableH);
        const x = i * (barW + gap);
        ctx.fillRect(x, baseline - h, barW, h);

        if (v > peaks[i]) {
          peaks[i] = v;
        } else {
          peaks[i] = Math.max(0, peaks[i] - 0.55 * dt);
        }
        const peakY = baseline - Math.max(2, Math.pow(peaks[i], 0.85) * availableH);
        ctx.fillStyle = stops[2];
        ctx.fillRect(x, peakY - 1, barW, 1.5);
        ctx.fillStyle = grad;
      }

      // Reflection
      ctx.fillStyle = reflGrad;
      for (let i = 0; i < BAND_COUNT; i++) {
        const v = bands[i];
        const h = Math.max(2, Math.pow(Math.max(0, v), 0.85) * reflectH);
        const x = i * (barW + gap);
        ctx.fillRect(x, baseline, barW, h);
      }

      // Baseline separator line
      ctx.strokeStyle = "#1C1C1A";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, baseline + 0.5);
      ctx.lineTo(cssWidth, baseline + 0.5);
      ctx.stroke();

      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <div
      className={`relative border border-[#1C1C1A] bg-[#0A0A09] ${heightClass} ${className} overflow-hidden select-none`}
    >
      <canvas ref={canvasRef} className="w-full h-full block" />
      <div className="absolute top-2.5 right-3 flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleSource}
          className="font-mono text-[10px] tracking-[0.14em] px-2 py-0.5 border border-[#22221E] bg-[#10100E]/80 text-[#8A8A82] hover:text-music-accent hover:border-music-accent cursor-pointer transition-colors"
        >
          {sourceMode === "live" ? "[ LIVE AUDIO ]" : "[ SYNTHETIC ]"}
        </button>
      </div>
    </div>
  );
};

export const LivePlayerView: React.FC<LivePlayerProps> = ({ latestPlay, initialTrack }) => {
  const { config, isAuthenticated, openModal } = useConfig();
  const playerRef = useRef<SpotifyPlayer | null>(null);
  const deviceIdRef = useRef<string | null>(null);
  const connectingRef = useRef<boolean>(false);

  const [isLinked, setIsLinked] = useState<boolean | null>(null);
  const [playerStatus, setPlayerStatus] = useState<
    "checking" | "unlinked" | "connecting" | "ready" | "error"
  >("checking");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [state, setState] = useState<SpotifyPlaybackState | null>(null);
  const [position, setPosition] = useState<number>(0);
  const [volume, setVolume] = useState<number>(0.7);
  const volumeRef = useRef<number>(0.7);
  volumeRef.current = volume;
  const [sourceMode, setSourceMode] = useState<"synthetic" | "live">("synthetic");
  const [isAuthorizing, setIsAuthorizing] = useState<boolean>(false);

  // Sync configured client id with auth library
  useEffect(() => {
    setConfiguredClientId(config.spotifyClientId);
  }, [config.spotifyClientId]);

  // Connect Web Playback SDK
  const connectPlayer = useCallback(async () => {
    if (connectingRef.current) return;
    connectingRef.current = true;
    setErrorMessage(null);
    setPlayerStatus("connecting");

    // Clean up any existing player instance
    playerRef.current?.disconnect();
    playerRef.current = null;
    deviceIdRef.current = null;
    setDeviceId(null);

    try {
      await loadSdk();
      if (!window.Spotify) {
        throw new Error("Spotify SDK did not initialize");
      }

      const player = new window.Spotify.Player({
        name: DEVICE_NAME,
        volume: volumeRef.current,
        getOAuthToken: (cb) => {
          fetch("/api/player/token")
            .then((r) => {
              if (r.status === 401) {
                setIsLinked(false);
                setPlayerStatus("unlinked");
                setErrorMessage("Authentication session expired. Please re-link.");
                return null;
              }
              return r.json();
            })
            .then((d) => {
              if (!d) return;
              if (d?.accessToken) {
                cb(d.accessToken);
              } else if (d?.linked === false) {
                setIsLinked(false);
                setPlayerStatus("unlinked");
              } else if (d?.error) {
                setIsLinked(false);
                setPlayerStatus("unlinked");
                setErrorMessage(d.error);
              }
            })
            .catch((e) => {
              console.error("[PLAYER] Failed to refresh token:", e);
              setIsLinked(false);
              setPlayerStatus("unlinked");
              setErrorMessage("Failed to refresh token from server.");
            });
        },
      });

      player.addListener("ready", ({ device_id }) => {
        deviceIdRef.current = device_id;
        setDeviceId(device_id);
        setPlayerStatus("ready");
      });

      player.addListener("not_ready", () => {
        setPlayerStatus("connecting");
      });

      player.addListener("player_state_changed", (s) => {
        setState(s);
        if (s) {
          setPosition(s.position);
        }
      });

      player.addListener("account_error", () => {
        setErrorMessage("Spotify Premium is required for in-browser playback.");
        setPlayerStatus("error");
      });

      player.addListener("authentication_error", () => {
        clearToken();
        setIsLinked(false);
        setPlayerStatus("unlinked");
        setErrorMessage("Spotify session expired or token rejected. Please re-link.");
      });

      player.addListener("initialization_error", (e) => {
        setErrorMessage(e.message);
        setPlayerStatus("error");
      });

      player.addListener("playback_error", (e) => {
        setErrorMessage(e.message);
      });

      const ok = await player.connect();
      if (ok) {
        playerRef.current = player;
      } else {
        player.disconnect();
        setPlayerStatus("error");
        setErrorMessage("The player could not connect to Spotify.");
      }
    } catch (e) {
      setPlayerStatus("error");
      setErrorMessage(e instanceof Error ? e.message : String(e));
    } finally {
      connectingRef.current = false;
    }
  }, []);

  // Initial check of /api/player/token on mount
  const checkTokenStatus = useCallback(async () => {
    setPlayerStatus("checking");
    setErrorMessage(null);
    try {
      const res = await fetch("/api/player/token");
      if (res.status === 401) {
        // Not authorized as admin
        setIsLinked(false);
        setPlayerStatus("unlinked");
        return;
      }

      const data = await res.json().catch(() => ({}));
      if (data?.linked) {
        setIsLinked(true);
        void connectPlayer();
      } else {
        setIsLinked(false);
        setPlayerStatus("unlinked");
      }
    } catch (err) {
      setIsLinked(false);
      setPlayerStatus("unlinked");
      console.warn("[PLAYER] Failed to check token status:", err);
    }
  }, [connectPlayer]);

  useEffect(() => {
    void checkTokenStatus();
  }, [checkTokenStatus]);

  // Cleanup player on unmount
  useEffect(() => {
    return () => {
      playerRef.current?.disconnect();
      playerRef.current = null;
      deviceIdRef.current = null;
    };
  }, []);

  // Tick playback position when streaming
  useEffect(() => {
    if (!state || state.paused) return;
    const interval = setInterval(() => {
      setPosition((p) => {
        const dur = state.duration || 0;
        return dur > 0 ? Math.min(dur, p + 250) : p + 250;
      });
    }, 250);
    return () => clearInterval(interval);
  }, [state]);

  // Link Spotify action button handler
  const handleLinkSpotify = useCallback(async () => {
    if (!isAuthenticated) {
      openModal();
      return;
    }

    setIsAuthorizing(true);
    setErrorMessage(null);

    try {
      const popupResult = await beginLoginPopup();
      if (popupResult === null) {
        // Popup was blocked, redirect fallback
        await beginLogin();
        return;
      }

      if (popupResult) {
        await checkTokenStatus();
      } else {
        setErrorMessage("Spotify authorization window closed before completion.");
      }
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setIsAuthorizing(false);
    }
  }, [isAuthenticated, openModal, checkTokenStatus]);

  // Unlink Spotify handler
  const handleUnlink = useCallback(async () => {
    try {
      await fetch("/api/player/token", { method: "DELETE" });
    } catch {}
    playerRef.current?.disconnect();
    playerRef.current = null;
    deviceIdRef.current = null;
    setDeviceId(null);
    clearToken();
    setState(null);
    setIsLinked(false);
    setPlayerStatus("unlinked");
  }, []);

  // Transfer playback to Listening Index device
  const handleTransferPlayback = useCallback(async () => {
    const id = deviceIdRef.current;
    if (!id) return;
    setErrorMessage(null);

    try {
      const tokenRes = await fetch("/api/player/token");
      const tokenData = await tokenRes.json().catch(() => ({}));
      const accessToken = tokenData?.accessToken;
      if (!accessToken) {
        setErrorMessage("Could not get access token for transfer.");
        return;
      }

      const res = await fetch("https://api.spotify.com/v1/me/player", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ device_ids: [id], play: true }),
      });

      if (!res.ok && res.status !== 204) {
        setErrorMessage(
          res.status === 404
            ? "Nothing is currently queued in Spotify. Start a track on any Spotify app, then transfer."
            : `Transfer failed (${res.status}).`
        );
      }
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : "Failed to transfer playback.");
    }
  }, []);

  // Transport control handlers
  const handlePrevious = useCallback(() => {
    if (playerRef.current) {
      playerRef.current.previousTrack().catch(() => {
        playerRef.current?.seek(0);
      });
    } else {
      setPosition(0);
    }
  }, []);

  const handleTogglePlay = useCallback(() => {
    if (playerRef.current) {
      playerRef.current.togglePlay().catch((e) => {
        setErrorMessage(e.message);
      });
    }
  }, []);

  const handleNext = useCallback(() => {
    if (playerRef.current) {
      playerRef.current.nextTrack().catch(() => {});
    }
  }, []);

  const handleSeek = useCallback((ms: number) => {
    setPosition(ms);
    playerRef.current?.seek(ms);
  }, []);

  const handleVolume = useCallback((v: number) => {
    setVolume(v);
    volumeRef.current = v;
    playerRef.current?.setVolume(v);
  }, []);

  const toggleSourceMode = useCallback(() => {
    setSourceMode((m) => (m === "synthetic" ? "live" : "synthetic"));
  }, []);

  // Track metadata resolution: active Spotify stream first, fallback props second
  const currentTrack = state?.track_window.current_track;
  const isPlaying = state ? !state.paused : false;

  const displayTrack = {
    name:
      currentTrack?.name ||
      latestPlay?.title ||
      initialTrack?.name ||
      DEFAULT_FALLBACK_TRACK.name,
    artist:
      currentTrack?.artists?.map((a) => a.name).join(", ") ||
      latestPlay?.artist ||
      initialTrack?.artist ||
      DEFAULT_FALLBACK_TRACK.artist,
    album:
      currentTrack?.album?.name ||
      latestPlay?.album ||
      initialTrack?.album ||
      DEFAULT_FALLBACK_TRACK.album,
    imageUrl:
      currentTrack?.album?.images?.[0]?.url ||
      latestPlay?.albumImageUrl ||
      initialTrack?.imageUrl ||
      DEFAULT_FALLBACK_TRACK.imageUrl,
    durationMs:
      state?.duration ||
      currentTrack?.duration_ms ||
      initialTrack?.durationMs ||
      DEFAULT_FALLBACK_TRACK.durationMs,
  };

  return (
    <section aria-label="Variant B: Split Console" className="font-mono">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 border border-[#1C1C1A] bg-[#080808] p-4 sm:p-5 select-none font-mono">
        {/* Left Side: Deck & Track Info (5 cols) */}
        <div className="md:col-span-5 flex flex-col justify-between space-y-4 md:border-r md:border-[#1C1C1A] md:pr-5">
          <div className="flex items-center gap-4">
            <div className="w-[100px] sm:w-[120px] aspect-square shrink-0 border border-[#1C1C1A] bg-[#121210] overflow-hidden">
              {displayTrack.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={displayTrack.imageUrl}
                  alt={displayTrack.album}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[#5A5A55] text-[10px]">
                  NO ART
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] text-music-accent tracking-[0.16em] uppercase">
                {isPlaying ? "NOW STREAMING" : isLinked ? "PAUSED" : "OFFLINE"}
              </span>
              <div className="text-[16px] sm:text-[18px] text-[#EDEDE8] truncate font-bold mt-0.5">
                {displayTrack.name}
              </div>
              <div className="text-[12px] text-[#8A8A82] truncate mt-0.5">
                {displayTrack.artist}
              </div>
              <div className="text-[11px] text-[#5A5A55] truncate mt-0.5">
                {displayTrack.album}
              </div>
            </div>
          </div>

          {/* Connection & Device State Banner */}
          <div className="text-[10px] tracking-[0.12em] py-1 border-y border-[#161614] flex items-center justify-between min-h-[30px]">
            {playerStatus === "checking" && (
              <span className="text-[#5A5A55]">[ CHECKING CONNECTION... ]</span>
            )}

            {playerStatus === "unlinked" && (
              <div className="flex flex-wrap items-center justify-between w-full gap-2">
                <span className="text-[#8A8A82]">[ UNLINKED ]</span>
                <button
                  type="button"
                  disabled={isAuthorizing}
                  onClick={() => void handleLinkSpotify()}
                  className="px-2 py-0.5 border border-music-accent text-music-accent hover:bg-music-accent/10 bg-transparent cursor-pointer font-bold"
                >
                  {isAuthorizing
                    ? "[ WAITING FOR SPOTIFY... ]"
                    : "[ LINK SPOTIFY FOR WEB PLAYBACK ]"}
                </button>
              </div>
            )}

            {playerStatus === "connecting" && (
              <span className="text-[#5A5A55]">[ CONNECTING TO SPOTIFY... ]</span>
            )}

            {playerStatus === "ready" && (
              <div className="flex items-center justify-between w-full">
                <span className="text-music-accent">
                  {state
                    ? "[ DEVICE: LISTENING INDEX · PLAYING ]"
                    : "[ DEVICE: LISTENING INDEX · READY ]"}
                </span>
                <div className="flex items-center gap-2">
                  {!state && (
                    <button
                      type="button"
                      onClick={() => void handleTransferPlayback()}
                      className="px-1.5 py-0.5 border border-music-accent text-music-accent hover:bg-music-accent/10 bg-transparent cursor-pointer"
                    >
                      [ TRANSFER PLAYBACK HERE ]
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleUnlink()}
                    className="text-[#5A5A55] hover:text-[#EDEDE8] bg-transparent cursor-pointer"
                  >
                    [ UNLINK ]
                  </button>
                </div>
              </div>
            )}

            {playerStatus === "error" && (
              <div className="flex items-center justify-between w-full">
                <span className="text-[#FF6B6B] truncate max-w-[200px] sm:max-w-[260px]">
                  {errorMessage || "[ PLAYER ERROR ]"}
                </span>
                <button
                  type="button"
                  onClick={() => void checkTokenStatus()}
                  className="px-1.5 py-0.5 border border-[#22221E] text-[#8A8A82] hover:text-[#EDEDE8] bg-transparent cursor-pointer"
                >
                  [ RETRY ]
                </button>
              </div>
            )}
          </div>

          {/* Scrubber */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] text-[#5A5A55] tabular-nums">
              <span>{msToClock(position)}</span>
              <span>{msToClock(displayTrack.durationMs)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={displayTrack.durationMs}
              value={position}
              onChange={(e) => handleSeek(Number(e.target.value))}
              className="w-full accent-[var(--music-accent)] cursor-pointer h-1.5 bg-[#1C1C1A]"
            />
          </div>

          {/* Transport & Volume */}
          <div className="flex items-center justify-between pt-2 border-t border-[#161614] text-[11px]">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handlePrevious}
                className="px-2 py-0.5 border border-[#22221E] text-[#8A8A82] hover:text-[#EDEDE8] bg-transparent cursor-pointer"
              >
                [PREV]
              </button>
              <button
                type="button"
                onClick={handleTogglePlay}
                className="px-2.5 py-0.5 border border-music-accent text-music-accent hover:bg-music-accent/10 bg-transparent cursor-pointer font-bold"
              >
                {isPlaying ? "[PAUSE]" : "[PLAY]"}
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="px-2 py-0.5 border border-[#22221E] text-[#8A8A82] hover:text-[#EDEDE8] bg-transparent cursor-pointer"
              >
                [NEXT]
              </button>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-[#5A5A55]">
              <span>VOL</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                onChange={(e) => handleVolume(Number(e.target.value))}
                className="w-[60px] accent-[var(--music-accent)] cursor-pointer h-1 bg-[#1C1C1A]"
              />
            </div>
          </div>
        </div>

        {/* Right Side: Spectrum Tower (7 cols) - CRITICAL: Hidden on mobile (< 768px) */}
        <div className="hidden md:flex md:col-span-7 flex-col justify-between">
          <div className="flex items-center justify-between text-[10px] tracking-[0.14em] text-[#5A5A55] mb-2">
            <span>FREQUENCY SPECTRUM · REAL-TIME FFT</span>
            <span className="text-music-accent">
              {sourceMode === "live" ? "HARDWARE AUDIO" : "SYNTHETIC OSC"}
            </span>
          </div>
          <SpectrumCanvas
            trackKey={displayTrack.name}
            isLive={isPlaying}
            accentColor={config.accentColor}
            sourceMode={sourceMode}
            onToggleSource={toggleSourceMode}
            heightClass="h-[180px] sm:h-[220px] md:h-[240px]"
          />
        </div>
      </div>
    </section>
  );
};
