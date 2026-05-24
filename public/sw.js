const CACHE_NAME = 'dawajin-pro-cache-v1';
const PRE_CACHE = [
  '/poultry-ledger/',
  '/poultry-ledger/index.html',
  '/poultry-ledger/manifest.json',
  '/poultry-ledger/assets/icon.svg',
  '/poultry-ledger/assets/icon.png'
];

// Install Event - Pre-cache critical Shell Assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRE_CACHE))
      .then(() => self.skipWaiting())
  );
});

// Activate Event - Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('Service Worker: Clearing Old Cache', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Dynamic Network First falling back to Cache
self.addEventListener('fetch', (event) => {
  // Only handle GET requests within our scope
  if (event.request.method !== 'GET') return;
  
  const url = new URL(event.request.url);
  if (!url.origin.startsWith(self.location.origin)) return;

  // Cache-first for images to save bandwidth and load faster
  if (event.request.destination === 'image') {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        
        return fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const cacheCopy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cacheCopy));
          }
          return networkResponse;
        }).catch(() => caches.match('/poultry-ledger/assets/icon.svg'));
      })
    );
    return;
  }

  // Network-first for other requests (HTML, JS, CSS, APIs) to ensure fresh updates
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Cache the updated assets dynamically
        if (networkResponse && networkResponse.status === 200) {
          const cacheCopy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cacheCopy));
        }
        return networkResponse;
      })
      .catch(() => {
        // Fallback to cache if network is unavailable
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          // If the main document failed, serve the pre-cached shell
          if (event.request.mode === 'navigate') {
            return caches.match('/poultry-ledger/');
          }
        });
      })
  );
});
