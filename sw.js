/* MU61 Quiz — generated precache manifest for all quiz and hub pages.
   CACHE_VERSION is content-hashed by scripts/sync_quiz_assets.py so new files activate automatically. */
const CACHE_VERSION = 'mu61-quiz-02a9f3bc7d41';
const CACHE_NAME = 'mu61-cache-' + CACHE_VERSION;

const GOOGLE_FONT_CSS =
  'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Playfair+Display:wght@700&display=swap';

const HTML2PDF_CDN =
  'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';

var PRECACHE_REL_PATHS = [
  'quiz-engine.js',
  'bank-engine.js',
  'index-engine.js',
  'index.html',
  'manifest.webmanifest',
  'favicon.svg',
  'icon-48.png',
  'icon-72.png',
  'icon-96.png',
  'icon-144.png',
  'icon-192.png',
  'icon-512.png',
  'Cardio/57th-end-round-1.html',
  'Cardio/57th-end-round-2.html',
  'Cardio/57th-end-round-3.html',
  'Cardio/57th-final.html',
  'Cardio/58th-end-round-1.html',
  'Cardio/58th-end-round-2.html',
  'Cardio/58th-final.html',
  'Cardio/59th-final.html',
  'Cardio/59th-mid.html',
  'Cardio/60th-final.html',
  'Cardio/60th-mid.html',
  'Cardio/61th-mid.html',
  'Cardio/damietta-qs.html',
  'Cardio/index.html',
  'Cardio/Misc.html',
  'gyn/ai/index.html',
  'gyn/ai/l1-anatomy.html',
  'gyn/ai/l2-physiology.html',
  'gyn/ai/l3-embryology.html',
  'gyn/ai/l4-puberty.html',
  'gyn/ai/l5-menopause.html',
  'gyn/ai/l6-abnormal-menstruation.html',
  'gyn/ai/l7-amenorrhea.html',
  'gyn/ai/l8-hyperprolactinemia.html',
  'gyn/ai/l9-fgm.html',
  'gyn/ai/l10-pcos.html',
  'gyn/ai/l11-aub.html',
  'gyn/ai/l12-fibroid.html',
  'gyn/ai/l13-endometriosis-adenomyosis.html',
  'gyn/ai/l14-endometrial-hyperplasia.html',
  'gyn/ai/l15-infertility.html',
  'gyn/dep/all-department-book.html',
  'gyn/dep/index.html',
  'gyn/dep/l1-anatomy.html',
  'gyn/dep/l2-physiology.html',
  'gyn/dep/l3-embryology.html',
  'gyn/dep/l4-puberty.html',
  'gyn/dep/l5-menopause.html',
  'gyn/dep/l6-abnormal-menstruation.html',
  'gyn/dep/l7-amenorrhea.html',
  'gyn/dep/l8-hyperprolactinemia.html',
  'gyn/dep/l9-female-genital-mutilation-.html',
  'gyn/dep/l10-pcos.html',
  'gyn/dep/l11-aub.html',
  'gyn/dep/l12-fibroid.html',
  'gyn/dep/l13-endometriosis-and-adenomyosis.html',
  'gyn/dep/l15-infertility-.html',
  'gyn/dep/l16-genital-displacement-.html',
  'gyn/dep/l17-urinary-incontinence-.html',
  'gyn/dep/l18-genital-fistula.html',
  'gyn/dep/l19-genital-infections-and-stis.html',
  'gyn/dep/l20-gynecological-oncology.html',
  'gyn/dep/misc-mcq.html',
  'gyn/index.html',
  'gyn/mans/1---anatomy-physiology-embryology.html',
  'gyn/mans/2---amenorrhea-aub-ovulation.html',
  'gyn/mans/3---infertility.html',
  'gyn/mans/4---fibroid-endometriosis-adenomyosis.html',
  'gyn/mans/5---prolapse-infection.html',
  'gyn/mans/6---oncology.html',
  'gyn/mans/7---dd.html',
  'gyn/mans/dr-alaa-mesbah.html',
  'gyn/mans/index.html',
  'gyn/mans/mans-mcq-bank.html',
  'gyn/past-years/55th-final.html',
  'gyn/past-years/57th-end-round-1.html',
  'gyn/past-years/57th-end-round-2.html',
  'gyn/past-years/57th-end-round-3.html',
  'gyn/past-years/57th-final.html',
  'gyn/past-years/58th-end-round-1.html',
  'gyn/past-years/58th-end-round-2.html',
  'gyn/past-years/58th-end-round-3.html',
  'gyn/past-years/58th-final.html',
  'gyn/past-years/59th-final.html',
  'gyn/past-years/59th-midterm.html',
  'gyn/past-years/60th-final.html',
  'gyn/past-years/60th-midterm.html',
  'gyn/past-years/index.html',
  'gyn/past-years/past-years-question-bank.html',
  'quiz-engine-test.html'
];

