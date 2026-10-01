import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const scope = 'https://example.org/LiraStructureWeb/';
function worker() {
  const handlers = {},
    removed = [],
    added = [];
  const cache = {
    addAll: async (urls) => added.push(...urls),
    match: async (url) => ({ cached: url }),
  };
  const source = readFileSync(new URL('../scripts/service-worker.js', import.meta.url), 'utf8')
    .replace('__VERSION__', '"v2"')
    .replace('__FILES__', '["index.html","app.js"]');
  vm.runInNewContext(source, {
    self: {
      registration: { scope },
      addEventListener: (name, callback) => {
        handlers[name] = callback;
      },
    },
    URL,
    caches: {
      open: async () => cache,
      keys: async () => [
        'lirastructure:' + scope + ':v1',
        'lirastructure:' + scope + ':v2',
        'liracad-v1',
      ],
      delete: async (key) => removed.push(key),
    },
    fetch: () => {
      throw Error('Unexpected network request');
    },
  });
  return { handlers, removed, added };
}
test('offline cache stays scoped to this app, serves project navigation and leaves other apps alone', async () => {
  const w = worker();
  let pending;
  w.handlers.install({
    waitUntil: (p) => {
      pending = p;
    },
  });
  await pending;
  assert.deepEqual(w.added, [scope + 'index.html', scope + 'app.js']);
  w.handlers.activate({
    waitUntil: (p) => {
      pending = p;
    },
  });
  await pending;
  assert.deepEqual(w.removed, ['lirastructure:' + scope + ':v1']);
  let response;
  w.handlers.fetch({
    request: { method: 'GET', url: scope, mode: 'navigate' },
    respondWith: (p) => {
      response = p;
    },
  });
  assert.equal((await response).cached, scope + 'index.html');
  w.handlers.fetch({
    request: { method: 'GET', url: 'https://example.org/LiraCadWeb/', mode: 'navigate' },
    respondWith: () => assert.fail('Intercepted another app'),
  });
});
test('manifest uses relative installation paths and standalone display', () => {
  const manifest = JSON.parse(
    readFileSync(new URL('../public/manifest.webmanifest', import.meta.url)),
  );
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
  // Manifest id resolves against the origin, unlike start_url and scope.
  const origin = 'https://andreassvensson87-dev.github.io';
  const manifestUrl = origin + '/LiraStructureWeb/manifest.webmanifest';
  assert.equal(new URL(manifest.id, origin).href, origin + '/LiraStructureWeb/');
  assert.equal(new URL(manifest.start_url, manifestUrl).href, origin + '/LiraStructureWeb/');
  assert.equal(new URL(manifest.scope, manifestUrl).href, origin + '/LiraStructureWeb/');
  assert.equal(manifest.display, 'standalone');
  assert.deepEqual(
    manifest.icons.map((i) => i.sizes),
    ['192x192', '512x512'],
  );
});
