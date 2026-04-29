// Service Worker for Mission 31 PWA
// Strategy: cache-first for app shell, network-first for navigation.
// In local development (localhost), the SW is a pass-through to avoid
// serving stale JS modules during hot-module-reload.

const VERSION = "mission31-v1";
const IS_DEV = self.location.hostname === "localhost"
  || self.location.hostname === "127.0.0.1";

const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/favicon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(SHELL).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  // Dev: always go to network, never cache.
  if (IS_DEV) {
    event.respondWith(fetch(req).catch(() => caches.match(req)));
    return;
  }

  const url = new URL(req.url);

  // Skip cross-origin requests (e.g. Google Fonts).
  if (url.origin !== location.origin) {
    event.respondWith(fetch(req).catch(() => caches.match(req)));
    return;
  }

  // Navigation: network first, fallback to cached shell (offline).
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => caches.match("./index.html"))
    );
    return;
  }

  // Everything else: cache-first.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((cache) => cache.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match("./index.html"));
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: "window" }).then((list) => {
    if (list.length > 0) return list[0].focus();
    return self.clients.openWindow("./");
  }));
});
