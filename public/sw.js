// Service Worker untuk Master • Poin • Digital
// Versi dinamis agar browser langsung mendeteksi pembaruan
const SW_VERSION = "master-sw-v2.1-" + Date.now();
const STATIC_CACHE = "master-static-" + SW_VERSION;

// Install: Lewati masa tunggu agar langsung aktif
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

// Activate: Hapus SEMUA cache lama agar data lama tidak tersisa
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== STATIC_CACHE) {
            console.log("[SW] Menghapus cache lama:", cacheName);
            return caches.delete(cacheName);
          }
        }),
      );
    }).then(() => self.clients.claim()),
  );
});

// Pesan dari client untuk force reload / update
self.addEventListener("message", (event) => {
  if (event.data && event.data.action === "SKIP_WAITING") {
    self.skipWaiting();
  }
  if (event.data && event.data.action === "CLEAR_ALL_CACHES") {
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))));
  }
});

// Fetch: NETWORK-ONLY untuk navigasi HTML & API.
// Tidak boleh ada HTML halaman web yang tersimpan di cache lokal!
// Ini menjamin setiap kali ada perubahan di web app, HP mobile langsung
// menerima tampilan & data terbaru tanpa harus instal ulang.
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Permintaan navigasi halaman HTML (buka halaman, pindah menu, reload):
  // Wajib ambil dari jaringan (Network Only dengan bypass cache)
  if (request.mode === "navigate" || request.destination === "document") {
    event.respondWith(
      fetch(request, { cache: "no-cache" }).catch(() => {
        // Fallback hanya jika benar-benar offline tanpa sinyal sama sekali
        return caches.match(request);
      }),
    );
    return;
  }

  // 2. Permintaan API atau mutasi: JANGAN PERNAH DI-CACHE
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  // 3. Asset gambar/ikon: Network-First dengan fallback
  if (request.destination === "image" || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request)),
    );
    return;
  }

  // 4. Default: fetch langsung dari jaringan
  event.respondWith(fetch(request));
});
