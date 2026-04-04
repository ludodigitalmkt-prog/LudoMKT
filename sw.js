const CACHE_NAME = 'ludomkt-v2';

// Instala o motor do App
self.addEventListener('install', (event) => {
    console.log('[LudoMKT App] Instalado com sucesso.');
    self.skipWaiting();
});

// Ativa o motor do App
self.addEventListener('activate', (event) => {
    console.log('[LudoMKT App] Ativado.');
    event.waitUntil(clients.claim());
});

// Permite requisições de rede normais
self.addEventListener('fetch', (event) => {
    event.respondWith(fetch(event.request).catch(() => console.log("Você está offline.")));
});
