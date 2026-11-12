import { db } from "@/lib/db";
import { ok } from "@/lib/api-helpers";

// GET /api/stats → { totals, daily(14 asc), byType, topChats }
export async function GET() {
  const [daily, byTypeRaw, topChatRaw, topChatDefs] = await Promise.all([
    db.dailyStat.findMany({ orderBy: { date: "asc" } }),
    db.message.groupBy({ by: ["type"], _count: { type: true } }),
    db.message.groupBy({
      by: ["chatId"],
      _count: { chatId: true },
      orderBy: { _count: { chatId: "desc" } },
      take: 5,
    }),
    db.chat.findMany({
      select: { id: true, name: true, type: true, contact: { select: { name: true } } },
    }),
  ]);

  const totals = daily.reduce(
    (acc, d) => ({
      sent: acc.sent + d.sent,
      delivered: acc.delivered + d.delivered,
      read: acc.read + d.read,
      received: acc.received + d.received,
      failed: acc.failed + d.failed,
    }),
    { sent: 0, delivered: 0, read: 0, received: 0, failed: 0 }
  );

  const byType: Record<string, number> = {};
  for (const row of byTypeRaw) byType[row.type] = row._count.type;

  const chatName = new Map<string, string>();
  for (const c of topChatDefs) {
    chatName.set(c.id, c.type === "GROUP" ? (c.name ?? "Grup") : (c.contact?.name ?? c.name ?? "Tanpa nama"));
  }

  const topChats = topChatRaw.map((row) => ({
    name: chatName.get(row.chatId) ?? "Chat tanpa nama",
    count: row._count.chatId,
  }));

  return ok({ totals, daily, byType, topChats });
}
