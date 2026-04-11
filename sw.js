/* QuizTool PWA Service Worker */
const CACHE_VERSION = 'quiztool-v1';
const CACHE_NAME = 'quiztool-cache-' + CACHE_VERSION;

var PRECACHE_REL_PATHS = [
  'index.html',
  'quiz-maker.html',
  'quiz-maker-js.html',
  'question-bank-template.html',
  'js-question-bank.html',
  'quiz-template.html',
  'quiz-combiner.html',
  'bank-maker.html',
  'pdf-exporter.html',
  'manifest.webmanifest',
  'favicon.svg'
];

function hrefFromScope(scope, relPath) {
  var parts = relPath.split('/');
  var enc = parts
    .map(function (p) {
      return encodeURIComponent(p);
    })
    .join('/');
  return new URL(enc, scope).href;
}

function shouldStore(res) {
  return res && (res.ok || res.type === 'opaque');
}

self.addEventListener('install', function (event) {
  event.waitUntil(
    (async function () {
      var scope = self.registration.scope;
      var cache = await caches.open(CACHE_NAME);

      await Promise.all(
        PRECACHE_REL_PATHS.map(function (rel) {
          var u = hrefFromScope(scope, rel);
          return cache.add(u).catch(function () {});
        })
      );

      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    (async function () {
      var keys = await caches.keys();
      await Promise.all(
        keys.map(function (k) {
          return k !== CACHE_NAME ? caches.delete(k) : Promise.resolve();
        })
      );
      await self.clients.claim();
    })()
  );
});

/** HTML: network first (fresh when online, updates cache), then cache, then hub fallback. */
function handleNavigate(event, request) {
  return (async function () {
    var cache = await caches.open(CACHE_NAME);
    try {
      var res = await fetch(request);
      if (res && res.ok) {
        try {
          await cache.put(request, res.clone());
        } catch (_) {}
      }
      return res;
    } catch (err) {
      var cached = await cache.match(request);
      if (cached) return cached;
      var fb = await cache.match(new URL('index.html', self.registration.scope));
      if (fb) return fb;
      throw err;
    }
  })();
}

/** Assets & cross-origin: cache first, then network (populate cache). */
function handleAsset(event, request) {
  return (async function () {
    var cache = await caches.open(CACHE_NAME);
    var cached = await cache.match(request);
    if (cached) return cached;
    try {
      var res = await fetch(request);
      if (shouldStore(res)) {
        try {
          await cache.put(request, res.clone());
        } catch (_) {}
      }
      return res;
    } catch (err) {
      throw err;
    }
  })();
}

function shouldNetworkFirst(req) {
  if (req.mode === 'navigate') return true;
  try {
    var u = new URL(req.url);
    if (u.origin !== self.location.origin) return false;
    var p = u.pathname;
    return p.endsWith('manifest.webmanifest') || p.endsWith('favicon.svg');
  } catch (e) {
    return false;
  }
}

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;
  var req = event.request;
  if (shouldNetworkFirst(req)) {
    event.respondWith(handleNavigate(event, req));
    return;
  }
  event.respondWith(handleAsset(event, req));
});