import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, bad } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

// DELETE /api/devices/[id] → keluarkan perangkat (nyata).
// Bila yang dikeluarkan adalah perangkat pemanggil (cocok dengan header X-Device-Id
// atau bertanda current) → { self: true } agar UI memicu alur keluar.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const device = await db.device.findUnique({ where: { id } });
  if (!device) return bad("Perangkat tidak ditemukan", 404);

  const callerId = req.headers.get("x-device-id")?.trim() ?? "";
  const self = (callerId !== "" && callerId === id) || device.current;

  await db.device.delete({ where: { id } });
  return ok({ success: true, self });
}
