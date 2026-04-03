const CACHE_NAME = "ludomkt-v1";
const assets = [
  "/",
  "/index.html",
  "/css/style.css",
  "/js/app.js"
];

// Instala o Service Worker e guarda os arquivos no cache
self.addEventListener("install", installEvent => {
  installEvent.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      cache.addAll(assets);
    })
  );
});

// Intercepta as requisições (se não tiver internet, ele carrega do cache)
self.addEventListener("fetch", fetchEvent => {
  fetchEvent.respondWith(
    caches.match(fetchEvent.request).then(res => {
      return res || fetch(fetchEvent.request);
    })
  );
});