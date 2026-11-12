// ===================== DATA PANEL SUPER ADMIN (SERVER) =====================
// Membangun payload konfigurasi efektif untuk editor Panel Admin:
// daftar lengkap item dengan nilai default yang sudah digantikan override.

import { REWARD_CATALOG } from "@/lib/rewards";
import {
  ACTIVITY_SCHEDULE,
  DAILY_ROUTINE_DEFS,
  WORSHIP_SCHEDULE,
  type ReligionKey,
} from "@/lib/routines";
import {
  ECONOMY_DEFAULTS,
  FEATURE_FLAG_DEFS,
  effectiveCheckinRewards,
  getSystemConfig,
  type EconomyConfig,
  type FeatureFlagDef,
} from "@/lib/system-config";

export interface AdminActivityRow {
  key: string;
  label: string;
  description: string;
  amount: number;
  dailyCap: number;
}

export interface AdminScheduleRow {
  key: string;
  title: string;
  time: string;
  religion: string | null;
  rewardMp: number;
}

export interface AdminRoutineRow {
  key: string;
  title: string;
  rewardMp: number;
}

export interface AdminConfigPayload {
  features: FeatureFlagDef[];
  flags: Record<string, boolean>;
  activities: AdminActivityRow[];
  checkin: number[];
  schedule: AdminScheduleRow[];
  routines: AdminRoutineRow[];
  appointment: { amount: number; dailyCap: number };
  economy: EconomyConfig;
}

/** Bangun seluruh daftar nilai efektif untuk Panel Admin (satu fetch). */
export async function buildAdminConfigPayload(): Promise<AdminConfigPayload> {
  const cfg = await getSystemConfig();
  const actOv = cfg.rewards.activities;
  const schOv = cfg.rewards.schedule;
  const rouOv = cfg.rewards.routines;
  const apOv = cfg.rewards.appointment;

  const activities: AdminActivityRow[] = REWARD_CATALOG.map((d) => {
    const o = actOv?.[d.key];
    return {
      key: d.key,
      label: d.label,
      description: d.description,
      amount: typeof o?.amount === "number" ? o.amount : d.amount,
      dailyCap: typeof o?.dailyCap === "number" ? Math.max(1, o.dailyCap) : d.dailyCap,
    };
  });

  const schedule: AdminScheduleRow[] = [
    ...ACTIVITY_SCHEDULE.map((a) => ({ a, religion: null as string | null })),
    ...Object.values(WORSHIP_SCHEDULE)
      .flat()
      .map((a) => ({ a, religion: (a.religion ?? null) as string | null })),
  ]
    .sort((x, y) => x.a.minutes - y.a.minutes)
    .map(({ a, religion }) => ({
      key: a.key,
      title: a.title,
      time: a.time,
      religion,
      rewardMp: schOv?.[a.key] ?? a.rewardMp,
    }));

  const routines: AdminRoutineRow[] = DAILY_ROUTINE_DEFS.map((d) => ({
    key: d.key,
    title: d.title,
    rewardMp: rouOv?.[d.key] ?? d.rewardMp,
  }));

  const appointment = {
    amount: typeof apOv?.amount === "number" ? apOv.amount : 10_000,
    dailyCap: typeof apOv?.dailyCap === "number" ? Math.max(1, Math.round(apOv.dailyCap)) : 5,
  };

  return {
    features: FEATURE_FLAG_DEFS,
    flags: cfg.flags,
    activities,
    checkin: effectiveCheckinRewards(cfg.rewards),
    schedule,
    routines,
    appointment,
    economy: cfg.economy ?? ECONOMY_DEFAULTS,
  };
}

/** Key agama valid (untuk validasi PATCH pengguna). */
export const VALID_RELIGIONS: readonly string[] = ["islam", "kristen", "katolik", "hindu", "buddha", "khonghucu"] satisfies readonly ReligionKey[];
