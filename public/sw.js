/* 3S-IPTV service worker — app-shell cache only. Never touches streams. */
const CACHE = "3s-iptv-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((c) => c.add("/")).catch(() => {}));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // Never intercept cross-origin (stream CDNs) or the proxy/API (live media).
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // Page navigations: network-first, fall back to cached shell when offline.
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match("/")));
    return;
  }

  // Hashed build assets: cache-first (immutable).
  if (url.pathname.startsWith("/_next/static")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
            return res;
          })
      )
    );
  }
});
