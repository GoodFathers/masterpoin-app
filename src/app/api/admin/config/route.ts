import type { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { ok, bad } from "@/lib/api-helpers";
import { requireRole, requireSuperAdmin } from "@/lib/admin-guard";
import { buildAdminConfigPayload } from "@/lib/admin-data";
import {
  invalidateSystemConfigCache,
  sanitizeEconomyConfig,
  sanitizeFeatureFlags,
  sanitizeRewardOverrides,
} from "@/lib/system-config";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/config — konfigurasi efektif (flag + seluruh nilai mP + ketentuan ekonomi).
 * Diakses SUPER_ADMIN & ADMIN (hak akses dasbor manajemen).
 */
export async function GET(req: NextRequest) {
  const guard = await requireRole(req, ["SUPER_ADMIN", "ADMIN"]);
  if (!guard.ok) return guard.res;
  return ok({ config: await buildAdminConfigPayload() });
}

/**
 * PUT /api/admin/config — simpan konfigurasi dari Panel Admin.
 * Body: { features?, rewards?, economy? }
 * Diakses SUPER_ADMIN & ADMIN. Sanitasi ketat: hanya key dikenal,
 * angka ≥ 0, checkin tepat 30 nilai.
 */
export async function PUT(req: NextRequest) {
  const guard = await requireRole(req, ["SUPER_ADMIN", "ADMIN"]);
  if (!guard.ok) return guard.res;

  try {
    const body = (await req.json()) as { features?: unknown; rewards?: unknown; economy?: unknown };
    const features = sanitizeFeatureFlags(body.features);
    const rewards = sanitizeRewardOverrides(body.rewards);
    const economy = sanitizeEconomyConfig(body.economy);

    const writes: Prisma.PrismaPromise<unknown>[] = [];
    if (body.features !== undefined) {
      writes.push(
        db.systemConfig.upsert({
          where: { key: "features" },
          create: { key: "features", value: JSON.stringify(features) },
          update: { value: JSON.stringify(features) },
        }),
      );
    }
    if (body.rewards !== undefined) {
      writes.push(
        db.systemConfig.upsert({
          where: { key: "rewards" },
          create: { key: "rewards", value: JSON.stringify(rewards) },
          update: { value: JSON.stringify(rewards) },
        }),
      );
    }
    if (body.economy !== undefined) {
      writes.push(
        db.systemConfig.upsert({
          where: { key: "economy" },
          create: { key: "economy", value: JSON.stringify(economy) },
          update: { value: JSON.stringify(economy) },
        }),
      );
    }
    if (writes.length > 0) await db.$transaction(writes);

    invalidateSystemConfigCache();
    return ok({ config: await buildAdminConfigPayload() });
  } catch (err) {
    console.error("PUT /api/admin/config error:", err);
    return bad("Gagal menyimpan konfigurasi", 500);
  }
}

/**
 * DELETE /api/admin/config — kembalikan SEMUA ke default bawaan kode
 * (hapus baris konfigurasi; semua fitur menyala, nilai mP kembali awal).
 */
export async function DELETE(req: NextRequest) {
  const guard = await requireSuperAdmin(req);
  if (!guard.ok) return guard.res;

  try {
    await db.systemConfig.deleteMany({});
    invalidateSystemConfigCache();
    return ok({ config: await buildAdminConfigPayload() });
  } catch (err) {
    console.error("DELETE /api/admin/config error:", err);
    return bad("Gagal mengembalikan konfigurasi default", 500);
  }
}
