const CACHE_NAME = "ludomkt-v2";
const assets = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./firebase.js",
  "./logo.png"
];

self.addEventListener("install", installEvent => {
  installEvent.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(assets)));
});

self.addEventListener("fetch", fetchEvent => {
  fetchEvent.respondWith(caches.match(fetchEvent.request).then(res => res || fetch(fetchEvent.request)));
});
