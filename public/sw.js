/*
 * Attendance Pro — Service Worker
 * Enables offline-ish PWA behavior: the app shell (HTML/CSS/JS) is cached
 * so the installed app launches instantly. API calls are never cached.
 */
const CACHE_NAME = 'attendance-pro-v1';
const SHELL = [
  '/app.html',
  '/login.html',
  '/manifest.json',
  '/css/style.css',
  '/js/api.js',
  '/js/app.js',
  '/js/login.js',
  '/js/views/dashboard.js',
  '/js/views/students.js',
  '/js/views/courses.js',
  '/js/views/attendance.js',
  '/js/views/reports.js'
];

/* Prime the cache with the app shell right after install. */
self.addEventListener('install', (e) => {
  e.waitUntil(
    Promise.all(SHELL.map((p) => fetch(p).then((r) => {
      if (!r.respondWith && r.ok) {
        self.skipWaiting && self.skipWaiting();
      }
      return r;
    })))
  );
});

/* Clean up stale caches when a new version activates. */
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients && self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  const method = (req.method || 'GET').toUpperCase();

  // Never intercept API calls or downloads — those must always hit the network.
  if (method !== 'GET' || url.pathname.startsWith('/api/') || url.pathname.includes('download')) {
    return;
  }

  if (method === 'GET' && url.pathname === '/') {
    // homepage → app shell
    return e.respondWith(
      caches.match('/app.html').then((hit) => hit || fetch(req))
    );
  }

  if (method === 'GET') {
    e.respondWith(
      caches.match(req).then((hit) => {
        if (hit) return hit;
        return fetch(req).then((res) => {
          if (res.ok && url.origin === location.origin && SHELL.includes(url.pathname)) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, clone));
          }
          return res;
        });
      }).catch(() => {
        // Offline fallback: serve the app shell so the UI still paints.
        if (url.pathname === SHELL[0]) return caches.match('/app.html');
        return Response.error();
      })
    );
  }
});