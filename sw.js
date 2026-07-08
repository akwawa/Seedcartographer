// sw.js — offline support. Everything the app needs is precached at install;
// same-origin requests are served cache-first. VERSION below is a dev
// placeholder: deployments stamp it with a content hash of ASSETS
// (scripts/sw-version.js), so any asset change invalidates the cache.
'use strict';

const VERSION = 'seedcartographer-dev';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './worker.js',
  './seed.js',
  './search.js',
  './shapes.js',
  './i18n.js',
  './version.js',
  './biomes.js',
  './coords.js',
  './slime.js',
  './markers.js',
  './presets.js',
  './favorites.js',
  './searchhistory.js',
  './userpresets.js',
  './usermarkers.js',
  './palette.js',
  './tilegrid.js',
  './relief.js',
  './gallery.html',
  './gallery.js',
  './gallery.json',
  './profile.js',
  './legend.js',
  './maptools.js',
  './tilecache.js',
  './sharestate.js',
  './seedsearch.js',
  './theme.js',
  './export.js',
  './mcfinder.js',
  './mcfinder.wasm',
  './fonts/fonts.css',
  './fonts/space-grotesk-var.woff2',
  './fonts/jetbrains-mono-var.woff2',
  './manifest.webmanifest',
  './icon.svg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: e.request.mode === 'navigate' }).then((hit) => {
      if (hit) return hit;
      return fetch(e.request).then((res) => {
        // opportunistically cache same-origin responses fetched at runtime
        if (res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(e.request, copy));
        }
        return res;
      }).catch(() => (e.request.mode === 'navigate' ? caches.match('./index.html') : undefined));
    })
  );
});
