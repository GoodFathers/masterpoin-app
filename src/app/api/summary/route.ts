import { getCurrentUser, jsonError } from "@/lib/auth";
import { getSummary } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sesi berakhir. Silakan masuk kembali.", 401);
  const summary = await getSummary(user.id);
  if (!summary) return jsonError("Pengguna tidak ditemukan.", 404);
  return Response.json({ ok: true, summary });
}
