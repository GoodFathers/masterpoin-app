import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, bad } from "@/lib/api-helpers";
import { getAuthUser } from "@/lib/auth";

// GET /api/location — titik lokasi terakhir SEMUA pengguna yang pernah
// berbagi lokasi (fitur "Maps di belakang layar"). Hanya untuk sesi masuk.
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return bad("Anda harus masuk terlebih dahulu", 401);

    const users = await db.user.findMany({
      where: { AND: [{ latitude: { not: null } }, { longitude: { not: null } }] },
      select: {
        id: true,
        accessId: true,
        username: true,
        role: true,
        latitude: true,
        longitude: true,
        locationAt: true,
      },
      orderBy: { locationAt: "desc" },
      take: 500,
    });
    return ok({ users });
  } catch (err) {
    console.error("GET /api/location error:", err);
    return ok({ users: [] });
  }
}

// POST /api/location — simpan/perbarui titik lokasi pengguna yang masuk.
// Body: { latitude: number, longitude: number }
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return bad("Anda harus masuk terlebih dahulu", 401);

    const body = (await req.json()) as { latitude?: unknown; longitude?: unknown };
    const lat = Number(body.latitude);
    const lng = Number(body.longitude);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) return bad("Latitude tidak valid");
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) return bad("Longitude tidak valid");

    // Bulatkan ke ~1 meter agar data rapi
    const updated = await db.user.update({
      where: { id: user.id },
      data: {
        latitude: Math.round(lat * 1e6) / 1e6,
        longitude: Math.round(lng * 1e6) / 1e6,
        locationAt: new Date(),
      },
      select: { id: true, latitude: true, longitude: true, locationAt: true },
    });
    return ok({ user: updated });
  } catch (err) {
    console.error("POST /api/location error:", err);
    return bad("Gagal menyimpan lokasi", 500);
  }
}
