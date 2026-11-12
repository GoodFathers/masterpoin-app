// ===================== VERIFIKASI TOKEN SESI (EDGE-SAFE) =====================
// Turunan bebas-node dari verifySessionToken() di src/lib/auth.ts agar bisa
// dipakai di middleware (Edge Runtime: tanpa node:crypto, tanpa Prisma).
// Format token WAJIB tetap sinkron dengan auth.ts:
//   token = base64url(JSON({ uid, exp })) + "." + base64url(HMAC-SHA256(body, SECRET))

const enc = new TextEncoder();

function getSecret(): string {
  // Fallback dev sama seperti auth.ts — production WAJIB mengisi AUTH_SECRET.
  return process.env.AUTH_SECRET || "indigoo-dev-secret-change-me";
}

let keyPromise: Promise<CryptoKey> | null = null;
function hmacKey(): Promise<CryptoKey> {
  if (!keyPromise) {
    keyPromise = crypto.subtle.importKey(
      "raw",
      enc.encode(getSecret()),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
  }
  return keyPromise;
}

function b64urlDecodeToBytes(s: string): Uint8Array | null {
  try {
    let b64 = s.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4 !== 0) b64 += "=";
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

/** Perbandingan konstan-waktu untuk mencegah timing attack. */
function timingSafeEq(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export interface EdgeSessionPayload {
  uid: string;
}

/**
 * Verifikasi token sesi (tanda tangan HMAC + kedaluwarsa) tanpa akses DB.
 * Tidak memeriksa `active` — pemeriksaan status akun tetap di route handler
 * (requireUser) dan /api/auth/me.
 */
export async function verifySessionTokenEdge(
  token: string | null | undefined
): Promise<EdgeSessionPayload | null> {
  if (!token) return null;
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!body || !sig) return null;

  const sigBytes = b64urlDecodeToBytes(sig);
  if (!sigBytes) return null;

  try {
    const mac = new Uint8Array(
      await crypto.subtle.sign("HMAC", await hmacKey(), enc.encode(body))
    );
    if (!timingSafeEq(mac, sigBytes)) return null;

    const jsonBytes = b64urlDecodeToBytes(body);
    if (!jsonBytes) return null;
    const payload = JSON.parse(new TextDecoder().decode(jsonBytes)) as {
      uid?: unknown;
      exp?: unknown;
    };
    if (typeof payload.uid !== "string" || !payload.uid) return null;
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    return { uid: payload.uid };
  } catch {
    return null;
  }
}
