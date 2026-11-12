import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import type { User } from "@prisma/client";
import type { Role, SafeUser } from "@/lib/user";
import { parsePerms, isValidDashboard } from "@/lib/user";
import { SESSION_COOKIE } from "@/lib/session-constants";

export type { Role };
export { roleLabel } from "@/lib/user";
export { SESSION_COOKIE };
const MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30 hari

// Rahasia HMAC — WAJIB berasal dari environment. Fallback statis hanya
// dimainkan di non-production; production tanpa AUTH_SECRET gagal-cepat
// agar token tidak bisa dipalsukan dengan rahasia bawaan yang diketahui.
// PENTING (fix build Vercel): validasi dibuat LAZY — dievaluasi saat dipakai
// (request-time), bukan saat modul di-import. Next.js "collect page data"
// meng-import modul route saat build; throw pada level import membuat build
// production gagal sebelum ada request yang benar-benar berjalan.
const DEV_FALLBACK_SECRET = "indigoo-dev-secret-change-me";

function getSecret(): string {
  const secret = process.env.AUTH_SECRET ?? DEV_FALLBACK_SECRET;
  if (process.env.NODE_ENV === "production" && secret === DEV_FALLBACK_SECRET) {
    throw new Error(
      "AUTH_SECRET wajib diisi di environment production (set env AUTH_SECRET di Vercel/server)"
    );
  }
  return secret;
}

/** Petakan User DB → payload aman tanpa password (untuk respons API). */
export function toSafeUser(u: User): SafeUser {
  return {
    id: u.id,
    accessId: u.accessId,
    username: u.username,
    name: u.name,
    role: (u.role === "SUPER_ADMIN" || u.role === "ADMIN" ? u.role : "USER") as Role,
    active: u.active,
    createdAt: u.createdAt.toISOString(),
    // Permohonan aktivasi Timer mP
    activationStatus: u.activationStatus,
    activationRequestedAt: u.activationRequestedAt ? u.activationRequestedAt.toISOString() : null,
    activationProcessedAt: u.activationProcessedAt ? u.activationProcessedAt.toISOString() : null,
    // Hak akses & dasbor (Super Admin)
    perms: parsePerms(u.perms),
    dashboard: isValidDashboard(u.dashboard) ? u.dashboard : "beranda",
  };
}

// ===================== PASSWORD (scrypt) =====================

export function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(plain, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(plain, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

// ===================== SESSION TOKEN (HMAC) =====================

interface SessionPayload {
  uid: string;
  exp: number; // epoch ms
}

function b64url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64url");
}

export function createSessionToken(uid: string): string {
  const payload: SessionPayload = { uid, exp: Date.now() + MAX_AGE_SEC * 1000 };
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac("sha256", getSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifySessionToken(token: string | undefined | null): SessionPayload | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", getSecret()).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as SessionPayload;
    if (!payload.uid || typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

// ===================== USER SAAT INI =====================

/**
 * Ambil token sesi dari permintaan:
 * 1) header `Authorization: Bearer <token>` (utama di konteks iframe/preview
 *    yang memblokir cookie pihak ketiga),
 * 2) cookie session (jalur klasik same-origin).
 */
export function getSessionToken(req: NextRequest): string | null {
  const auth = req.headers.get("authorization");
  if (auth && auth.toLowerCase().startsWith("bearer ")) {
    const t = auth.slice(7).trim();
    if (t) return t;
  }
  return req.cookies.get(SESSION_COOKIE)?.value ?? null;
}

/** Ambil user dari token sesi (header Bearer atau cookie). */
export async function getAuthUser(req: NextRequest): Promise<User | null> {
  const payload = verifySessionToken(getSessionToken(req));
  if (!payload) return null;
  const user = await db.user.findUnique({ where: { id: payload.uid } });
  return user ?? null;
}

/** Opsi cookie untuk set/clear session — adaptif konteks preview. */
export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: MAX_AGE_SEC,
  secure: process.env.NODE_ENV === "production",
};

/**
 * Opsi cookie SESUAI konteks permintaan:
 * - Via HTTPS (mis. panel preview yang mem-prox lewat domain eksternal):
 *   SameSite=None + Secure agar cookie boleh disimpan/dikirim dalam IFRAME
 *   lintas-situs (kebijakan cookie pihak ketiga browser).
 * - Via HTTP/localhost (dev langsung): SameSite=Lax seperti biasa.
 * Catatan: token sesi juga dikirim via header `Authorization: Bearer` oleh
 * client (lihat src/lib/session-token.ts) sehingga login tetap berfungsi
 * bahkan bila cookie pihak ketiga diblokir total oleh browser.
 */
export function sessionCookieOptionsFor(req: NextRequest) {
  const proto =
    req.headers.get("x-forwarded-proto") ??
    (process.env.NODE_ENV === "production" ? "https" : "http");
  if (proto.split(",")[0]?.trim() === "https") {
    return { ...sessionCookieOptions, sameSite: "none" as const, secure: true };
  }
  return { ...sessionCookieOptions, sameSite: "lax" as const, secure: false };
}
