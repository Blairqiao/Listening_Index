/**
 * The page an OAuth popup lands on when Spotify sends it back.
 *
 * Shared by every sign-in flow in the app, because it is security-sensitive:
 * it renders HTML by hand in a route handler, outside React's escaping, and
 * an earlier version reflected the `error` query parameter into its inline
 * script. Keeping one hardened copy means a fix cannot land in one flow and
 * be missed in another.
 */

import crypto from "node:crypto";
import { NextResponse } from "next/server";

/**
 * `error` arrives in the query string, so anyone can put anything in it.
 * Only ever map it to fixed text — never echo it back.
 */
export function describeOAuthError(error: string): string {
  return error === "access_denied" ? "Authorization was declined." : "Sign-in failed.";
}

/**
 * JSON.stringify leaves `<` and `/` alone, so a string containing `</script>`
 * would end the inline script and let the rest parse as HTML. Escaping these
 * characters keeps the value inert inside a <script> element.
 */
function scriptSafeJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

/**
 * Posting to the opener rather than redirecting keeps the dashboard loaded
 * behind the popup. The origin is pinned so no other page can read the result.
 */
export function closePopup(
  origin: string,
  ok: boolean,
  message: string | null,
  messageType: string
): NextResponse {
  const payload = scriptSafeJson({ type: messageType, ok, message });
  // const target = scriptSafeJson(origin);
  // Only the script carrying this nonce may run, so even if markup were ever
  // injected into this page it could not execute.
  const nonce = crypto.randomBytes(16).toString("base64");
  const html = `<!doctype html><meta charset="utf-8"><title>Spotify</title>
<body style="background:#080808;color:#5A5A55;font:12px ui-monospace,monospace;display:grid;place-items:center;height:100vh;margin:0">
<p>${ok ? "Connected. You can close this window." : escapeHtml(message || "Sign-in failed.")}</p>
<script nonce="${nonce}">
  try { if (window.opener) window.opener.postMessage(${payload}, "*"); } catch (e) {}
  if (window.opener) window.close(); else location.replace("/");
</script>`;
  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
    },
  });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!
  );
}
