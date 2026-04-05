const CACHE_NAME = 'ludomkt-v3';

self.addEventListener('install', (event) => {
    console.log('[LudoMKT App] Instalado.');
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('[LudoMKT App] Ativado.');
    event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
    // REGRA DE OURO: Ignorar requisições para o Firebase e IA para NÃO dar erro de CORS!
    if (event.request.url.includes('googleapis.com') || 
        event.request.url.includes('firebase') || 
        event.request.url.includes('groq.com')) {
        return; // Deixa passar direto, sem o aplicativo interferir
    }

    // Para o resto do site, tenta carregar normalmente
    event.respondWith(
        fetch(event.request).catch(() => {
            return new Response("Sistema Offline no momento.", { 
                status: 503, 
                statusText: "Offline" 
            });
        })
    );
});
