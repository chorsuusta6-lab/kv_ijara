// ============================================
// SERVICE WORKER - PWA
// ============================================

const CACHE_VERSION = 'kv-v1';
const CACHE_FILES = [
  './',
  './index.html',
  './css/style.css',
  './js/supabase.js',
  './js/app.js',
  './icon-192.png',
  './icon-512.png',
  './manifest.json',
];

// O'rnatish - fayllarni keshlash
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      return cache.addAll(CACHE_FILES).catch((err) => {
        console.warn('Kesh xatosi:', err);
      });
    })
  );
  self.skipWaiting();
});

// Faollashtirish - eski keshlarni o'chirish
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
      );
    })
  );
  self.clients.claim();
});

// So'rovlarni ushlash
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Supabase API so'rovlarini hech qachon keshlash
  if (url.hostname.includes('supabase.co')) {
    return;
  }

  // GET so'rovlar uchun: avval keshdan, keyin tarmoqdan
  if (event.request.method === 'GET') {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) {
          // Orqa fonda yangilash
          fetch(event.request)
            .then((res) => {
              if (res && res.status === 200) {
                caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, res.clone()));
              }
            })
            .catch(() => {});
          return cached;
        }
        return fetch(event.request)
          .then((res) => {
            if (res && res.status === 200 && res.type === 'basic') {
              const clone = res.clone();
              caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
            }
            return res;
          })
          .catch(() => caches.match('./index.html'));
      })
    );
  }
});