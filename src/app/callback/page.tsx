"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AUTH_MESSAGE, completeLogin, consumeReturnPath } from "@/lib/spotify-auth";

function CallbackInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Opened as a popup by the player tab, rather than as a full-page redirect.
    const opener = window.opener as Window | null;
    const isPopup = Boolean(opener && opener !== window);

    const report = (ok: boolean) => {
      if (!isPopup) return false;
      try {
        opener!.postMessage({ type: AUTH_MESSAGE, ok }, window.location.origin);
      } catch {}
      window.close();
      return true;
    };

    const denied = params.get("error");
    if (denied) {
      // `error` arrives in the URL, so anyone can put any text in it. Show
      // fixed wording only, never the parameter itself.
      const message =
        denied === "access_denied" ? "Authorization was declined." : "Sign-in failed.";
      if (!report(false)) setError(message);
      return;
    }
    const code = params.get("code");
    if (!code) {
      if (!report(false)) setError("No authorization code in the callback URL.");
      return;
    }
    let cancelled = false;
    completeLogin(code)
      .then(() => {
        if (cancelled) return;
        // Tokens are in localStorage, which the opener shares, so it only
        // needs to be told to look again.
        if (!report(true)) router.replace(consumeReturnPath());
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        if (!report(false)) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [params, router]);

  return (
    <main className="min-h-[100dvh] bg-[#080808] text-[#EDEDE8] flex items-center justify-center px-6">
      <div className="font-mono text-[12px] tracking-[0.14em] text-center">
        {error ? (
          <>
            <div className="text-[#FF6B6B] mb-3">[ SPOTIFY AUTH FAILED ]</div>
            <div className="text-[#8A8A82] mb-5 max-w-[420px] leading-relaxed">{error}</div>
            <button
              type="button"
              onClick={() => router.replace("/")}
              className="border border-[#1C1C1A] px-3 py-1 text-[#5A5A55] hover:text-[#EDEDE8] hover:border-[#5A5A55] bg-transparent cursor-pointer"
            >
              [ BACK TO DASHBOARD ]
            </button>
          </>
        ) : (
          <div className="text-[#5A5A55]">[ CONNECTING SPOTIFY... ]</div>
        )}
      </div>
    </main>
  );
}

export default function SpotifyCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-[100dvh] bg-[#080808] text-[#5A5A55] flex items-center justify-center font-mono text-[12px] tracking-[0.14em]">
          [ CONNECTING SPOTIFY... ]
        </main>
      }
    >
      <CallbackInner />
    </Suspense>
  );
}
