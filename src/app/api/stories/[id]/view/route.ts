import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, bad } from "@/lib/api-helpers";

// POST /api/stories/[id]/view → views + 1
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const story = await db.story.findUnique({ where: { id } });
  if (!story) return bad("Status tidak ditemukan", 404);

  const updated = await db.story.update({
    where: { id },
    data: { views: { increment: 1 } },
  });

  return ok({ ok: true, views: updated.views });
}
