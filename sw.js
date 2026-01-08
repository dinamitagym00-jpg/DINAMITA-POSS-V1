/* Dinamita POS v0 - Service Worker (basic offline)
   Cache name rev: d9e1bdf6a9
*/
const CACHE_NAME = 'dinamita-pos-v0-d9e1bdf6a9';
const PRECACHE_URLS = [
  "./assets/css/app.css",
  "./assets/icons/icon-192-maskable.png",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512-maskable.png",
  "./assets/icons/icon-512.png",
  "./assets/js/app.js",
  "./assets/js/store.js",
  "./index.html",
  "./manifest.webmanifest",
  "./modules/acceso/acceso.css",
  "./modules/acceso/acceso.html",
  "./modules/acceso/acceso.js",
  "./modules/bodega/bodega.css",
  "./modules/bodega/bodega.html",
  "./modules/bodega/bodega.js",
  "./modules/clientes/clientes.css",
  "./modules/clientes/clientes.html",
  "./modules/clientes/clientes.js",
  "./modules/configuracion/configuracion.css",
  "./modules/configuracion/configuracion.html",
  "./modules/configuracion/configuracion.js",
  "./modules/dashboard/dashboard.css",
  "./modules/dashboard/dashboard.html",
  "./modules/dashboard/dashboard.js",
  "./modules/gastos/gastos.css",
  "./modules/gastos/gastos.html",
  "./modules/gastos/gastos.js",
  "./modules/historial/historial.css",
  "./modules/historial/historial.html",
  "./modules/historial/historial.js",
  "./modules/inventario/inventario.css",
  "./modules/inventario/inventario.html",
  "./modules/inventario/inventario.js",
  "./modules/membresias/membresias.css",
  "./modules/membresias/membresias.html",
  "./modules/membresias/membresias.js",
  "./modules/pagina/pagina.css",
  "./modules/pagina/pagina.html",
  "./modules/pagina/pagina.js",
  "./modules/reportes/reportes.css",
  "./modules/reportes/reportes.html",
  "./modules/reportes/reportes.js",
  "./modules/ventas/ventas.css",
  "./modules/ventas/ventas.html",
  "./modules/ventas/ventas.js"
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k.startsWith('dinamita-pos-v0-') && k !== CACHE_NAME)
          .map((k) => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle same-origin
  if (url.origin !== self.location.origin) return;

  // Navigation: serve cached index.html, then network fallback
  if (req.mode === 'navigate') {
    event.respondWith(
      caches.match('./index.html').then((cached) => cached || fetch(req))
    );
    return;
  }

  // Cache-first for static assets
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        const copy = res.clone();
        // Cache successful GET responses
        if (req.method === 'GET' && res.status === 200) {
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        }
        return res;
      }).catch(() => cached);
    })
  );
});
