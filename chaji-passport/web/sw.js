// Offline shell for the installed passport. Card data comes from the API when online.
const CACHE = "hy-passport-v3";
const SHELL = ["./", "./index.html", "./teas.js", "./manifest.webmanifest", "./icon.svg",
  ...["1-harvesting", "2-steaming", "3-rolling", "4-kneading", "5-second-rolling", "6-shaping", "7-drying", "8-hojicha"].map((n) => `./art/${n}.png`),
  ...["seating", "mural", "shelves", "matcha", "tins", "shopfront"].map((n) => `./photo/${n}.jpg`)];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Network first so prices and stock stay fresh; cache when offline (e.g. mall basement).
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match("./index.html"))),
  );
});
