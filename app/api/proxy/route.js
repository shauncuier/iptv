/**
 * /api/proxy?url=<encoded-url>
 *
 * Universal server-side proxy: handles both text (M3U playlists, HLS keys)
 * and binary (images) responses, bypassing CORS / CORP / 403 blocks.
 */

// Image content-types we forward as binary (not text)
const IMAGE_TYPES = new Set([
  "image/png", "image/jpeg", "image/jpg", "image/gif",
  "image/webp", "image/svg+xml", "image/x-icon", "image/vnd.microsoft.icon",
  "image/avif", "image/bmp",
]);

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get("url");

  if (!targetUrl) {
    return new Response(JSON.stringify({ error: "Missing 'url' query parameter" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  let cleanUrl = targetUrl.trim();
  try {
    const urlObj = new URL(cleanUrl);
    if (urlObj.hostname === "github.com" && urlObj.pathname.includes("/blob/")) {
      urlObj.hostname = "raw.githubusercontent.com";
      urlObj.pathname = urlObj.pathname.replace("/blob/", "/");
      cleanUrl = urlObj.toString();
    }
  } catch {}

  let parsed;
  try {
    parsed = new URL(cleanUrl);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid URL" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return new Response(JSON.stringify({ error: "Only http/https URLs are allowed" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const reqHeaders = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    Accept: "image/*,text/plain,application/x-mpegurl,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    Referer: `${parsed.protocol}//${parsed.host}/`,
  };

  // Lightweight liveness check: returns { ok, status } without downloading the
  // stream body. Used by the "Show Only Active" filter to detect dead/geo-blocked
  // channels reliably (no-cors client fetches can't read the real HTTP status).
  if (searchParams.get("check")) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const probe = await fetch(cleanUrl, {
        method: "GET",
        signal: controller.signal,
        headers: { ...reqHeaders, Range: "bytes=0-1" },
        redirect: "follow",
      });
      clearTimeout(timeoutId);
      // Discard the body — we only need the status line.
      try { probe.body?.cancel(); } catch {}
      const ok = probe.ok || probe.status === 206;
      return new Response(JSON.stringify({ ok, status: probe.status }), {
        status: 200,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      });
    } catch (err) {
      return new Response(
        JSON.stringify({ ok: false, status: 0, error: err.name === "AbortError" ? "timeout" : err.message }),
        { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }
      );
    }
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const upstream = await fetch(cleanUrl, {
      signal: controller.signal,
      headers: reqHeaders,
      redirect: "follow",
    });

    clearTimeout(timeoutId);

    if (!upstream.ok) {
      return new Response(
        JSON.stringify({ error: `Upstream ${upstream.status}: ${upstream.statusText}` }),
        { status: upstream.status, headers: { "Content-Type": "application/json" } }
      );
    }

    // Detect content type from upstream
    const upstreamContentType = upstream.headers.get("content-type") || "text/plain";
    const baseType = upstreamContentType.split(";")[0].trim().toLowerCase();
    const isImage = IMAGE_TYPES.has(baseType);

    // Common response headers — strip CORP/CSP that would block the browser
    const responseHeaders = {
      "Content-Type": upstreamContentType,
      "Access-Control-Allow-Origin": "*",
      "Cross-Origin-Resource-Policy": "cross-origin",
      "Cross-Origin-Embedder-Policy": "unsafe-none",
      // Images cached 1 hour; text (playlists/keys) cached 5 min
      "Cache-Control": isImage
        ? "public, max-age=3600, stale-while-revalidate=300"
        : "public, max-age=300, stale-while-revalidate=60",
    };

    if (isImage) {
      // Stream binary body directly — do NOT call .text() on binary data
      const buffer = await upstream.arrayBuffer();
      return new Response(buffer, { status: 200, headers: responseHeaders });
    } else {
      const text = await upstream.text();
      return new Response(text, { status: 200, headers: responseHeaders });
    }
  } catch (err) {
    const isTimeout = err.name === "AbortError";
    return new Response(
      JSON.stringify({ error: isTimeout ? "Request timed out" : err.message }),
      {
        status: isTimeout ? 504 : 502,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
