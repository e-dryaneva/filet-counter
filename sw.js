'use strict';
importScripts('./offline-assets.js');

const scope = self.registration.scope;
const prefix = `filet-offline:${scope}:`;
const cacheName = prefix + self.FILET_OFFLINE.version;
const assets = new Map(self.FILET_OFFLINE.assets.map(path => {
  const url = new URL(path, scope);
  return [url.pathname, url.href];
}));
const home = new URL('index.html', scope).href;

self.addEventListener('install', event => {
  // addAll commits the complete release together. Never announce a partial download.
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(cacheName);
      await cache.addAll([...assets.values()].map(url => new Request(url, {cache: 'reload'})));
    } catch (error) {
      await caches.delete(cacheName);
      throw error;
    }
    // Only complete releases activate. Open pages choose when it is safe to reload.
    await self.skipWaiting();
  })());
});

// Keep compatibility with the recovery page for older cached installations.
self.addEventListener('message', event => {
  if (event.data?.type === 'FILET_ACTIVATE_UPDATE') event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(prefix) && name !== cacheName)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== new URL(scope).origin) return;
  const isHome = request.mode === 'navigate' &&
    (url.pathname === new URL(scope).pathname || url.pathname === new URL(home).pathname);
  const cachedURL = isHome ? home : assets.get(url.pathname);
  if (!cachedURL) return;
  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    return await cache.match(cachedURL) || fetch(request);
  })());
});
