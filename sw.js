// ============================================================
// SERVICE WORKER — Brinem za svoj grad (Zelenilo PWA)
// Verzija cache-a — promijeni za force update
// ============================================================
const CACHE_NAME = 'zelenilo-v1';
const OFFLINE_PAGE = './index.html';

// Resursi koji se cachiraju pri instalaciji
const PRECACHE = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

// ---- INSTALL ----
self.addEventListener('install', event => {
  console.log('[SW] Instalacija...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Caching resursi');
      return cache.addAll(PRECACHE);
    }).then(() => self.skipWaiting())
  );
});

// ---- ACTIVATE ----
self.addEventListener('activate', event => {
  console.log('[SW] Aktivacija...');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME)
            .map(key => {
              console.log('[SW] Briše stari cache:', key);
              return caches.delete(key);
            })
      )
    ).then(() => self.clients.claim())
  );
});

// ---- FETCH (Network First za Firebase, Cache First za statičke) ----
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Firebase, API pozivi — uvijek network, nikad cache
  if (
    url.hostname.includes('firebase') ||
    url.hostname.includes('googleapis') ||
    url.hostname.includes('firebasestorage') ||
    url.hostname.includes('open-meteo') ||
    url.hostname.includes('anthropic') ||
    event.request.method !== 'GET'
  ) {
    return; // Pusti normalno kroz mrežu
  }

  // Statičke datoteke — Cache First (brže učitavanje)
  if (
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.json') ||
    url.pathname.endsWith('.svg')
  ) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) {
          // Serviraj iz cachea, ali ažuriraj u pozadini
          fetch(event.request).then(response => {
            if (response && response.status === 200) {
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, response));
            }
          }).catch(() => {});
          return cached;
        }
        // Nije u cacheu — dohvati s mreže i cacheiraj
        return fetch(event.request).then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        }).catch(() => caches.match(OFFLINE_PAGE));
      })
    );
    return;
  }

  // Sve ostalo — Network First
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

// ---- PUSH NOTIFIKACIJE (osnova za budućnost) ----
self.addEventListener('push', event => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'Zelenilo', {
      body: data.body || '',
      icon: './icon-192.png',
      badge: './icon-192.png',
      tag: 'zelenilo-notif',
      renotify: true,
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.openWindow('./index.html'));
});
