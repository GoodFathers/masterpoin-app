import { getCurrentUser, jsonError } from "@/lib/auth";
import { getRewardsCatalog } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sesi berakhir.", 401);
  const data = await getRewardsCatalog(user.id);
  return Response.json({ ok: true, ...data });
}
