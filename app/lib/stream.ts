import type { StreamStatusValue } from "./types";

/**
 * Reliable liveness probe via the server-side proxy. A client-side no-cors
 * fetch returns an opaque response that always "succeeds", so it can't tell a
 * live stream from a 403/404/dead host — the proxy reads the real HTTP status.
 */
export async function checkStreamStatus(url: string): Promise<StreamStatusValue> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 11000);
    const res = await fetch(`/api/proxy?check=1&url=${encodeURIComponent(url)}`, {
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) return "offline";
    const data = await res.json();
    return data.ok ? "online" : "offline";
  } catch {
    return "offline";
  }
}

/** Two-letter ISO country code → flag emoji (falls back to globe). */
export function flagEmoji(code: string): string {
  if (!code || code.length !== 2) return "🌐";
  return String.fromCodePoint(
    ...[...code.toUpperCase()].map((c) => 0x1f1e0 - 65 + c.charCodeAt(0))
  );
}
