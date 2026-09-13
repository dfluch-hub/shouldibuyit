const CACHE_NAME = 'should-i-buy-it-v2';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  // HTML/navigation: network first so online users always get the newest deploy.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            event.waitUntil(
              caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', copy))
            );
          }
          return response;
        })
        .catch(async () => {
          return (
            (await caches.match('./index.html')) ||
            (await caches.match('./')) ||
            Response.error()
          );
        })
    );
    return;
  }

  const url = new URL(request.url);

  // App icon: cache first for instant offline availability.
  if (url.origin === self.location.origin && url.pathname.endsWith('/icon.png')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          const copy = response.clone();
          event.waitUntil(
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
          );
          return response;
        });
      })
    );
    return;
  }

  // Other GET assets: network first, cached fallback.
  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        event.waitUntil(
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {})
        );
        return response;
      })
      .catch(() => caches.match(request))
  );
});