import { NextRequest } from "next/server";
import { ok } from "@/lib/api-helpers";
import { SESSION_COOKIE, sessionCookieOptionsFor } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** POST /api/auth/logout — hapus cookie session (client juga hapus token Bearer). */
export async function POST(req: NextRequest) {
  const res = ok({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptionsFor(req), maxAge: 0 });
  return res;
}
