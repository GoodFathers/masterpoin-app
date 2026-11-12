import { NextResponse } from "next/server";

// Health check — dipakai untuk cek cepat bahwa aplikasi hidup (bukan data nyata).
export async function GET() {
  return NextResponse.json({
    ok: true,
    app: "IndiGoo",
    time: new Date().toISOString(),
  });
}
