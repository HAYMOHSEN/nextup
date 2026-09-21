/* Prioritize My Lists service worker: makes the app start and work without a connection.
   Raise CACHE (v7 -> v8 ...) whenever you upload changed files. */
const CACHE = 'nextup-v7';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './privacy.html',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function remember(request, response) {
  if (response && response.ok) {
    const copy = response.clone();
    caches.open(CACHE).then((cache) => cache.put(request, copy));
  }
  return response;
}

/* Pages: ask the website first, so an update shows straight away.
   Without a connection (or after 3.5 s of waiting) the saved copy is used. */
async function pageFirstFromNetwork(request) {
  const saved = (await caches.match(request, { ignoreSearch: true })) || (await caches.match('./index.html'));
  const fresh = fetch(request.url, { cache: 'no-cache' }).then((response) => remember(request, response));
  if (!saved) return fresh;
  const patience = new Promise((resolve) => setTimeout(() => resolve(saved), 3500));
  return Promise.race([fresh.catch(() => saved), patience]);
}

/* Icons and other files: saved copy first, refreshed in the background. */
function savedFirst(request) {
  return caches.match(request, { ignoreSearch: true }).then((saved) => {
    const fresh = fetch(request).then((response) => remember(request, response)).catch(() => saved);
    return saved || fresh;
  });
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  const isPage = request.mode === 'navigate' || request.destination === 'document';
  event.respondWith(isPage ? pageFirstFromNetwork(request) : savedFirst(request));
});
