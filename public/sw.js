// Service Worker for Mission 31 PWA
// Strategy: cache-first for app shell, network-first for navigation.
// In local development (localhost or Replit dev), the SW is a pass-through to
// avoid serving stale JS modules during hot-module-reload.

// VERSION is replaced at build time by a unique identifier (vite plugin),
// forcing the browser to invalidate cached assets on every deployment.
const VERSION = "mission31-__BUILD_ID__";
const IS_DEV = self.location.hostname === "localhost"
  || self.location.hostname === "127.0.0.1";

const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/favicon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
  // Texte intégral du Nouveau Testament — FR (Louis Segond 1910) + EN (KJV).
  // Précachés pour permettre la lecture 100% hors ligne dans les deux langues.
  "./bible/lsg-nt.json",
  "./bible/kjv-nt.json",
];

async function broadcast(message) {
  const clients = await self.clients.matchAll({ includeUncontrolled: true, type: "window" });
  clients.forEach((c) => c.postMessage(message));
}

async function precacheWithProgress() {
  const cache = await caches.open(VERSION);
  const total = SHELL.length;
  let done = 0;
  await broadcast({ type: "sw-cache-progress", done, total });
  for (const url of SHELL) {
    try {
      await cache.add(url);
    } catch (_) {
      // ignore individual failures so install can still complete
    }
    done++;
    await broadcast({ type: "sw-cache-progress", done, total });
  }
  await broadcast({ type: "sw-cache-done", total });
}

self.addEventListener("install", (event) => {
  event.waitUntil(precacheWithProgress());
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
