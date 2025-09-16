// v4 — stronger network-first for HTML, cache-busting on navigation
const CACHE_VERSION = 'v4';
const CACHE_NAME = `wealth-cache-${CACHE_VERSION}`;
const OFFLINE_URLS = ['/', '/index.html'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(OFFLINE_URLS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((k) => k.startsWith('wealth-cache-') && k !== CACHE_NAME)
        .map((k) => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // Network-first for navigations (HTML), with cache:'reload' to bust HTTP cache
  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(new Request(req.url, { cache: 'reload' }));
        const copy = fresh.clone();
        const cache = await caches.open(CACHE_NAME);
        cache.put('/', copy);
        return fresh;
      } catch (err) {
        return (await caches.match('/')) || (await caches.match('/index.html'));
      }
    })());
    return;
  }

  // Stale-while-revalidate for other assets
  event.respondWith((async () => {
    const cached = await caches.match(req);
    const fetchPromise = fetch(req).then((res) => {
      if (res && res.status === 200) {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
      }
      return res;
    }).catch(() => cached);
    return cached || fetchPromise;
  })());
});
