import type { NextRequest } from "next/server";
import QRCode from "qrcode";
import { ok, bad } from "@/lib/api-helpers";

// GET /api/qr?text=<url> → { dataUrl }
export async function GET(req: NextRequest) {
  const text = req.nextUrl.searchParams.get("text");
  if (!text || !text.trim()) return bad("Parameter text wajib diisi");
  if (text.length > 1000) return bad("Teks terlalu panjang (maksimal 1000 karakter)");

  const dataUrl = await QRCode.toDataURL(text.trim(), {
    width: 512,
    margin: 2,
    color: { dark: "#5e2029", light: "#ffffff" },
  });

  return ok({ dataUrl });
}
