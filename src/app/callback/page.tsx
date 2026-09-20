"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { completeLogin, consumeReturnPath } from "@/lib/spotify-auth";

function CallbackInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const denied = params.get("error");
    if (denied) {
      setError(denied === "access_denied" ? "Authorization was declined." : denied);
      return;
    }
    const code = params.get("code");
    if (!code) {
      setError("No authorization code in the callback URL.");
      return;
    }
    let cancelled = false;
    completeLogin(code)
      .then(() => {
        if (!cancelled) router.replace(consumeReturnPath());
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
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
