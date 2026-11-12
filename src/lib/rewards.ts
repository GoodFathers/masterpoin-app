import { db } from "@/lib/db";
import { jakartaDay } from "@/lib/indigoo";
import { getSystemConfig } from "@/lib/system-config";

// ===================== KATALOG HADIAH AKTIVITAS INDIIGOO =====================
// Semua aktivitas di aplikasi bernilai poin mP. Setiap aktivitas memiliki
// hadiah per kejadian (amount) dan batas harian (dailyCap) agar adil.

export interface RewardDef {
  key: string;
  label: string;
  description: string;
  amount: number; // mP per kejadian
  dailyCap: number; // maks kejadian berhadiah per hari
}

export const REWARD_CATALOG: RewardDef[] = [
  { key: "chat_message", label: "Kirim Pesan Chat", description: "Setiap pesan yang Anda kirim di percakapan", amount: 2, dailyCap: 25 },
  { key: "chat_start", label: "Mulai Chat Baru", description: "Membuka percakapan baru dengan kontak", amount: 5, dailyCap: 5 },
  { key: "group_create", label: "Buat Grup", description: "Membuat grup baru bersama anggota", amount: 10, dailyCap: 3 },
  { key: "call", label: "Melakukan Panggilan", description: "Panggilan suara maupun video yang tercatat", amount: 10, dailyCap: 5 },
  { key: "story_post", label: "Unggah Status", description: "Status teks atau foto yang Anda bagikan", amount: 15, dailyCap: 3 },
  { key: "channel_follow", label: "Ikuti Channel", description: "Mengikuti channel baru", amount: 5, dailyCap: 5 },
  { key: "channel_post", label: "Buat Unggahan Channel", description: "Membagikan unggahan di channel", amount: 10, dailyCap: 3 },
  { key: "post_like", label: "Suka Unggahan", description: "Menyukai unggahan di channel", amount: 2, dailyCap: 10 },
  { key: "video_watch", label: "Poin Menonton", description: "Menonton video di Beranda (1× hadiah per video per hari)", amount: 2, dailyCap: 25 },
  { key: "video_comment", label: "Komentar Video", description: "Menulis komentar pada video Beranda", amount: 2, dailyCap: 20 },
  { key: "broadcast", label: "Kirim Siaran", description: "Menyebarkan pesan siaran ke pelanggan", amount: 20, dailyCap: 3 },
  { key: "product_add", label: "Tambah Produk Katalog", description: "Menambahkan produk ke katalog bisnis", amount: 10, dailyCap: 5 },
  { key: "label_add", label: "Tambah Label Pelanggan", description: "Mengorganisir pelanggan dengan label", amount: 5, dailyCap: 5 },
  { key: "autoreply_update", label: "Atur Balasan Otomatis", description: "Menyimpan pengaturan balasan otomatis", amount: 10, dailyCap: 1 },
  { key: "quick_reply_add", label: "Tambah Balasan Cepat", description: "Menyimpan template balasan cepat", amount: 5, dailyCap: 5 },
  { key: "profile_update", label: "Perbarui Profil Bisnis", description: "Menyimpan perubahan profil bisnis", amount: 25, dailyCap: 1 },
  { key: "verification_apply", label: "Ajukan Verifikasi Bisnis", description: "Mengajukan permohonan verifikasi", amount: 50, dailyCap: 1 },
];

const REWARD_MAP = new Map(REWARD_CATALOG.map((r) => [r.key, r]));

// ===================== PENGUJIAN HADIAH =====================

export interface MpAward {
  key: string;
  label: string;
  awarded: number; // mP baru yang diperoleh dari kejadian ini (0 bila cap tercapai)
  count: number; // kejadian berhadiah hari ini
  cap: number; // batas harian
  dayTotal: number; // total mP dari key ini hari ini
}

/**
 * Mencatat aktivitas dan menambahkan mP ke bonusMp pengguna (aman cap harian).
 * Aman dipanggil meski user tidak login — cukup lewatkan dengan userId null.
 * Nilai amount/cap mengikuti override Panel Super Admin; bila flag
 * "fitur_reward_aktivitas" dimatikan, fungsi selalu null (hadiah dijeda).
 */
export async function awardMp(userId: string | null | undefined, key: string, times = 1): Promise<MpAward | null> {
  const def = REWARD_MAP.get(key);
  if (!def || !userId || times <= 0) return null;

  const cfg = await getSystemConfig();
  if (cfg.flags.fitur_reward_aktivitas === false) return null;
  const o = cfg.rewards.activities?.[key];
  const amount = typeof o?.amount === "number" ? o.amount : def.amount;
  const dailyCap = typeof o?.dailyCap === "number" ? Math.max(1, o.dailyCap) : def.dailyCap;

  const day = jakartaDay();

  return db.$transaction(async (tx) => {
    const existing = await tx.activityLog.findUnique({
      where: { userId_key_day: { userId, key, day } },
    });
    const currentCount = existing?.count ?? 0;
    const granted = Math.max(0, Math.min(times, dailyCap - currentCount));
    const mp = granted * amount;

    const updated = await tx.activityLog.upsert({
      where: { userId_key_day: { userId, key, day } },
      create: { userId, key, day, count: granted, amount: mp },
      update: { count: { increment: granted }, amount: { increment: mp } },
    });

    if (mp > 0) {
      await tx.user.update({
        where: { id: userId },
        data: { bonusMp: { increment: mp } },
      });
    }

    return {
      key,
      label: def.label,
      awarded: mp,
      count: updated.count,
      cap: dailyCap,
      dayTotal: updated.amount,
    } satisfies MpAward;
  });
}

// ===================== RINGKASAN HARIAN =====================

export interface RewardProgress extends RewardDef {
  count: number; // kejadian hari ini
  dayAmount: number; // mP diperoleh hari ini dari aktivitas ini
  capped: boolean;
}

export interface ActivitySummary {
  day: string;
  totalToday: number; // total mP aktivitas hari ini
  items: RewardProgress[];
}

/** Ringkasan progres semua aktivitas pengguna untuk hari ini (Asia/Jakarta). */
export async function getActivitySummary(userId: string): Promise<ActivitySummary> {
  const day = jakartaDay();
  const [logs, cfg] = await Promise.all([
    db.activityLog.findMany({
      where: { userId, day },
      select: { key: true, count: true, amount: true },
    }),
    getSystemConfig(),
  ]);
  const logMap = new Map(logs.map((l) => [l.key, l]));

  const items: RewardProgress[] = REWARD_CATALOG.map((def) => {
    const o = cfg.rewards.activities?.[def.key];
    const amount = typeof o?.amount === "number" ? o.amount : def.amount;
    const dailyCap = typeof o?.dailyCap === "number" ? Math.max(1, o.dailyCap) : def.dailyCap;
    const log = logMap.get(def.key);
    const count = log?.count ?? 0;
    const dayAmount = log?.amount ?? 0;
    return { ...def, amount, dailyCap, count, dayAmount, capped: count >= dailyCap };
  });

  return { day, totalToday: items.reduce((sum, i) => sum + i.dayAmount, 0), items };
}