/* ── Build a full URL from scope + relative path ── */
function hrefFromScope(scope, relPath) {
  return new URL(relPath, scope).href;
}

function shouldStore(res) {
  return res && (res.ok || res.type === 'opaque');
}

function precacheGoogleFonts(cache) {
  return fetch(GOOGLE_FONT_CSS, { mode: 'cors', credentials: 'omit' })
    .then(function (res) {
      if (!res.ok) return;
      return cache.put(GOOGLE_FONT_CSS, res.clone()).then(function () {
        return res.text();
      });
    })
    .then(function (txt) {
      if (!txt) return;
      var re = /url\s*\(\s*([^)]+)\s*\)/g;
      var m;
      var jobs = [];
      while ((m = re.exec(txt)) !== null) {
        var raw = m[1].replace(/["']/g, '').trim();
        if (!raw || raw.indexOf('data:') === 0) continue;
        var fontUrl = new URL(raw, GOOGLE_FONT_CSS).href;
        (function (u) {
          jobs.push(
            fetch(u, { mode: 'cors', credentials: 'omit' }).then(function (r) {
              if (r.ok) return cache.put(u, r);
            })
          );
        })(fontUrl);
      }
      return Promise.all(
        jobs.map(function (j) {
          return j.catch(function () {});
        })
      );
    })
    .catch(function () {});
}

/* ── Precache html2pdf.js CDN bundle for offline PDF export ── */
function precacheHtml2Pdf(cache) {
  return fetch(HTML2PDF_CDN, { mode: 'cors', credentials: 'omit' })
    .then(function (res) {
      if (res.ok) return cache.put(HTML2PDF_CDN, res);
    })
    .catch(function () {});
}

/* ══════════════════════════════════════════════════════════════
   INSTALL — precache everything
   ══════════════════════════════════════════════════════════════ */
self.addEventListener('install', function (event) {
  event.waitUntil(
    (async function () {
      var scope = self.registration.scope;
      var cache = await caches.open(CACHE_NAME);

      /* Core assets (manifest + favicon) */
      await Promise.all(
        ['manifest.webmanifest', 'favicon.svg'].map(function (f) {
          return cache.add(hrefFromScope(scope, f)).catch(function () {});
        })
      );

      /* All HTML + JS files */
      await Promise.all(
        PRECACHE_REL_PATHS.map(function (rel) {
          var u = hrefFromScope(scope, rel);
          return cache.add(u).catch(function () {});
        })
      );

      /* Cross-origin CDN resources */
      await precacheGoogleFonts(cache);
      await precacheHtml2Pdf(cache);

      await self.skipWaiting();
    })()
  );
});

/* ══════════════════════════════════════════════════════════════
   ACTIVATE — clean old caches, claim clients immediately
   ══════════════════════════════════════════════════════════════ */
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

/* ══════════════════════════════════════════════════════════════
   FETCH — routing strategy
   ══════════════════════════════════════════════════════════════ */

/** Navigation requests (HTML pages): network-first with cache fallback + hub fallback. */
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
      /* Offline: try exact match first */
      var cached = await cache.match(request);
      if (cached) return cached;

      /* Try matching without query/hash (some browsers append them) */
      var cleanUrl = request.url.split('?')[0].split('#')[0];
      cached = await cache.match(cleanUrl);
      if (cached) return cached;

      /* Last resort: serve the main hub page */
      var fb = await cache.match(hrefFromScope(self.registration.scope, 'index.html'));
      if (fb) return fb;
      throw err;
    }
  })();
}

/** Assets & cross-origin: cache-first, then network (populates cache on miss). */
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
      /* Offline miss for asset — try matching without query string */
      var cleanUrl = request.url.split('?')[0].split('#')[0];
      var cachedClean = await cache.match(cleanUrl);
      if (cachedClean) return cachedClean;
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
