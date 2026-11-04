import { getCurrentUser, jsonError } from "@/lib/auth";
import { getAdminRequests, getAdminStats } from "@/lib/data";
import { isAdmin } from "@/lib/roles";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sesi berakhir.", 401);
  if (!isAdmin(user.role)) return jsonError("Hanya admin atau super admin yang dapat mengakses halaman ini.", 403);
  const [requests, stats] = await Promise.all([getAdminRequests(), getAdminStats()]);
  return Response.json({ ok: true, requests, stats });
}
