// Replaced by build-pwa.js. Keep each release atomic and scoped to this app.
const VERSION = "4427aeb9abb8b5de";
const FILES = ["icon-192.png","icon-512.png","index-8P5decsC.js","index-BCbu8Za3.css","index.html","manifest.webmanifest"];
const PREFIX = 'lirastructure:' + self.registration.scope + ':';
const CACHE = PREFIX + VERSION;
const urls = FILES.map((file) => new URL(file, self.registration.scope).href);
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(urls)));
  // No skipWaiting: an open model must never be reloaded by an update.
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(PREFIX) && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      ),
  );
});
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (!url.href.startsWith(self.registration.scope)) return;
  const target =
    event.request.mode === 'navigate'
      ? new URL('index.html', self.registration.scope).href
      : url.href;
  if (!urls.includes(target)) return;
  event.respondWith(
    caches.open(CACHE).then(async (cache) => (await cache.match(target)) || fetch(event.request)),
  );
});
