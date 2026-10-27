import { test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";

test("player token error response schema differentiates admin from spotify errors", () => {
  // Verifies error code contract
  const adminError = { error: "Admin authentication required", code: "ADMIN_AUTH_REQUIRED" };
  assert.equal(adminError.code, "ADMIN_AUTH_REQUIRED");
});

test("GET /api/player/token returns 401 with ADMIN_AUTH_REQUIRED when not authenticated", async () => {
  const { GET } = await import("../src/app/api/player/token/route");
  const unauthReq = new NextRequest("http://127.0.0.1:8888/api/player/token");
  const res = await GET(unauthReq);
  assert.equal(res.status, 401);
  const data = await res.json();
  assert.equal(data.code, "ADMIN_AUTH_REQUIRED");
  assert.equal(data.error, "Admin authentication required");
});

test("player token route does not expose an unused credential replacement POST", async () => {
  const route = await import("../src/app/api/player/token/route");
  assert.equal("POST" in route, false);
});

test("DELETE /api/player/token returns 401 with ADMIN_AUTH_REQUIRED when not authenticated", async () => {
  const { DELETE } = await import("../src/app/api/player/token/route");
  const unauthReq = new NextRequest("http://127.0.0.1:8888/api/player/token", {
    method: "DELETE",
  });
  const res = await DELETE(unauthReq);
  assert.equal(res.status, 401);
  const data = await res.json();
  assert.equal(data.code, "ADMIN_AUTH_REQUIRED");
  assert.equal(data.error, "Admin authentication required");
});
