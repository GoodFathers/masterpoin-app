import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { bad } from "@/lib/api-helpers";
import { safeContentType, isInlineable } from "@/lib/media-store";

export const dynamic = "force-dynamic";

/**
 * GET /api/media/<name> — sajikan isi berkas unggahan dari DATABASE.
 * Menemani rewrite /uploads/<kind>/<name> → /api/media/<name> (next.config)
 * sehingga seluruh URL lama maupun baru tersaji lewat satu pintu.
 *
 * Dukungan penuh: Cache-Control immutable + ETag, dan HTTP Range (206)
 * agar audio/video (rekaman suara dsb.) bisa di-seek di browser.
 * Akses baca publik — nama berkas tak terduga (timestamp + 12 hex acak).
 */

type Ctx = { params: Promise<{ name: string }> };

async function loadFile(name: string) {
  if (!name || name.length > 200) return null;
  const media = await db.media.findUnique({ where: { name } });
  const data = media?.data;
  if (!media || media.status !== "ready" || !data) return null;
  return { ...media, data }; // data disempitkan non-null untuk TS
}

function baseHeaders(name: string, mime: string, len: number): Headers {
  const h = new Headers();
  h.set("Content-Type", safeContentType(mime));
  h.set("Content-Length", String(len));
  h.set("Cache-Control", "public, max-age=31536000, immutable");
  h.set("ETag", `"${name}"`);
  h.set("Accept-Ranges", "bytes");
  h.set("X-Content-Type-Options", "nosniff");
  h.set("Content-Disposition", `${isInlineable(mime) ? "inline" : "attachment"}; filename="${encodeURIComponent(name)}"`);
  return h;
}

/** Parse header Range "bytes=start-end" (suffix & open-ended didukung). */
function parseRange(range: string, size: number): { start: number; end: number } | null {
  const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
  if (!m) return null;
  const [, a, b] = m;
  let start: number;
  let end: number;
  if (a === "" && b === "") return null;
  if (a === "") {
    // suffix: bytes=-N → N byte terakhir
    const n = Number(b);
    if (!Number.isInteger(n) || n <= 0) return null;
    start = Math.max(0, size - n);
    end = size - 1;
  } else {
    start = Number(a);
    end = b === "" ? size - 1 : Number(b);
  }
  if (!Number.isInteger(start) || !Number.isInteger(end)) return null;
  if (start > end || start >= size) return null;
  end = Math.min(end, size - 1);
  return { start, end };
}

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const { name } = await ctx.params;
    const media = await loadFile(name);
    if (!media) return bad("Berkas tidak ditemukan", 404);

    const buf = Buffer.from(media.data);
    const headers = baseHeaders(name, media.mimeType, buf.length);

    const range = req.headers.get("range");
    if (range) {
      const r = parseRange(range, buf.length);
      if (!r) {
        return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${buf.length}` } });
      }
      headers.set("Content-Range", `bytes ${r.start}-${r.end}/${buf.length}`);
      headers.set("Content-Length", String(r.end - r.start + 1));
      return new Response(buf.subarray(r.start, r.end + 1), { status: 206, headers });
    }

    return new Response(buf, { status: 200, headers });
  } catch (err) {
    console.error("GET /api/media error:", err);
    return bad("Gagal memuat berkas", 500);
  }
}

export async function HEAD(_req: NextRequest, ctx: Ctx) {
  try {
    const { name } = await ctx.params;
    const media = await loadFile(name);
    if (!media) return new Response(null, { status: 404 });
    const headers = baseHeaders(name, media.mimeType, Buffer.from(media.data).length);
    return new Response(null, { status: 200, headers });
  } catch {
    return new Response(null, { status: 500 });
  }
}
