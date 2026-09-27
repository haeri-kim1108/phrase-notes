// Offline support: the app shell is cached so the app opens without a connection.
// Firestore keeps its own offline copy of the records, so data requests are not touched here.
const VERSION = 'v5';
const SHELL = `shell-${VERSION}`;
const RUNTIME = `runtime-${VERSION}`;
const SHELL_FILES = [
  './', './index.html', './firebase-config.js', './manifest.webmanifest',
  './icons/icon-192.png?v=2', './icons/icon-512.png?v=2', './icons/apple-touch-icon.png?v=2', './icons/favicon-32.png?v=2',
];
const FIREBASE_SDK = ['app', 'auth', 'firestore'].map(n => `https://www.gstatic.com/firebasejs/10.14.1/firebase-${n}-compat.js`);

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const shell = await caches.open(SHELL);
    // cache: 'reload' skips the browser's HTTP cache so a new version never stores stale files
    await shell.addAll(SHELL_FILES.map(u => new Request(u, { cache: 'reload' })));
    const rt = await caches.open(RUNTIME);
    await Promise.all(FIREBASE_SDK.map(u => rt.add(u).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keep = [SHELL, RUNTIME];
    for (const key of await caches.keys()) if (!keep.includes(key)) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // App files: try the network first so updates show up, fall back to the cache offline
  if (url.origin === self.location.origin) {
    event.respondWith((async () => {
      try {
        // no-cache: always revalidate with the server instead of trusting the HTTP cache
        const res = await fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' });
        if (res.ok) (await caches.open(SHELL)).put(req, res.clone());
        return res;
      } catch (e) {
        return (await caches.match(req, { ignoreSearch: true })) ||
               (req.mode === 'navigate' ? caches.match('./index.html') : Response.error());
      }
    })());
    return;
  }

  // Versioned SDK files and web fonts never change: serve from cache, fill it on first use
  if (url.host === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/') ||
      url.host === 'fonts.googleapis.com' || url.host === 'fonts.gstatic.com') {
    event.respondWith((async () => {
      const hit = await caches.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok || res.type === 'opaque') (await caches.open(RUNTIME)).put(req, res.clone());
      return res;
    })());
  }
});
