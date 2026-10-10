// Plazo 2.0 migration: retire legacy cache-first service worker.
// The old SW cached index.html indefinitely, preventing new Auth/crypto code
// from updating reliably. Online-only while secure offline sync is designed.
self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith('plazo-')).map(name => caches.delete(name)));
    await self.registration.unregister();
    await self.clients.claim();
  })());
});
// No fetch interception. The browser uses the network directly.
