"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  beginLogin,
  clearToken,
  getClientId,
  getFreshAccessToken,
  getRedirectUri,
  readToken,
} from "@/lib/spotify-auth";

const SDK_SRC = "https://sdk.scdn.co/spotify-player.js";
const DEVICE_NAME = "Listening Index";

export type PlayerStatus =
  | "unconfigured"
  | "disconnected"
  | "connecting"
  | "ready"
  | "error";

interface PlayerViewProps {
  /** Lets the page mirror connection state into the metric ribbon. */
  onStatusChange?: (status: PlayerStatus, trackName: string | null) => void;
}

/** Loads the SDK script once per page and resolves when it announces itself. */
let sdkPromise: Promise<void> | null = null;
function loadSdk(): Promise<void> {
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

function msToClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export const PlayerView: React.FC<PlayerViewProps> = ({ onStatusChange }) => {
  const playerRef = useRef<SpotifyPlayer | null>(null);
  const deviceIdRef = useRef<string | null>(null);
  const statusRef = useRef<(s: PlayerStatus, t: string | null) => void>(() => {});

  const [status, setStatus] = useState<PlayerStatus>("disconnected");
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<SpotifyPlaybackState | null>(null);
  const [position, setPosition] = useState(0);
  const [volume, setVolume] = useState(0.6);

  statusRef.current = (s, t) => onStatusChange?.(s, t);

  const track = state?.track_window.current_track ?? null;

  useEffect(() => {
    statusRef.current(status, track?.name ?? null);
  }, [status, track?.name]);

  // Nothing works without a public client id, so say so rather than failing
  // inside the SDK with an opaque initialization error.
  useEffect(() => {
    if (!getClientId()) setStatus("unconfigured");
    else if (readToken()) setStatus("connecting");
  }, []);

  const connect = useCallback(async () => {
    setError(null);
    setStatus("connecting");
    try {
      await loadSdk();
      const token = await getFreshAccessToken();
      if (!token) {
        setStatus("disconnected");
        return;
      }
      if (!window.Spotify) throw new Error("Spotify SDK did not initialize");

      const player = new window.Spotify.Player({
        name: DEVICE_NAME,
        volume,
        // Called again whenever the SDK needs a fresh token, so refreshing
        // here keeps a long session alive without a reconnect.
        getOAuthToken: (cb) => {
          void getFreshAccessToken().then((t) => t && cb(t));
        },
      });

      player.addListener("ready", ({ device_id }) => {
        deviceIdRef.current = device_id;
        setStatus("ready");
      });
      player.addListener("not_ready", () => setStatus("connecting"));
      player.addListener("player_state_changed", (s) => {
        setState(s);
        if (s) setPosition(s.position);
      });
      player.addListener("account_error", () =>
        fail("Spotify Premium is required for in-browser playback.")
      );
      player.addListener("authentication_error", () => {
        clearToken();
        fail("Spotify rejected the token. Connect again.");
      });
      player.addListener("initialization_error", (e) => fail(e.message));
      player.addListener("playback_error", (e) => setError(e.message));

      const ok = await player.connect();
      if (!ok) fail("The player could not connect.");
      playerRef.current = player;
    } catch (e) {
      fail(e instanceof Error ? e.message : String(e));
    }

    function fail(message: string) {
      setError(message);
      setStatus("error");
    }
  }, [volume]);

  // Auto-connect when the visitor has already authorized.
  useEffect(() => {
    if (readToken() && getClientId()) void connect();
    return () => {
      playerRef.current?.disconnect();
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The SDK only pushes state on change, so tick the position between events.
  useEffect(() => {
    if (!state || state.paused) return;
    const id = setInterval(() => setPosition((p) => p + 250), 250);
    return () => clearInterval(id);
  }, [state]);

  /** Moves playback from whatever device is active onto this browser. */
  const transferHere = useCallback(async () => {
    const id = deviceIdRef.current;
    const token = await getFreshAccessToken();
    if (!id || !token) return;
    setError(null);
    const res = await fetch("https://api.spotify.com/v1/me/player", {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ device_ids: [id], play: true }),
    });
    if (!res.ok && res.status !== 204) {
      setError(
        res.status === 404
          ? "Nothing is queued. Start a track in Spotify once, then transfer."
          : `Transfer failed (${res.status}).`
      );
    }
  }, []);

  const disconnect = useCallback(() => {
    playerRef.current?.disconnect();
    playerRef.current = null;
    deviceIdRef.current = null;
    clearToken();
    setState(null);
    setStatus("disconnected");
  }, []);

  const onVolume = useCallback((v: number) => {
    setVolume(v);
    void playerRef.current?.setVolume(v);
  }, []);

  const onSeek = useCallback((ms: number) => {
    setPosition(ms);
    void playerRef.current?.seek(ms);
  }, []);

  if (status === "unconfigured") {
    return (
      <Shell>
        <p className="text-[#8A8A82] leading-relaxed max-w-[560px]">
          Set <Code>NEXT_PUBLIC_SPOTIFY_CLIENT_ID</Code> to your Spotify app&apos;s client
          id, then add this redirect URI in the Spotify developer dashboard:
        </p>
        <Code block>{typeof window === "undefined" ? "/callback" : getRedirectUri()}</Code>
        <p className="text-[#5A5A55] leading-relaxed max-w-[560px]">
          The client id is public by design — PKCE never sends the client secret to the
          browser, so this is safe to expose.
        </p>
      </Shell>
    );
  }

  if (status === "disconnected" || (status === "error" && !playerRef.current)) {
    return (
      <Shell>
        {error && <p className="text-[#FF6B6B]">{error}</p>}
        <p className="text-[#8A8A82] leading-relaxed max-w-[520px]">
          Connect your own Spotify account to play here. Requires Premium — the Web
          Playback SDK will not start on a free account.
        </p>
        <button
          type="button"
          onClick={() => void beginLogin()}
          className="border border-music-accent text-music-accent px-3 py-1 bg-transparent cursor-pointer hover:bg-music-accent/10"
        >
          [ CONNECT SPOTIFY ]
        </button>
      </Shell>
    );
  }

  if (status === "connecting") {
    return (
      <Shell>
        <p className="text-[#5A5A55]">[ STARTING PLAYER... ]</p>
      </Shell>
    );
  }

  const duration = state?.duration ?? track?.duration_ms ?? 0;
  const art = track?.album.images?.[0]?.url;

  return (
    <section
      aria-label="Spotify player"
      className="h-full min-h-[420px] md:min-h-0 flex flex-col border border-[#1C1C1A] bg-[#080808] p-4 sm:p-6 select-none"
    >
      <div className="flex items-center justify-between mb-5">
        <span className="font-mono text-[11px] tracking-[0.14em] text-[#5A5A55]">
          {DEVICE_NAME.toUpperCase()} · {status === "ready" ? "DEVICE READY" : "…"}
        </span>
        <button
          type="button"
          onClick={disconnect}
          className="font-mono text-[10px] tracking-[0.14em] px-2 py-0.5 border border-[#1C1C1A] text-[#5A5A55] hover:text-[#EDEDE8] hover:border-[#5A5A55] bg-transparent cursor-pointer"
        >
          [ DISCONNECT ]
        </button>
      </div>

      {error && (
        <p className="font-mono text-[11px] tracking-[0.1em] text-[#FF6B6B] mb-4">{error}</p>
      )}

      {!track ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 font-mono text-[12px] tracking-[0.12em] text-center">
          <p className="text-[#8A8A82] max-w-[480px] leading-relaxed">
            This browser is now a Spotify device. Pick it from the devices menu in any
            Spotify app, or move whatever is already playing onto it.
          </p>
          <button
            type="button"
            onClick={() => void transferHere()}
            className="border border-music-accent text-music-accent px-3 py-1 bg-transparent cursor-pointer hover:bg-music-accent/10"
          >
            [ TRANSFER PLAYBACK HERE ]
          </button>
        </div>
      ) : (
        <div className="flex-1 flex flex-col sm:flex-row gap-6 min-h-0">
          {art && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={art}
              alt=""
              className="w-full sm:w-[240px] md:w-[300px] aspect-square object-cover border border-[#1C1C1A] self-start"
            />
          )}
          <div className="flex-1 flex flex-col justify-center gap-4 min-w-0">
            <div className="min-w-0">
              <div className="font-mono text-[20px] sm:text-[24px] text-[#EDEDE8] truncate">
                {track.name}
              </div>
              <div className="font-mono text-[12px] tracking-[0.1em] text-[#8A8A82] truncate mt-1">
                {track.artists.map((a) => a.name).join(", ")}
              </div>
              <div className="font-mono text-[11px] tracking-[0.1em] text-[#5A5A55] truncate mt-0.5">
                {track.album.name}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="font-mono text-[11px] text-[#5A5A55] tabular-nums w-[38px]">
                {msToClock(position)}
              </span>
              <input
                type="range"
                min={0}
                max={Math.max(1, duration)}
                value={Math.min(position, duration)}
                onChange={(e) => onSeek(Number(e.target.value))}
                aria-label="Seek"
                className="flex-1 accent-[var(--music-accent)] cursor-pointer"
              />
              <span className="font-mono text-[11px] text-[#5A5A55] tabular-nums w-[38px] text-right">
                {msToClock(duration)}
              </span>
            </div>

            <div className="flex items-center gap-2 font-mono text-[11px] tracking-[0.12em]">
              <Transport onClick={() => void playerRef.current?.previousTrack()} label="[ PREV ]" />
              <Transport
                onClick={() => void playerRef.current?.togglePlay()}
                label={state?.paused ? "[ PLAY ]" : "[ PAUSE ]"}
                primary
              />
              <Transport onClick={() => void playerRef.current?.nextTrack()} label="[ NEXT ]" />
              <label className="ml-auto flex items-center gap-2 text-[#5A5A55]">
                VOL
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={volume}
                  onChange={(e) => onVolume(Number(e.target.value))}
                  aria-label="Volume"
                  className="w-[90px] accent-[var(--music-accent)] cursor-pointer"
                />
              </label>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

const Transport: React.FC<{ onClick: () => void; label: string; primary?: boolean }> = ({
  onClick,
  label,
  primary,
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-2.5 py-1 border bg-transparent cursor-pointer transition-colors ${
      primary
        ? "border-music-accent text-music-accent hover:bg-music-accent/10"
        : "border-[#1C1C1A] text-[#5A5A55] hover:text-[#EDEDE8] hover:border-[#5A5A55]"
    }`}
  >
    {label}
  </button>
);

const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <section
    aria-label="Spotify player"
    className="h-full min-h-[420px] md:min-h-0 flex flex-col items-center justify-center gap-4 border border-[#1C1C1A] bg-[#080808] p-6 text-center font-mono text-[12px] tracking-[0.12em] select-none"
  >
    {children}
  </section>
);

const Code: React.FC<{ children: React.ReactNode; block?: boolean }> = ({ children, block }) => (
  <code
    className={`font-mono text-[11px] text-music-accent bg-[#111110] border border-[#1C1C1A] px-2 py-1 ${
      block ? "block max-w-full overflow-x-auto" : "inline"
    }`}
  >
    {children}
  </code>
);
