import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, bad } from "@/lib/api-helpers";
import { parseUserAgent } from "./_ua";

export const dynamic = "force-dynamic";

const PLATFORMS = ["PHONE", "WEB", "DESKTOP", "TABLET"];

// GET /api/devices → { devices } — upsert "perangkat ini" dari header X-Device-Id + USER-AGENT nyata
export async function GET(req: NextRequest) {
  const deviceId = req.headers.get("x-device-id")?.trim() ?? "";
  const ua = req.headers.get("user-agent");

  if (deviceId) {
    const parsed = parseUserAgent(ua);
    const now = new Date();
    await db.device.upsert({
      where: { id: deviceId },
      update: { name: parsed.name, platform: parsed.platform, current: true, lastActive: now },
      create: {
        id: deviceId,
        name: parsed.name,
        platform: parsed.platform,
        current: true,
        lastActive: now,
        location: "Yogyakarta, Indonesia",
      },
    });
    // Hanya SATU perangkat yang berlabel "perangkat ini" — pemanggil terakhir
    await db.device.updateMany({ where: { id: { not: deviceId }, current: true }, data: { current: false } });
  }

  const devices = await db.device.findMany({
    orderBy: [{ current: "desc" }, { lastActive: "desc" }],
  });
  return ok({ devices });
}

// POST /api/devices { name, platform } → tautkan perangkat lain (nyata: baris baru di DB)
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return bad("Body tidak valid");

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return bad("Nama perangkat wajib diisi");

  const platform = PLATFORMS.includes(body.platform) ? body.platform : "WEB";

  const device = await db.device.create({
    data: {
      name,
      platform,
      current: false,
      lastActive: new Date(),
      location: "Yogyakarta, Indonesia",
    },
  });

  return ok({ device });
}
