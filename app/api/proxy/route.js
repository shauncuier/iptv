/**
 * /api/proxy?url=<encoded-url>
 *
 * Universal server-side proxy: handles both text (M3U playlists, HLS keys)
 * and binary (images) responses, bypassing CORS / CORP / 403 blocks.
 */

// HLS streaming tags. Their presence marks a real HLS playlist (master or
// media) — as opposed to an IPTV channel-list .m3u, which we must NOT rewrite.
const HLS_TAG_RE = /#EXT-X-(STREAM-INF|TARGETDURATION|MEDIA|KEY|MAP|PART|I-FRAME-STREAM-INF)/;

// Content-types / extensions that may carry a text playlist worth inspecting.
const PLAYLIST_TYPES = new Set([
  "application/vnd.apple.mpegurl", "application/x-mpegurl",
  "audio/mpegurl", "audio/x-mpegurl", "application/mpegurl",
]);

/**
 * Rewrite every URL inside an HLS playlist so child requests (variant
 * playlists, segments, AES keys, init maps) flow back through THIS proxy.
 * Without this the browser fetches segments cross-origin and CORS blocks them.
 * Relative URLs resolve against `baseUrl` (the real upstream URL, post-redirect).
 */
function rewriteHlsPlaylist(text, baseUrl) {
  const proxify = (u) => {
    try {
      const abs = new URL(u.trim(), baseUrl).toString();
      return `/api/proxy?url=${encodeURIComponent(abs)}`;
    } catch {
      return u;
    }
  };
  return text.split(/\r?\n/).map((line) => {
    const t = line.trim();
    if (!t) return line;
    if (t.startsWith("#")) {
      // Rewrite URI="..." attributes (EXT-X-KEY, EXT-X-MAP, EXT-X-MEDIA, etc.)
      return t.includes("URI=")
        ? line.replace(/URI="([^"]*)"/g, (_, u) => `URI="${proxify(u)}"`)
        : line;
    }
    // Bare resource line: a segment or a child playlist URL.
    return proxify(t);
  }).join("\n");
}

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
    const upstreamContentType = upstream.headers.get("content-type") || "";
    const baseType = upstreamContentType.split(";")[0].trim().toLowerCase();
    const path = parsed.pathname.toLowerCase();

    // A textual playlist is worth inspecting if its type OR extension says so.
    const maybePlaylist =
      PLAYLIST_TYPES.has(baseType) ||
      baseType === "text/plain" || baseType === "" ||
      path.endsWith(".m3u8") || path.endsWith(".m3u");

    // Common response headers — strip CORP/CSP that would block the browser.
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Cross-Origin-Resource-Policy": "cross-origin",
      "Cross-Origin-Embedder-Policy": "unsafe-none",
    };

    if (maybePlaylist) {
      const text = await upstream.text();
      const baseUrl = upstream.url || cleanUrl; // resolve relatives post-redirect
      if (HLS_TAG_RE.test(text)) {
        // Real HLS playlist → rewrite all child URLs through this proxy.
        const rewritten = rewriteHlsPlaylist(text, baseUrl);
        return new Response(rewritten, {
          status: 200,
          headers: {
            ...cors,
            "Content-Type": "application/vnd.apple.mpegurl",
            "Cache-Control": "no-store", // live manifests must not be cached
          },
        });
      }
      // Plain text or an IPTV channel-list .m3u — pass through untouched.
      return new Response(text, {
        status: 200,
        headers: {
          ...cors,
          "Content-Type": upstreamContentType || "text/plain; charset=utf-8",
          "Cache-Control": "public, max-age=300, stale-while-revalidate=60",
        },
      });
    }

    // Binary (segments, keys, images, mp4, …) — stream straight through; never
    // buffer/.text() binary data. Passthrough avoids holding segments in memory.
    const isImage = baseType.startsWith("image/");
    return new Response(upstream.body, {
      status: 200,
      headers: {
        ...cors,
        "Content-Type": upstreamContentType || "application/octet-stream",
        "Cache-Control": isImage
          ? "public, max-age=3600, stale-while-revalidate=300"
          : "public, max-age=30",
      },
    });
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
