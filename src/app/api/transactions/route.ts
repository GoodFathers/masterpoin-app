import { getCurrentUser, jsonError } from "@/lib/auth";
import { getSummary, getTransactions } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sesi berakhir.", 401);
  const filter = new URL(request.url).searchParams.get("type") ?? "semua";
  const [items, summary] = await Promise.all([getTransactions(user.id, filter), getSummary(user.id)]);
  return Response.json({
    ok: true,
    items,
    balance: summary?.balance ?? 0,
  });
}
