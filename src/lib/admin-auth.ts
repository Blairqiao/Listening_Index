import crypto from "node:crypto";

export const ADMIN_COOKIE_NAME = "admin_session";
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

export function isAdminPasswordConfigured(): boolean {
  const pass = process.env.ADMIN_PASSWORD;
  if (!pass) return false;
  const trimmed = pass.trim();
  return trimmed !== "" && trimmed !== "todo" && trimmed !== "placeholder";
}

export function verifyAdminPassword(candidate: string): boolean {
  if (!isAdminPasswordConfigured() || !candidate) return false;
  const secret = process.env.ADMIN_PASSWORD!;

  // Hash both to fixed length to prevent timing attacks based on length difference
  const hashCandidate = crypto.createHash("sha256").update(candidate).digest();
  const hashSecret = crypto.createHash("sha256").update(secret).digest();

  return crypto.timingSafeEqual(hashCandidate, hashSecret);
}

function getSigningKey(): string {
  return process.env.ADMIN_PASSWORD || process.env.CRON_SECRET || "fallback-insecure-key";
}

export function createSessionToken(): string {
  const key = getSigningKey();
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + SESSION_TTL_SECONDS;
  const payload = `${now}.${expiresAt}`;
  const signature = crypto.createHmac("sha256", key).update(payload).digest("hex");
  return `${payload}.${signature}`;
}

export function verifySessionToken(token?: string | null): boolean {
  if (!token || typeof token !== "string" || !isAdminPasswordConfigured()) {
    return false;
  }

  const parts = token.split(".");
  if (parts.length !== 3) return false;

  const [issuedAtStr, expiresAtStr, signature] = parts;
  const expiresAt = parseInt(expiresAtStr, 10);
  if (isNaN(expiresAt)) return false;

  const now = Math.floor(Date.now() / 1000);
  if (now > expiresAt) return false;

  const key = getSigningKey();
  const payload = `${issuedAtStr}.${expiresAtStr}`;
  const expectedSig = crypto.createHmac("sha256", key).update(payload).digest("hex");

  const sigBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expectedSig, "hex");

  if (sigBuffer.length !== expectedBuffer.length) return false;
  return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
}

export function getSessionCookieHeader(token: string): string {
  const isProd = process.env.NODE_ENV === "production";
  const secure = isProd ? "; Secure" : "";
  return `${ADMIN_COOKIE_NAME}=${token}; Path=/; Max-Age=${SESSION_TTL_SECONDS}; HttpOnly; SameSite=Lax${secure}`;
}

export function getClearSessionCookieHeader(): string {
  const isProd = process.env.NODE_ENV === "production";
  const secure = isProd ? "; Secure" : "";
  return `${ADMIN_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure}`;
}
