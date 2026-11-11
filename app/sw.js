// Service worker : l'app fonctionne hors ligne une fois installée.
const CACHE = 'moteur-studio-v2';
const ASSETS = [
  './', './index.html', './manifest.webmanifest', './css/styles.css',
  './js/app.js', './js/engine.js', './js/storage.js', './js/presets.js', './js/templates.js', './js/state.js',
  './js/fx.js', './js/audio.js', './js/export.js', './js/tracking.js', './js/tracker.worker.js',
  './js/ui/timeline.js', './js/ui/inspector.js', './js/ui/library.js', './js/ui/trackpanel.js', './js/ui/sheets.js',
  './js/vendor/mp4-muxer.mjs', './js/vendor/webm-muxer.mjs',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png',
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// Réseau d'abord (pour recevoir les mises à jour), cache en secours hors ligne.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r; })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('./index.html')))
  );
});
