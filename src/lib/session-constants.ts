// ===================== KONSTANTA SESI BERSAMA =====================
// Dipisah dari src/lib/auth.ts agar bisa di-import oleh middleware (Edge
// Runtime) tanpa menarik dependensi node:crypto / Prisma. auth.ts tetap
// me-re-export nilai ini sehingga import lama tidak rusak.

/** Nama cookie sesi — WAJIB sinkron dengan yang di-set di /api/auth/login. */
export const SESSION_COOKIE = "indigoo_session";
