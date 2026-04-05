const CACHE_NAME = 'ludomkt-v4';

self.addEventListener('install', (event) => {
    self.skipWaiting(); // Força a atualização imediata do App
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim()); // Assume o controle na hora
});

// Apenas busca os arquivos da internet, sem travar o cache velho
self.addEventListener('fetch', (event) => {
    event.respondWith(fetch(event.request).catch(() => {
        console.log("Erro de rede ignorado pelo PWA.");
    }));
});
