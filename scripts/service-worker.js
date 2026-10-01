// Replaced by build-pwa.js. Keep each release atomic and scoped to this app.
const VERSION = __VERSION__;
const FILES = __FILES__;
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

self.addEventListener('message', event => {
  if (event.data?.type !== 'ACTIVATE_UPDATE') return;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const own = windows.filter(client => client.url.startsWith(self.registration.scope));
    if (own.length > 1) { event.source?.postMessage({ type: 'UPDATE_BLOCKED' }); return; }
    await self.skipWaiting();
  })());
});
