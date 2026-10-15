import { test } from "node:test";
import assert from "node:assert/strict";
import nextConfig from "../next.config";
import { hasRemoteMatch } from "next/dist/shared/lib/match-remote-pattern";

test("next.config.ts remotePatterns includes mzstatic.com hostnames", () => {
  const remotePatterns = nextConfig.images?.remotePatterns || [];
  const domains = nextConfig.images?.domains || [];

  const appleMusicUrl1 = new URL(
    "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/dd/50/c7/dd50c790-99ac-d3d0-5ab8-e3891fb8fd52/634904032463.png/600x600bb.jpg"
  );
  const appleMusicUrl2 = new URL(
    "https://is2-ssl.mzstatic.com/image/thumb/Music124/v4/4d/13/ba/4d13bac3-d3d5-7581-2c74-034219eadf2b/081227970949.jpg/600x600bb.jpg"
  );

  assert.ok(
    hasRemoteMatch(domains, remotePatterns, appleMusicUrl1),
    "Remote patterns must allow is1-ssl.mzstatic.com"
  );
  assert.ok(
    hasRemoteMatch(domains, remotePatterns, appleMusicUrl2),
    "Remote patterns must allow wildcard *.mzstatic.com"
  );
});

test("next.config.ts remotePatterns includes Spotify CDNs (scdn.co, spotifycdn.com)", () => {
  const remotePatterns = nextConfig.images?.remotePatterns || [];
  const domains = nextConfig.images?.domains || [];

  const spotifyTrackUrl = new URL(
    "https://i.scdn.co/image/ab67616d0000b273b7541a5d61483017a523d0c9"
  );
  const spotifyMosaicUrl = new URL(
    "https://mosaic.scdn.co/640/ab67616d0000b273b7541a5d61483017a523d0c9"
  );
  const spotifyCdnUrl = new URL(
    "https://image-cdn-ak.spotifycdn.com/image/ab67706c0000bebb81f72782977464303496bc75"
  );

  assert.ok(
    hasRemoteMatch(domains, remotePatterns, spotifyTrackUrl),
    "Remote patterns must allow i.scdn.co"
  );
  assert.ok(
    hasRemoteMatch(domains, remotePatterns, spotifyMosaicUrl),
    "Remote patterns must allow *.scdn.co"
  );
  assert.ok(
    hasRemoteMatch(domains, remotePatterns, spotifyCdnUrl),
    "Remote patterns must allow *.spotifycdn.com"
  );
});
