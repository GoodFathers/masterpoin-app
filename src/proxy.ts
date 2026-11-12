// ===================== PROXY KEAMANAN API (BATCH 1) — konvensi Next 16 (middleware.ts → proxy.ts) =====================
// Tembok autentikasi tunggal untuk seluruh /api/*: setiap permintaan data
// WAJIB membawa sesi valid (header `Authorization: Bearer` atau cookie),
// kecuali daftar endpoint publik di bawah. Tanpa ini, 60+ route mutasi
// (hapus chat, unggah berkas, hingga penghapusan seluruh database di
// /api/account/delete) terbuka untuk siapa pun.
//
// Pemeriksaan PERAN (mis. SUPER_ADMIN untuk hapus/pulihkan akun) tetap di
// route handler lewat requireRole/requireSuperAdmin karena butuh DB.

import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session-constants";
import { verifySessionTokenEdge } from "@/lib/edge-auth";

/** Endpoint publik: tak butuh sesi (login, registrasi, cek sesi, pratinjau ID). */
const PUBLIC_API = new Set([
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/me",
  "/api/auth/access-id",
]);

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_API.has(pathname)) return NextResponse.next();

  const auth = req.headers.get("authorization");
  const bearer =
    auth && auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : null;
  const token = bearer || req.cookies.get(SESSION_COOKIE)?.value || null;

  const session = await verifySessionTokenEdge(token);
  if (!session) {
    return NextResponse.json(
      { error: "Sesi tidak valid atau berakhir. Silakan masuk kembali." },
      { status: 401 }
    );
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
