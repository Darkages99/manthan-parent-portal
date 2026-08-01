// Minimal service worker: exists only to satisfy PWA installability checks
// (Chrome/Android requires a registered SW with a fetch handler before it
// will show the install prompt). Deliberately does no caching — this app is
// auth-gated and server-rendered, so caching HTML risks serving stale
// sessions. All requests pass straight through to the network.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});

// ---- Web Push -------------------------------------------------------------
// Payload is JSON: { title, body, url } (see src/lib/notifications/push.ts).
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Manthan Vidyashram";
  const options = {
    body: data.body || "",
    icon: "/brand/icon-192.png",
    badge: "/brand/icon-192.png",
    data: { url: data.url || "/" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Focus an existing tab on that route if one is open, otherwise open a new one.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(targetUrl) && "focus" in client) return client.focus();
        }
        if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
      })
  );
});
