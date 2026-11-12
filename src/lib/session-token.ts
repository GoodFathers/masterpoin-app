// ===================== JEMBATAN TOKEN SESI INDIIGOO =====================
// Alasan: panel preview menjalankan aplikasi dalam IFRAME lintas-situs, dan
// browser modern memblokir cookie pihak ketiga (SameSite=Lax tidak pernah
// disimpan) — login tampak gagal walau server mengembalikan 200.
// Solusi: server mengembalikan TOKEN sesi di body login/register/me; client
// menyimpannya di localStorage dan jembatan fetch di bawah otomatis menyisip
// header `Authorization: Bearer <token>` pada setiap permintaan /api/ yang
// sama-origin. Cookie tetap dipakai sebagai jalur utama bila tersedia.

const TOKEN_KEY = "indigoo:token";

/** Simpan token sesi (dipanggil setelah login/register/me sukses). */
export function saveSessionToken(token: string | null | undefined): void {
  if (typeof window === "undefined" || !token) return;
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // storage diblokir — jalur cookie tetap berlaku
  }
}

/** Hapus token sesi (saat logout). */
export function clearSessionToken(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // abaikan
  }
}

/** Ambil token sesi tersimpan (null bila tidak ada). */
export function getSessionToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

let bridgeInstalled = false;

/**
 * Pasang SEKALI: bungkus window.fetch agar setiap permintaan SAME-ORIGIN yang
 * dimulai dengan "/api/" membawa header Authorization bila token tersedia.
 * Aman terhadap patch fetch lain (mis. MpAwardToaster) dan tidak mengubah
 * respons sama sekali. Dipanggil otomatis saat modul sesi dimuat.
 */
export function installAuthHeaderBridge(): void {
  if (bridgeInstalled || typeof window === "undefined") return;
  if (typeof window.fetch !== "function") return;
  bridgeInstalled = true;

  const originalFetch = window.fetch.bind(window);

  const patched: typeof fetch = (input, init) => {
    try {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.pathname + input.search
            : new URL(input.url, window.location.origin).pathname + new URL(input.url, window.location.origin).search;

      const isApiCall = url === "/api" || url.startsWith("/api/");
      const token = getSessionToken();

      if (isApiCall && token) {
        const existing = new Headers(
          init?.headers ??
            (input instanceof Request ? input.headers : undefined)
        );
        if (!existing.has("authorization")) {
          existing.set("authorization", `Bearer ${token}`);
          const nextInit: RequestInit = { ...(init ?? {}), headers: existing };
          return originalFetch(input, nextInit);
        }
      }
    } catch {
      // Kegagalan menyisip header tidak boleh menggagalkan permintaan
    }
    return originalFetch(input, init);
  };

  window.fetch = patched;
}

// Pasang sedini mungkin — sebelum fetch pertama /api/auth/me dijalankan.
installAuthHeaderBridge();
