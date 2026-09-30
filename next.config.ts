import type { NextConfig } from "next";

/** Placeholder values some setups leave in env files; never publish those. */
function realValue(value: string | undefined): string | undefined {
  const v = value?.trim();
  if (!v || /^(todo|placeholder)/i.test(v)) return undefined;
  return v;
}

const nextConfig: NextConfig = {
  /* config options here */
  devIndicators: false,

  // Spotify no longer accepts "localhost" in redirect URIs, only the loopback
  // address, so local sign-in has to run on http://127.0.0.1:3000. Next's dev
  // server blocks its own scripts for any host but localhost unless allowed
  // here, which leaves the page rendered but inert. Development only.
  allowedDevOrigins: ["127.0.0.1"],

  // The in-browser player needs a client id. If the owner already set one
  // for the server (SPOTIFY_CLIENT_ID), reuse it rather than asking them to
  // paste it again. Client ids are public by design: PKCE never uses the
  // secret, which stays server-side and is not exposed here.
  env: {
    NEXT_PUBLIC_SPOTIFY_CLIENT_ID:
      realValue(process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID) ??
      realValue(process.env.SPOTIFY_CLIENT_ID) ??
      "",
  },
};

export default nextConfig;
