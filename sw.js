const CACHE_NAME = 'music-player-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/style.css',
    '/script.js',
    '/manifest.json'
];

// Installation
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
    );
});

// Interception des requêtes
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    
    // Stratégie cache-first pour les MP3
    if (url.pathname.endsWith('.mp3')) {
        event.respondWith(
            caches.match(event.request)
                .then(response => {
                    if (response) {
                        return response; // Retourne depuis cache
                    }
                    return fetch(event.request).then(response => {
                        // Met en cache pour la prochaine fois
                        return caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, response.clone());
                            return response;
                        });
                    });
                })
        );
    } else {
        // Pour les autres fichiers
        event.respondWith(
            caches.match(event.request)
                .then(response => response || fetch(event.request))
        );
    }
});