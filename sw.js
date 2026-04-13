/* MU61 Quiz — generated precache manifest for all quiz and hub pages.
   CACHE_VERSION is content-hashed by scripts/sync_quiz_assets.py so new files activate automatically. */
const CACHE_VERSION = 'mu61-quiz-02a9f3bc7d41';
const CACHE_NAME = 'mu61-cache-' + CACHE_VERSION;

const GOOGLE_FONT_CSS =
  'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Playfair+Display:wght@700&display=swap';

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

self.addEventListener('install', function (event) {
  event.waitUntil(
    (async function () {
      var scope = self.registration.scope;
      var cache = await caches.open(CACHE_NAME);

      var coreOnly = [
        hrefFromScope(scope, 'manifest.webmanifest'),
        hrefFromScope(scope, 'favicon.svg')
      ];
      await Promise.all(
        coreOnly.map(function (u) {
          return cache.add(u).catch(function () {});
        })
      );

      await Promise.all(
        PRECACHE_REL_PATHS.map(function (rel) {
          var u = hrefFromScope(scope, rel);
          return cache.add(u).catch(function () {});
        })
      );

      await precacheGoogleFonts(cache);
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
