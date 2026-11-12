import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, bad } from "@/lib/api-helpers";
import { requireUser } from "@/lib/admin-guard";
import { emitRealtime } from "@/lib/realtime-emit";
import { mapMessage } from "@/app/api/chats/_map";

export const dynamic = "force-dynamic";

type GroupJson = { id: string; name: string; members: number; description: string; chatId?: string };

function parseGroups(raw: string): GroupJson[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? (v as GroupJson[]) : [];
  } catch {
    return [];
  }
}

// POST /api/communities/[id]/announce { groupId, text }
// → kirim pengumuman NYATA: pesan masuk ke chat grup komunitas.
//   Chat grup dibuat otomatis (lazy) saat pengumuman pertama ke grup tersebut.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireUser(req);
  if (!guard.ok) return guard.res;
  try {
    const { id } = await params;
    const community = await db.community.findUnique({ where: { id } });
    if (!community) return bad("Komunitas tidak ditemukan", 404);

    const payload = await req.json().catch(() => null);
    const groupId = String(payload?.groupId ?? "");
    const text = String(payload?.text ?? "").trim().slice(0, 2000);
    if (!text) return bad("Isi pengumuman tidak boleh kosong");

    const groups = parseGroups(community.groups);
    const gIndex = groups.findIndex((g) => g.id === groupId);
    if (gIndex === -1) return bad("Grup tidak ditemukan di komunitas ini", 404);
    let group = groups[gIndex];
    let created = false;

    // Chat grup nyata — cari yang sudah tertaut atau buat baru (lazy)
    let chat = group.chatId ? await db.chat.findUnique({ where: { id: group.chatId } }) : null;
    if (!chat) {
      chat = await db.chat.create({
        data: {
          type: "GROUP",
          name: group.name,
          groupDesc: `Grup "${group.name}" dalam komunitas ${community.name}`,
          members: "[]",
        },
      });
      group = { ...group, chatId: chat.id, members: Math.max(group.members, community.memberCount) };
      groups[gIndex] = group;
      await db.community.update({ where: { id }, data: { groups: JSON.stringify(groups) } });
      created = true;
    }

    const msg = await db.message.create({
      data: { chatId: chat.id, sender: "me", type: "TEXT", body: text, status: "SENT" },
    });
    await db.chat.update({ where: { id: chat.id }, data: { lastMessageAt: new Date() } });

    const message = mapMessage(msg);
    // Realtime: push pesan + sinkron daftar chat ke semua perangkat/tab
    emitRealtime("chat:message", {
      chatId: chat.id,
      chatName: chat.name,
      chatType: "GROUP",
      chatMuted: false,
      message,
    });
    emitRealtime("chat:update", { chatId: chat.id });

    const updatedCommunity = created ? { ...community, groups: JSON.stringify(groups) } : community;
    return ok({ message, chat: { id: chat.id, name: chat.name }, community: updatedCommunity, created });
  } catch (e) {
    console.error("POST /api/communities/[id]/announce", e);
    return bad("Gagal mengirim pengumuman", 500);
  }
}
