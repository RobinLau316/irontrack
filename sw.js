// IronTrack Service Worker：应用壳离线缓存。
// 发布新版本时必须递增 CACHE_VERSION；旧缓存会在激活时自动清除。
const CACHE_VERSION = 'irontrack-2026-09-19a';

const SHELL = [
  './',
  './index.html',
  './public/app.css',
  './public/app/core.js',
  './public/app/data.js',
  './public/app/helpers.js',
  './public/app/plan.js',
  './public/app/pages.js',
  './public/app/training.js',
  './public/app/boot.js',
  './public/exercise-engine.js',
  './public/data/exercise-catalog.v1.json',
  './public/data/exercise-instructions-zh.v1.json',
  './public/manifest.json',
  './public/irontrack-hero.webp',
  './public/irontrack-hero.jpg',
  './public/icon-192.png',
  './public/icon-512.png',
  './public/icon-maskable-512.png',
  './public/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // AI API 等跨域请求不拦截

  const isHtml = req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('/index.html');
  const isData = url.pathname.includes('/data/');

  if (isHtml || isData) {
    // 页面与数据：网络优先并回写缓存，保证新版本能生效；断网时回退缓存。
    event.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
        return res;
      }).catch(() =>
        caches.match(req).then((cached) => cached || caches.match('./index.html'))
      )
    );
    return;
  }

  // 其余静态资源：缓存优先，未命中回源并写入缓存。
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
      return res;
    }))
  );
});
