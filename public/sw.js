/* Service Worker for MyShop (Next.js) - v2 */
const VERSION = "v2";
const STATIC_CACHE = `static-${VERSION}`;
const IMAGE_CACHE = `images-${VERSION}`;
const DATA_CACHE = `data-${VERSION}`;
const PAGE_CACHE = `pages-${VERSION}`;

const PRECACHE = ["/", "/offline.html", "/icons/icon-192.png", "/icons/icon-512.png"];

// Public catalog data that may be read offline
const DATA_URLS = /^\/api\/(products|categories|search)(\/|$)/;

// Private or must-be-live routes (anchored so "/cartoon-mug" does NOT match "/cart")
const NEVER_CACHE = new RegExp(
  "^/(cart|checkout|login|logout|register|account|profile|orders|payment|wishlist|dashboard)(/|$)" +
    "|^/api/(auth|orders|cart|payment|wishlist|users|admin)(/|$)"
);

// Next.js adds a Vary header, so ignore it when looking up saved pages
const LOOKUP = { ignoreVary: true };

const MAX_IMAGES = 150;
const MAX_PAGES = 40;

// No skipWaiting() here: a new version waits until the user accepts the update prompt.
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE)));
});

self.addEventListener("activate", (event) => {
  const keep = [STATIC_CACHE, IMAGE_CACHE, DATA_CACHE, PAGE_CACHE];
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !keep.includes(k)).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

async function trimCache(name, max) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  if (keys.length > max) {
    await cache.delete(keys[0]);
    return trimCache(name, max);
  }
}

async function cacheFirst(request, cacheName, maxItems) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && (response.ok || response.type === "opaque")) {
    const cache = await caches.open(cacheName);
    cache.put(request, response.clone());
    if (maxItems) trimCache(cacheName, maxItems);
  }
  return response;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request, LOOKUP);
  const network = fetch(request)
    .then((response) => {
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);
  return (
    cached ||
    (await network) ||
    new Response(JSON.stringify({ offline: true, message: "You are offline and this data is not saved yet." }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    })
  );
}

async function networkFirstPage(request) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(PAGE_CACHE);
      cache.put(request, response.clone());
      trimCache(PAGE_CACHE, MAX_PAGES);
    }
    return response;
  } catch (err) {
    return (await caches.match(request, LOOKUP)) || (await caches.match("/offline.html"));
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET") return;

  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin && request.destination !== "image") return;

  if (sameOrigin && NEVER_CACHE.test(url.pathname)) return;

  // Admin views of products must always be fresh
  if (url.searchParams.has("includeInactive")) return;

  if (sameOrigin && url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  if (sameOrigin && request.headers.get("RSC")) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(PAGE_CACHE).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(async () => (await caches.match(request, LOOKUP)) || Response.error())
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(request));
    return;
  }

  if (sameOrigin && DATA_URLS.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request, DATA_CACHE));
    return;
  }

  if (request.destination === "image") {
    event.respondWith(
      cacheFirst(request, IMAGE_CACHE, MAX_IMAGES).catch(() => caches.match("/icons/icon-192.png"))
    );
    return;
  }

  if (sameOrigin && ["style", "script", "font"].includes(request.destination)) {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
  }
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
  if (event.data === "CLEAR_CACHES") {
    event.waitUntil(caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))));
  }
});
