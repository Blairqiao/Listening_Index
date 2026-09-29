"use client";

import React, { useCallback, useEffect, useState } from "react";

interface Status {
  connected: boolean;
  source: "environment" | "menu" | null;
  displayName: string | null;
  canConnect: boolean;
  redirectUri: string;
}

interface OwnerSpotifyConnectProps {
  /** Connecting needs a saved client id; a typed-but-unsaved one isn't enough. */
  hasSavedClientId: boolean;
}

/**
 * Connects the owner's Spotify from the settings menu: the no-terminal
 * alternative to SPOTIFY_REFRESH_TOKEN. Rendered only for a signed-in admin,
 * and every route behind it re-checks that on the server.
 */
export const OwnerSpotifyConnect: React.FC<OwnerSpotifyConnectProps> = ({ hasSavedClientId }) => {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/owner/spotify", { cache: "no-store" });
      if (res.ok) setStatus((await res.json()) as Status);
    } catch {}
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const connect = useCallback(() => {
    setNote(null);
    const w = 480;
    const h = 720;
    const left = window.screenX + Math.max(0, (window.outerWidth - w) / 2);
    const top = window.screenY + Math.max(0, (window.outerHeight - h) / 2);
    const popup = window.open(
      "/api/owner/spotify/login",
      "owner-spotify",
      `width=${w},height=${h},left=${Math.round(left)},top=${Math.round(top)}`
    );
    if (!popup) {
      setNote("Your browser blocked the popup. Allow popups for this site and try again.");
      return;
    }
    setBusy(true);

    let done = false;
    const finish = (message: string | null) => {
      if (done) return;
      done = true;
      window.removeEventListener("message", onMessage);
      clearInterval(poll);
      setBusy(false);
      setNote(message);
      void refresh();
    };
    const onMessage = (e: MessageEvent) => {
      // Only this origin, and only this flow's message type — the player
      // tab's guest sign-in posts a different one.
      if (e.origin !== window.location.origin) return;
      if (e.data?.type !== "spotify-owner-auth") return;
      finish(e.data.ok ? null : e.data.message || "Connecting failed.");
    };
    window.addEventListener("message", onMessage);
    const poll = setInterval(() => {
      if (popup.closed) finish(null);
    }, 500);
  }, [refresh]);

  const disconnect = useCallback(async () => {
    setBusy(true);
    setNote(null);
    try {
      await fetch("/api/owner/spotify", { method: "DELETE" });
    } finally {
      setBusy(false);
      void refresh();
    }
  }, [refresh]);

  const label = "block font-mono text-[10px] tracking-[0.1em] text-[#6A6A64] uppercase";
  const hint = "font-mono text-[10px] leading-relaxed text-[#6A6A64]";

  return (
    <div className="space-y-1 mt-4">
      <label className={label}>YOUR SPOTIFY ACCOUNT</label>

      <div className="flex items-center justify-between gap-3 bg-[#141413] border border-[#26261F] px-2.5 py-2">
        <span className="font-mono text-[12px] text-[#EDEDE8] truncate">
          {!status
            ? "Checking…"
            : status.connected
            ? status.source === "environment"
              ? "Connected via environment variables"
              : `Connected${status.displayName ? ` as ${status.displayName}` : ""}`
            : "Not connected"}
        </span>

        {status?.source === "menu" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void disconnect()}
            className="shrink-0 font-mono text-[10px] tracking-[0.12em] px-2 py-0.5 border border-[#26261F] text-[#6A6A64] hover:text-[#EDEDE8] hover:border-[#3A3A32] bg-transparent cursor-pointer disabled:cursor-wait"
          >
            [ DISCONNECT ]
          </button>
        ) : status && status.source !== "environment" ? (
          <button
            type="button"
            disabled={busy || !status.canConnect || !hasSavedClientId}
            onClick={connect}
            className="shrink-0 font-mono text-[10px] tracking-[0.12em] px-2 py-0.5 border border-music-accent text-music-accent bg-transparent cursor-pointer hover:bg-music-accent/10 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy ? "[ WAITING… ]" : "[ CONNECT MY SPOTIFY ]"}
          </button>
        ) : null}
      </div>

      {note && <p className="font-mono text-[10px] text-[#FF6B6B]">{note}</p>}

      {status && !status.connected && !status.canConnect && (
        <p className={hint}>
          Needs a database and TOKEN_ENCRYPTION_KEY on the server, so the token can be
          stored encrypted.
        </p>
      )}
      {status && !status.connected && status.canConnect && !hasSavedClientId && (
        <p className={hint}>Save your client id above first, then connect.</p>
      )}
      {status && status.source !== "environment" && (
        <>
          <p className={hint}>
            Shows what you&apos;re playing and syncs your history. Read-only access. Add
            this redirect URI in your Spotify app too:
          </p>
          <code className="block font-mono text-[10px] text-music-accent bg-[#141413] border border-[#26261F] px-2.5 py-1.5 overflow-x-auto">
            {status.redirectUri}
          </code>
        </>
      )}
    </div>
  );
};
