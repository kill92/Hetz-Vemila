/* חץ ומילה - Service Worker: קודם הרשת (תמיד גרסה עדכנית), ואם אין אינטרנט - מהמטמון */
var CACHE = 'hetz-cache-1';
var FILES = ['./', 'index.html', 'styles.css', 'words.js', 'engine.js', 'core.js', 'game.js', 'ui.js', 'missions.js', 'onboard.js', 'cloud.js', 'boot.js',
  'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(FILES.map(function (f) { return c.add(new Request(f, { cache: 'reload' })).catch(function () {}); }));
  }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.slice(-12) === 'version.json') return;
  e.respondWith(
    fetch(req, { cache: 'no-cache' }).then(function (res) {
      if (res && res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
      return res;
    }).catch(function () {
      return caches.match(req).then(function (m) { return m || (req.mode === 'navigate' ? caches.match('index.html') : undefined); });
    })
  );
});
