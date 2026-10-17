const KAGIE_CACHE = "kagie-shell-v20261017-login-reference";
const SHELL_ASSETS = [
  "/js/yoco-payment.js?v=20261015-yoco",
  "/css/yoco-payment.css?v=20261015-yoco",
  "/js/native-auth-return.js?v=20261014-google-login",
  "/js/backend.js?v=20261015-backend-audit",
  "/images/logos/app-logo.jpg",
  "/images/logos/kagie-loading-arrow.svg",
  "/splash.html",
  "/css/kagie-splash.css?v=20261014-palette-blue",
  "/js/kagie-splash.js?v=20261014-palette-blue",
  "/js/auth-experience.js?v=20261014-google-login",
  "/css/student-workspace.css?v=20261014-palette-blue",
  "/css/student-home.css?v=20261014-palette-blue",
  "/css/auth-pages.css?v=20261014-google-login",
  "/css/student-cart.css?v=20261014-palette-blue",
  "/css/information-pages.css?v=20261014-palette-blue",
  "/css/kagie-brand-colors.css?v=20261014-palette-blue",
  "/css/app-foundation.css?v=20261014-palette-blue",
  "/js/app-foundation.js?v=20261014-palette-blue",
  "/css/bottom-nav.css?v=20261014-palette-blue",
  "/js/bottom-nav.js?v=20261014-palette-blue",
  "/js/dob-wheel-picker.js?v=20261014-palette-blue",
  "/",
  "/index.html",
  "/login.html",
  "/android-app.html",
  "/home.html",
  "/Dashboard.html",
  "/upload.html",
  "/css/upload-page.css?v=20261014-documents-ui",
  "/js/upload-page.js?v=20261014-documents-ui",
  "/forms.html",
  "/css/apply-page.css?v=20261014-palette-blue",
  "/profile.html",
  "/updates.html",
  "/css/updates-page.css?v=20261014-palette-blue",
  "/js/updates-page.js?v=20261014-palette-blue",
  "/images/updates-campus.webp",
  "/recommendation.html",
  "/css/recommendation-page.css?v=20261014-palette-blue",
  "/js/recommendation-data.js?v=20261014-palette-blue",
  "/js/recommendation-model.js?v=20261014-palette-blue",
  "/js/recommendation-page.js?v=20261014-palette-blue",
  "/prospectus.html",
  "/css/prospectus-page.css?v=20261014-palette-blue",
  "/js/prospectus-catalog.js?v=20261014-palette-blue",
  "/js/prospectus-model.js?v=20261014-palette-blue",
  "/js/prospectus-page.js?v=20261014-palette-blue",
  "/images/prospectus-student.webp",
  "/images/prospectus-empty.webp",
  "/more-service/index.html",
  "/more-service/accommodation-assist.html",
  "/css/accommodation-page.css?v=20261014-palette-blue",
  "/js/accommodation-model.js?v=20261014-palette-blue",
  "/js/accommodation-assist-page.js?v=20261014-palette-blue",
  "/images/accommodation/room-example.webp",
  "/more-service/funding-assist.html",
  "/css/more-services.css?v=20261014-palette-blue",
  "/js/more-services-icons.js?v=20261014-palette-blue",
  "/js/more-services-page.js?v=20261014-palette-blue",
  "/images/logos/app-icon.png",
  "/images/logos/app-icon-maskable.png",
  "/js/pwa-init.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(KAGIE_CACHE).then((cache) => cache.addAll(SHELL_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== KAGIE_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            event.waitUntil(caches.open(KAGIE_CACHE).then((cache) => cache.put(request, copy)).catch(() => {}));
          }
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match("/index.html")))
    );
    return;
  }

  const isStaticAsset =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/css/") ||
    url.pathname.startsWith("/js/") ||
    url.pathname.startsWith("/images/");

  if (!isStaticAsset) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then(async (response) => {
          if (!response.ok) return cached || response;
          const copy = response.clone();
          await caches.open(KAGIE_CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
          return response;
        })
        .catch(() => cached || Response.error());

      // Versioned scripts can start immediately from their matching cache entry.
      // Keep refreshing in the background, including after returning cached bytes.
      event.waitUntil(networkFetch.then(() => {}));
      if (url.pathname.startsWith("/js/") && !url.searchParams.has("v")) return networkFetch;
      return cached || networkFetch;
    })
  );
});
