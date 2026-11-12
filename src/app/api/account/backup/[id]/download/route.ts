import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { bad } from "@/lib/api-helpers";
import { readSnapshotFile } from "../../../_backup";

export const dynamic = "force-dynamic";

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

// GET /api/account/backup/[id]/download → unduh file snapshot JSON asli (lampiran)
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

    const d = new Date(backup.createdAt);
    const stamp = `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}`;
    const filename = `backup-chat-${stamp}.json`;

    return new NextResponse(json, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(Buffer.byteLength(json, "utf8")),
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("GET /api/account/backup/[id]/download", e);
    return bad("Gagal mengunduh backup", 500);
  }
}
