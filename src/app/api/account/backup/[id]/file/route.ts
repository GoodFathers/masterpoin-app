import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { bad } from "@/lib/api-helpers";
import { readSnapshotFile } from "../../../_backup";

export const dynamic = "force-dynamic";

// GET /api/account/backup/[id]/file → isi snapshot JSON asli (internal, mis. untuk restore)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const backup = await db.chatBackup.findUnique({ where: { id } });
    if (!backup) return bad("Backup tidak ditemukan", 404);

    let json: string;
    try {
      json = await readSnapshotFile(id);
    } catch {
      return bad("File backup tidak ditemukan", 404);
    }

    return new NextResponse(json, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("GET /api/account/backup/[id]/file", e);
    return bad("Gagal membaca file backup", 500);
  }
}
