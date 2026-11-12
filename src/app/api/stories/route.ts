import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, bad } from "@/lib/api-helpers";
import { getAuthUser } from "@/lib/auth";
import { awardMp } from "@/lib/rewards";

// GET /api/stories → { mine, contacts: [{ contactId, name, colorKey, stories }] }
export async function GET() {
  const now = new Date();
  const stories = await db.story.findMany({
    where: { expiresAt: { gt: now } },
    orderBy: { createdAt: "asc" },
  });

  const mine = stories.filter((s) => s.sender === "me");
  const others = stories.filter((s) => s.sender !== "me");

  const senderIds = Array.from(new Set(others.map((s) => s.sender)));
  const contacts = await db.contact.findMany({
    where: { id: { in: senderIds } },
  });
  const contactMap = new Map(contacts.map((c) => [c.id, c]));

  const grouped = senderIds
    .map((contactId) => {
      const contact = contactMap.get(contactId);
      if (!contact) return null;
      const storiesOf = others.filter((s) => s.sender === contactId);
      if (storiesOf.length === 0) return null;
      return {
        contactId,
        name: contact.name,
        colorKey: contact.colorKey,
        stories: storiesOf,
      };
    })
    .filter((g): g is NonNullable<typeof g> => g !== null);

  return ok({ mine, contacts: grouped });
}

// POST /api/stories → buat status baru (expiresAt = now + 24 jam)
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return bad("Body tidak valid");

  const mediaType = body.mediaType === "IMAGE" ? "IMAGE" : "TEXT";
  const text = typeof body.body === "string" ? body.body.trim() : "";
  const mediaUrl = typeof body.mediaUrl === "string" ? body.mediaUrl : "";

  if (mediaType === "TEXT" && !text) return bad("Tulis sesuatu untuk status teks");
  if (mediaType === "IMAGE" && !mediaUrl) return bad("Pilih foto untuk status");

  const story = await db.story.create({
    data: {
      sender: "me",
      mediaType,
      body: text,
      mediaUrl: mediaType === "IMAGE" ? mediaUrl : null,
      bgColor: typeof body.bgColor === "string" && body.bgColor ? body.bgColor : "emerald",
      views: 0,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  // Ekonomi mP: mengunggah status berhadiah mP
  const me = await getAuthUser(req);
  const mp = await awardMp(me?.id, "story_post");

  return ok({ story, mp });
}
