// Lets the app open with no signal. Scripts and fonts are kept forever (their names change on every release);
// the three working pages are re-fetched whenever there is signal and the last good copy is used when there is not.
// ponytail: old releases' scripts are never evicted (a few MB per release); bump V to start clean.
const V = "v1";
const PAGES = ["/", "/checkout", "/returns"]; // keep in sync with PAGES in src/components/sync-bar.tsx

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) =>
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => clients.claim()))
);

self.addEventListener("fetch", (e) => {
  const r = e.request;
  const u = new URL(r.url);
  if (r.method !== "GET" || u.origin !== location.origin) return;

  if (u.pathname.startsWith("/_next/static/") || u.pathname.startsWith("/icons/") || u.pathname.endsWith(".wasm")) {
    e.respondWith(
      caches.open(V).then(async (c) => (await c.match(r)) || fetch(r).then((res) => (res.ok && c.put(r, res.clone()), res)))
    );
    return;
  }

  // Page loads only (not the app's own background data requests, which carry an RSC header).
  const isPage = (r.headers.get("accept") || "").includes("text/html") && !r.headers.get("rsc");
  if (isPage && PAGES.includes(u.pathname)) {
    e.respondWith(
      fetch(r)
        .then((res) => {
          // copy before the page starts reading it; a redirect means signed out, so do not keep the login page as "/checkout"
          if (res.ok && !res.redirected) {
            const copy = res.clone();
            caches.open(V).then((c) => c.put(u.pathname, copy));
          }
          return res;
        })
        .catch(() => caches.match(u.pathname).then((hit) => hit || Response.error()))
    );
  }
});
