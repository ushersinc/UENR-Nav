// UENR Nav Service Worker for Offline Campus Navigation
// Caches base map tiles, critical campus metadata, and app shell assets
const CACHE_NAME = 'uenr-nav-v3';
const TILE_CACHE_NAME = 'uenr-nav-tiles-v2';
const METADATA_CACHE_NAME = 'uenr-nav-metadata-v2';
const MAX_CACHED_TILES = 1500;

// Core app shell assets & fallback metadata to precache
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/api/locations',
  '/api/pedestrian-graph',
  '/api/notices',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME).then((cache) => {
        return cache.addAll(['/', '/index.html', '/manifest.json']).catch((err) => {
          console.warn('Pre-caching shell assets notice:', err);
        });
      }),
      caches.open(METADATA_CACHE_NAME).then(async (metaCache) => {
        // Pre-fetch critical campus metadata if online
        try {
          const locRes = await fetch('/api/locations');
          if (locRes.ok) await metaCache.put('/api/locations', locRes);
          const graphRes = await fetch('/api/pedestrian-graph');
          if (graphRes.ok) await metaCache.put('/api/pedestrian-graph', graphRes);
          const notRes = await fetch('/api/notices');
          if (notRes.ok) await metaCache.put('/api/notices', notRes);
        } catch {
          // Will populate on first successful fetch
        }
      }),
    ])
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (
            key !== CACHE_NAME &&
            key !== TILE_CACHE_NAME &&
            key !== METADATA_CACHE_NAME
          ) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Base Map Tiles: OpenStreetMap & Esri (Cache-First strategy)
  // Highly optimized for instant map rendering and complete offline roaming
  if (
    url.hostname.includes('tile.openstreetmap.org') ||
    url.hostname.includes('arcgisonline.com')
  ) {
    event.respondWith(
      caches.open(TILE_CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(request);
        if (cachedResponse) {
          return cachedResponse;
        }

        try {
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.status === 200) {
            cache.put(request, networkResponse.clone());
            trimCache(TILE_CACHE_NAME, MAX_CACHED_TILES);
          }
          return networkResponse;
        } catch {
          // If offline and tile not cached, return transparent fallback tile
          return (
            cachedResponse ||
            new Response(
              new Uint8Array([
                0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00,
                0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01,
                0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f,
                0x15, 0xc4, 0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41,
                0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00,
                0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
                0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
              ]),
              {
                headers: { 'Content-Type': 'image/png' },
                status: 200,
              }
            )
          );
        }
      })
    );
    return;
  }

  // 2. Critical Campus Metadata & API Routes: Network-First with Cache Fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (request.method === 'GET' && response.status === 200) {
            const responseClone = response.clone();
            caches.open(METADATA_CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          return new Response(
            JSON.stringify({
              error: 'Offline mode active',
              offline: true,
              timestamp: new Date().toISOString(),
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        })
    );
    return;
  }

  // 3. Web Fonts: Cache-First
  if (
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com') ||
    url.hostname.includes('unpkg.com')
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        try {
          const response = await fetch(request);
          if (response && response.status === 200) {
            cache.put(request, response.clone());
          }
          return response;
        } catch {
          return cached || new Response('', { status: 408 });
        }
      })
    );
    return;
  }

  // 4. Static Assets & App Shell: Stale-While-Revalidate
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && request.method === 'GET') {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});

// Helper to keep tile cache size bounded
async function trimCache(cacheName, maxItems) {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length > maxItems) {
      // Remove oldest entries
      const deleteCount = Math.min(20, keys.length - maxItems);
      for (let i = 0; i < deleteCount; i++) {
        await cache.delete(keys[i]);
      }
    }
  } catch (err) {
    console.warn('Trim cache notice:', err);
  }
}
