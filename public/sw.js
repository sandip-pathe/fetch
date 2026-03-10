const CACHE_NAME = "fetch-app-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(["/", "/index.html"])),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)),
        ),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  // Only handle same-origin GET requests
  if (request.method !== "GET" || !request.url.startsWith(self.location.origin))
    return;
  // Let Firebase / API calls go straight to network — never cache auth/data
  if (/firestore|googleapis|identitytoolkit|firebase|\/api\//.test(request.url))
    return;

  event.respondWith(
    caches.match(request).then((cached) => {
      const networkReq = fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((c) => c.put(request, clone));
          }
          return response;
        })
        .catch(() => cached);
      // Return cached immediately if available, update in background
      return cached || networkReq;
    }),
  );
});
