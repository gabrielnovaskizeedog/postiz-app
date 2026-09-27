// Minimal service worker: makes SocialNovaskIA installable as an app.
// It does not cache anything, every request goes to the network.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
