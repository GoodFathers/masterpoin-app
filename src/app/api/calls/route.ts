import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, bad } from "@/lib/api-helpers";
import { getAuthUser } from "@/lib/auth";
import { awardMp } from "@/lib/rewards";

// GET /api/calls
export async function GET() {
  try {
    const calls = await db.callLog.findMany({ orderBy: { createdAt: "desc" } });
    return ok({ calls });
  } catch (err) {
    console.error("GET /api/calls error:", err);
    return ok({ calls: [] });
  }
}

// DELETE /api/calls — bersihkan seluruh riwayat panggilan
export async function DELETE() {
  try {
    const res = await db.callLog.deleteMany({});
    return ok({ deleted: res.count });
  } catch (err) {
    console.error("DELETE /api/calls error:", err);
    return bad("Gagal membersihkan riwayat panggilan", 500);
  }
}

// POST /api/calls — { contactId, kind: VOICE|VIDEO, direction?: IN|OUT|MISSED, durationSec }
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      contactId?: string;
      kind?: string;
      direction?: string;
      durationSec?: number;
    };

    const contact = body.contactId ? await db.contact.findUnique({ where: { id: body.contactId } }) : null;
    const kind = body.kind === "VIDEO" ? "VIDEO" : "VOICE";
    const direction = ["IN", "OUT", "MISSED"].includes(body.direction ?? "") ? body.direction! : "OUT";
    const durationSec = Math.max(0, Math.round(Number(body.durationSec ?? 0)) || 0);

    const call = await db.callLog.create({
      data: {
        contactId: contact?.id ?? null,
        contactName: contact?.name ?? "Tanpa Nama",
        colorKey: contact?.colorKey ?? "emerald",
        kind,
        direction,
        durationSec,
      },
    });

    // Ekonomi mP: panggilan yang tercatat berhadiah mP (hanya yang tersambung)
    const me = await getAuthUser(req);
    const mp = direction !== "MISSED" ? await awardMp(me?.id, "call") : null;

    return ok({ call, mp });
  } catch (err) {
    console.error("POST /api/calls error:", err);
    return bad("Gagal menyimpan riwayat panggilan", 500);
  }
}
