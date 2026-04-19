// sw.js - Service Worker simplifié
const CACHE_NAME = 'vickyfy-v1';

self.addEventListener('install', (event) => {
    console.log('Service Worker installé');
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('Service Worker activé');
    event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
    // Ne pas intercepter les requêtes vers supabase ou gofile
    const url = event.request.url;
    if (url.includes('supabase') || url.includes('gofile') || url.includes('placeholder')) {
        return;
    }
    
    event.respondWith(
        fetch(event.request).catch(() => {
            return new Response('Offline', {
                status: 200,
                headers: new Headers({ 'Content-Type': 'text/plain' })
            });
        })
    );
});