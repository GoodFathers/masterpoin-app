import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, bad } from "@/lib/api-helpers";
import { getAuthUser } from "@/lib/auth";
import { ensureUserProfile } from "@/lib/profile-server";

const VIS_VALUES = ["everyone", "contacts", "nobody"];

// Field privasi & notifikasi yang boleh diubah lewat /api/privacy
const PRIVACY_FIELDS = [
  "lastSeen",
  "onlineStatus",
  "profilePhotoVis",
  "statusVis",
  "readReceipts",
  "twoStepEnabled",
  "blockedStrangers",
  "notifMessages",
  "notifGroups",
  "notifCalls",
  "notifPreview",
  "notifSound",
] as const;

type PrivacyField = (typeof PRIVACY_FIELDS)[number];

// GET /api/privacy → { profile } — preferensi privasi & notifikasi milik sesi (Task 34)
export async function GET(req: NextRequest) {
  const me = await getAuthUser(req);
  if (!me) return bad("Belum masuk", 401);
  const profile = await ensureUserProfile(me);
  return ok({ profile });
}

// PATCH /api/privacy → perbarui preferensi privasi & notifikasi (milik sesi — Task 34)
export async function PATCH(req: NextRequest) {
  const me = await getAuthUser(req);
  if (!me) return bad("Belum masuk", 401);

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return bad("Body tidak valid");

  const data: Record<string, string | boolean> = {};
  let touched = 0;

  for (const field of PRIVACY_FIELDS) {
    if (!(field in body)) continue;
    const value = body[field];

    if (["lastSeen", "onlineStatus", "profilePhotoVis", "statusVis"].includes(field)) {
      if (typeof value !== "string" || !VIS_VALUES.includes(value)) {
        return bad(`Nilai ${field} harus salah satu dari: everyone | contacts | nobody`);
      }
      data[field] = value;
      touched++;
    } else if (typeof value === "boolean") {
      data[field] = value;
      touched++;
    }
  }

  if (touched === 0) return bad("Tidak ada kolom privasi yang valid untuk diperbarui");

  await ensureUserProfile(me);
  const profile = await db.profile.update({ where: { userId: me.id }, data });
  return ok({ profile });
}
