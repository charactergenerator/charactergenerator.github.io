// Service worker: makes the app installable and usable with no connection.
// Bump VERSION on any deploy that should drop the old cache.
const VERSION = 'v117';
const CACHE = `chargen-${VERSION}`;

// Anything a browser might fetch to draw a tab or home-screen icon. The fetch
// handler below returns without touching these, so they never come from the
// cache and the worker never sits between the browser and the icon.
const ICON_PATHS = [
  '/favicon.ico',
  '/favicon.svg',
  '/manifest.webmanifest',
  '/apple-touch-icon.png',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-512.png'
];

// The shell needed to boot offline. The versioned css/js are not listed: they
// carry a ?v=N that changes each deploy, so they are cached on first use
// instead of being pinned to a version that goes stale here. Neither are the
// icons, which are in ICON_PATHS above and are left to the network: nothing
// on the page draws them, so they are not part of booting offline.
const PRECACHE = [
  './',
  'index.html',
  // the sidebar's Auto Roll Tables mark, which the stylesheet paints as a mask
  'assets/logo-autorolltables.png',
  // the page watermark, part of how the shell looks
  'assets/dndlogo1.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      // one bad URL shouldn't fail the whole install
      .then(c => Promise.allSettled(PRECACHE.map(u => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;   // never touch third-party requests

  // The icons are the browser's business, not ours. Listboard has no service
  // worker at all and its favicon renders on an iPad in browsers where ours
  // did not, so the worker is kept away from anything a browser might fetch
  // to draw a tab icon: no interception, no cache, straight to the network.
  if (ICON_PATHS.some(p => url.pathname.endsWith(p))) return;

  // The page itself goes to the network first, so a deploy is picked up as
  // soon as you are online, with the cached copy as the offline fallback.
  if (req.mode === 'navigate' || url.pathname.endsWith('.html')) {
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req, { ignoreSearch: true })
          .then(hit => hit || caches.match('index.html', { ignoreSearch: true })))
    );
    return;
  }

  // Everything else is versioned by URL, so serving from cache is safe and a
  // new deploy simply misses and fetches fresh.
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return res;
    }))
  );
});
