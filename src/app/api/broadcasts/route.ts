import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, bad } from "@/lib/api-helpers";

export async function GET() {
  try {
    const [broadcasts, labels] = await Promise.all([
      db.broadcast.findMany({ orderBy: { createdAt: "desc" } }),
      db.label.findMany(),
    ]);
    const labelMap = new Map(labels.map((l) => [l.id, l.name]));
    const withNames = broadcasts.map((b) => ({
      ...b,
      audienceLabelName: b.audienceLabel ? labelMap.get(b.audienceLabel) ?? null : null,
    }));
    return ok({ broadcasts: withNames });
  } catch (e) {
    console.error("GET /api/broadcasts", e);
    return bad("Gagal memuat daftar siaran", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return bad("Body tidak valid");
    const b = body as Record<string, unknown>;

    const name = typeof b.name === "string" ? b.name.trim() : "";
    if (!name) return bad("Nama siaran wajib diisi");
    const message = typeof b.message === "string" ? b.message.trim() : "";
    if (!message) return bad("Isi pesan siaran wajib diisi");
    if (message.length > 1024) return bad("Pesan maksimal 1024 karakter");

    const audienceType = b.audienceType === "LABEL" ? "LABEL" : "ALL";
    let audienceLabel: string | null = null;
    if (audienceType === "LABEL") {
      audienceLabel = typeof b.audienceLabel === "string" ? b.audienceLabel : "";
      if (!audienceLabel) return bad("Pilih label audiens terlebih dahulu");
      const label = await db.label.findUnique({ where: { id: audienceLabel } });
      if (!label) return bad("Label tidak ditemukan");
    }

    const broadcast = await db.broadcast.create({
      data: {
        name,
        message,
        mediaUrl: typeof b.mediaUrl === "string" && b.mediaUrl ? b.mediaUrl : null,
        audienceType,
        audienceLabel,
        status: "DRAFT",
      },
    });
    return ok({ broadcast });
  } catch (e) {
    console.error("POST /api/broadcasts", e);
    return bad("Gagal membuat siaran", 500);
  }
}
