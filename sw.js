// Service worker: makes the app installable and usable with no connection.
// Bump VERSION on any deploy that should drop the old cache.
const VERSION = 'v96';
const CACHE = `chargen-${VERSION}`;

// The shell needed to boot offline. The versioned css/js are not listed: they
// carry a ?v=N that changes each deploy, so they are cached on first use
// instead of being pinned to a version that goes stale here.
const PRECACHE = [
  './',
  'index.html',
  'manifest.webmanifest',
  'favicon.svg',
  'assets/icon-192.png',
  'assets/icon-512.png',
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
