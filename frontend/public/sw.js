/**
 * SmartERP service worker — plan §31.1 Sprint 19 / S19.1.
 *
 * v1 strategy:
 *   - precache: the app-shell HTML + the manifest + the icons.
 *   - runtime: stale-while-revalidate for /api/* GET responses, with a
 *     cache cap so the offline cache cannot grow without bound.
 *   - mutations: never cached; if the network is offline, the request
 *     is queued for a future Background Sync (placeholder; production
 *     wiring lands in Sprint 24).
 *
 * The service worker is intentionally dependency-free — Workbox is
 * over-kill for the v1 surface. Cache versions bump per release tag so
 * stale shells are evicted on activation.
 */
const CACHE_VERSION = 'smarterp-v1';
const APP_SHELL = [
  '/',
  '/manifest.webmanifest',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
  '/mobile/operator',
  '/mobile/work-order',
  '/mobile/picking',
];
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const RUNTIME_CAP = 50;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (k) =>
                !k.startsWith(CACHE_VERSION) && !k.startsWith(RUNTIME_CACHE),
            )
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') {
    // Mutations bypass the cache; for offline, the page surfaces a
    // queued-action toast (frontend handles UX).
    return;
  }
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    if (url.pathname.startsWith('/api/')) {
      event.respondWith(staleWhileRevalidate(req));
      return;
    }
    event.respondWith(cacheFirst(req));
  }
});

async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    const response = await fetch(req);
    if (response.ok) {
      const cache = await caches.open(CACHE_VERSION);
      cache.put(req, response.clone());
    }
    return response;
  } catch (err) {
    const fallback = await caches.match('/');
    return (
      fallback ??
      new Response('Offline + no cached fallback', {
        status: 503,
        statusText: 'Offline',
      })
    );
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(req);
  const networkPromise = fetch(req)
    .then(async (resp) => {
      if (resp.ok) {
        await cache.put(req, resp.clone());
        await trimCache(cache, RUNTIME_CAP);
      }
      return resp;
    })
    .catch(() => null);
  return cached ?? (await networkPromise) ?? offlineJsonResponse();
}

async function trimCache(cache, max) {
  const keys = await cache.keys();
  if (keys.length <= max) return;
  const toEvict = keys.length - max;
  for (let i = 0; i < toEvict; i++) {
    await cache.delete(keys[i]);
  }
}

function offlineJsonResponse() {
  return new Response(
    JSON.stringify({
      type: 'https://smarterp.it/errors/offline',
      title: 'Offline',
      status: 503,
      detail:
        'Il dispositivo è offline e la risorsa non è disponibile in cache.',
    }),
    {
      status: 503,
      headers: { 'Content-Type': 'application/problem+json' },
    },
  );
}
