/* کش امن PWA: اسناد HTML همیشه network-first تا به chunk قدیمی اشاره نکنند؛ API هرگز کش نمی‌شود. */
const CACHE = 'carpart-mobile-v1.2.0';
const FALLBACK_ASSETS = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FALLBACK_ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.pathname.startsWith('/api') || url.pathname.startsWith('/health') || url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then((response) => {
      if (response.ok) caches.open(CACHE).then((cache) => cache.put('/', response.clone()));
      return response;
    }).catch(() => caches.match('/') ));
    return;
  }

  event.respondWith(caches.match(request).then((cached) => {
    const network = fetch(request).then((response) => {
      if (response.ok && /\.(?:js|css|png|svg|webp|woff2?)$/.test(url.pathname)) caches.open(CACHE).then((cache) => cache.put(request, response.clone()));
      return response;
    });
    return cached ?? network;
  }));
});
