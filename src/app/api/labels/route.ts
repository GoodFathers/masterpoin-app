import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, bad } from "@/lib/api-helpers";
import { getAuthUser } from "@/lib/auth";
import { awardMp } from "@/lib/rewards";
import { VALID_COLOR_KEYS } from "@/components/business/types";

function parseIds(json: string): string[] {
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export async function GET() {
  try {
    const [labels, contactsRaw] = await Promise.all([
      db.label.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
      db.contact.findMany({ orderBy: { name: "asc" } }),
    ]);
    const labelMap = new Map(labels.map((l) => [l.id, l]));
    const contacts = contactsRaw.map((c) => {
      const ids = parseIds(c.labelIds);
      return {
        ...c,
        labels: ids.map((id) => labelMap.get(id)).filter((x): x is (typeof labels)[number] => Boolean(x)),
      };
    });
    return ok({ labels, contacts });
  } catch (e) {
    console.error("GET /api/labels", e);
    return bad("Gagal memuat label", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return bad("Body tidak valid");
    const b = body as Record<string, unknown>;

    const name = typeof b.name === "string" ? b.name.trim() : "";
    if (!name) return bad("Nama label wajib diisi");

    const colorKey =
      typeof b.colorKey === "string" && (VALID_COLOR_KEYS as readonly string[]).includes(b.colorKey) ? b.colorKey : "amber";

    const dup = await db.label.findFirst({ where: { name } });
    if (dup) return bad("Label dengan nama itu sudah ada");

    const max = await db.label.aggregate({ _max: { sortOrder: true } });
    const label = await db.label.create({ data: { name, colorKey, sortOrder: (max._max.sortOrder ?? 0) + 1 } });
    // Ekonomi mP: menambah label pelanggan berhadiah mP
    const me = await getAuthUser(req);
    const mp = await awardMp(me?.id, "label_add");
    return ok({ label, mp });
  } catch (e) {
    console.error("POST /api/labels", e);
    return bad("Gagal menambah label", 500);
  }
}
