// ===================== RUTINITAS INDIIGOO =====================
// Modul Check-In 30 Hari + Jadwal Kegiatan Harian (03:30 – 23:32 WIB).
// File ini murni data & fungsi murni — aman dipakai server maupun client.

import { jakartaDay, jakartaDayStartMs } from "@/lib/indigoo";

// ===================== CHECK-IN 30 HARI =====================

/**
 * Hadiah mP per posisi check-in pada satu siklus 30 hari (index 0 = hari ke-1).
 * Semakin rajin, semakin besar — dengan hadiah milestone di hari ke-7, 14, 21 & 30.
 * Total satu siklus penuh = 70.250 mP.
 */
export const CHECKIN_REWARDS: number[] = [
  /* 1 */ 500, /* 2 */ 500, /* 3 */ 500, /* 4 */ 750, /* 5 */ 750, /* 6 */ 750,
  /* 7 */ 3_000,
  /* 8 */ 1_000, /* 9 */ 1_000, /* 10 */ 1_000, /* 11 */ 1_000, /* 12 */ 1_000, /* 13 */ 1_000,
  /* 14 */ 5_000,
  /* 15 */ 1_500, /* 16 */ 1_500, /* 17 */ 1_500, /* 18 */ 1_500, /* 19 */ 1_500, /* 20 */ 1_500,
  /* 21 */ 7_500,
  /* 22 */ 2_000, /* 23 */ 2_000, /* 24 */ 2_000, /* 25 */ 2_000, /* 26 */ 2_000,
  /* 27 */ 2_000, /* 28 */ 2_000, /* 29 */ 2_000,
  /* 30 */ 20_000,
];

/** Posisi hari milestone dalam siklus 30 hari (hadiah besar + ikon hadiah). */
export const CHECKIN_MILESTONES: readonly number[] = [7, 14, 21, 30];

/**
 * Ketentuan Check-In: hanya dapat diklik 1× dalam 24 jam.
 * Cooldown digulung dari waktu check-in terakhir (bukan pergantian hari kalender).
 */
export const CHECKIN_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/**
 * Gerbang Check-In 24 jam dari waktu check-in terakhir.
 * lastAt null (belum pernah) → selalu boleh.
 */
export function checkInGate(
  lastAt: Date | string | null | undefined,
  now: number = Date.now()
): { canCheckIn: boolean; nextCheckInAt: string | null } {
  if (!lastAt) return { canCheckIn: true, nextCheckInAt: null };
  const last = new Date(lastAt).getTime();
  if (!Number.isFinite(last)) return { canCheckIn: true, nextCheckInAt: null };
  const next = last + CHECKIN_COOLDOWN_MS;
  return now >= next
    ? { canCheckIn: true, nextCheckInAt: null }
    : { canCheckIn: false, nextCheckInAt: new Date(next).toISOString() };
}

export function isCheckInMilestone(position: number): boolean {
  return CHECKIN_MILESTONES.includes(position);
}

/** Total hadiah bila satu siklus 30 hari dikerjakan penuh. */
export const CHECKIN_CYCLE_TOTAL = CHECKIN_REWARDS.reduce((a, b) => a + b, 0);

/**
 * Posisi siklus dari jumlah check-in total:
 * - doneCells: banyak sel yang terisi pada siklus berjalan (0..30).
 * - nextPosition: posisi check-in berikutnya (1..30).
 */
export function checkInCycle(totalCount: number): { doneCells: number; nextPosition: number } {
  const doneCells = totalCount > 0 && totalCount % 30 === 0 ? 30 : totalCount % 30;
  const nextPosition = doneCells === 30 ? 1 : doneCells + 1;
  return { doneCells, nextPosition };
}

// ===================== JADWAL KEGIATAN HARIAN =====================

export type ActivityCategory = "ibadah" | "kesehatan" | "belajar" | "bisnis" | "keluarga";
export type ActivitySession = "dini" | "pagi" | "siang" | "sore" | "malam";

export type ReligionKey = "islam" | "kristen" | "katolik" | "hindu" | "buddha" | "khonghucu";

export interface ReligionInfo {
  key: ReligionKey;
  label: string;
}

/** Enam agama resmi Indonesia — waktu ibadah tersedia untuk semua. */
export const RELIGIONS: ReligionInfo[] = [
  { key: "islam", label: "Islam" },
  { key: "kristen", label: "Kristen" },
  { key: "katolik", label: "Katolik" },
  { key: "hindu", label: "Hindu" },
  { key: "buddha", label: "Buddha" },
  { key: "khonghucu", label: "Khonghucu" },
];

export function religionLabel(key: string): string {
  return RELIGIONS.find((r) => r.key === key)?.label ?? key;
}

export interface ActivityDef {
  key: string;
  /** Menit sejak tengah malam WIB — kegiatan terbuka mulai jam ini. */
  minutes: number;
  /** Label jam "HH.mm". */
  time: string;
  title: string;
  desc: string;
  category: ActivityCategory;
  session: ActivitySession;
  rewardMp: number;
  /** Diisi hanya untuk kegiatan ibadah spesifik agama. */
  religion?: ReligionKey;
}

/**
 * Kegiatan umum (lintas agama) — urutan wajib: dari Bangun Tidur 03.30 WIB
 * hingga Menjelang Tidur 23.32 WIB. Kegiatan ibadah per agama ada di
 * WORSHIP_SCHEDULE dan digabungkan sesuai agama pengguna.
 */
export const ACTIVITY_SCHEDULE: ActivityDef[] = [
  // ---------- DINI HARI ----------
  { key: "bangun",      minutes: 3 * 60 + 30, time: "03.30", title: "Bangun Tidur",                    desc: "Bangun tepat waktu, rapatkan tempat tidur, lalu minum segelas air putih.", category: "kesehatan", session: "dini",   rewardMp: 1_000 },
  { key: "niat",        minutes: 3 * 60 + 40, time: "03.40", title: "Berdoa & Niat Hari Ini",          desc: "Ucapkan rasa syukur sesuai keyakinan Anda dan tetapkan 3 target utama hari ini.", category: "ibadah",   session: "dini",   rewardMp: 500 },
  { key: "tilawah",     minutes: 4 * 60 + 30, time: "04.30", title: "Bacaan Rohani / Baca Buku",       desc: "Isi hati dan pikiran dengan kitab suci, renungan, atau buku baik.", category: "belajar",  session: "dini",   rewardMp: 1_000 },
  // ---------- PAGI ----------
  { key: "olahraga",    minutes: 5 * 60 + 0,  time: "05.00", title: "Olahraga Pagi",                   desc: "Peregangan, jalan kaki, senam, atau yoga ringan 15–30 menit.", category: "kesehatan", session: "pagi",  rewardMp: 1_500 },
  { key: "mandi",       minutes: 5 * 60 + 30, time: "05.30", title: "Mandi & Bersiap",                 desc: "Mandi, berpakaian rapi, dan siap tampil maksimal.", category: "kesehatan", session: "pagi",  rewardMp: 500 },
  { key: "sarapan",     minutes: 6 * 60 + 0,  time: "06.00", title: "Sarapan Sehat",                   desc: "Isi energi dengan sarapan bergizi agar fokus sepanjang pagi.", category: "kesehatan", session: "pagi",  rewardMp: 1_000 },
  { key: "cekpesan",    minutes: 6 * 60 + 30, time: "06.30", title: "Cek Pesan & Agenda Bisnis",       desc: "Balas pesan penting pelanggan lalu susun agenda toko hari ini.", category: "bisnis",   session: "pagi",   rewardMp: 1_500 },
  { key: "bukatoko",    minutes: 7 * 60 + 0,  time: "07.00", title: "Buka Toko / Mulai Usaha",         desc: "Rapikan etalase, cek stok barang, dan siapkan kas harian.", category: "bisnis",   session: "pagi",   rewardMp: 2_000 },
  { key: "layani",      minutes: 8 * 60 + 30, time: "08.30", title: "Layani Pelanggan",                desc: "Balas chat pelanggan dengan cepat, ramah, dan solutif.", category: "bisnis",   session: "pagi",   rewardMp: 2_000 },
  { key: "katalog",     minutes: 10 * 60 + 0, time: "10.00", title: "Update Katalog & Konten",         desc: "Tambah produk baru ke katalog atau siapkan konten status & siaran.", category: "bisnis",   session: "pagi",   rewardMp: 2_000 },
  // ---------- SIANG ----------
  { key: "makansiang",  minutes: 12 * 60 + 30, time: "12.30", title: "Makan Siang Bergizi",            desc: "Makan siang secukupnya dan jangan lupa minum air putih.", category: "kesehatan", session: "siang", rewardMp: 500 },
  { key: "order",       minutes: 13 * 60 + 30, time: "13.30", title: "Proses Order & Pengiriman",      desc: "Follow up pesanan masuk, kemas rapi, dan kirim tepat waktu.", category: "bisnis",   session: "siang",  rewardMp: 1_500 },
  { key: "komunitas",   minutes: 14 * 60 + 30, time: "14.30", title: "Grup Komunitas & Networking",    desc: "Bagikan info produk di grup dan saling dukung rekan usaha.", category: "bisnis",   session: "siang",  rewardMp: 1_000 },
  // ---------- SORE ----------
  { key: "evaluasi",    minutes: 16 * 60 + 0,  time: "16.00", title: "Evaluasi Penjualan",             desc: "Catat omzet dan pesanan hari ini di menu Statistik.", category: "bisnis",   session: "sore",   rewardMp: 1_500 },
  { key: "keluarga",    minutes: 17 * 60 + 0,  time: "17.00", title: "Waktu Keluarga & Rumah",         desc: "Sempatkan berbincang dengan keluarga dan bereskan urusan rumah.", category: "keluarga", session: "sore",   rewardMp: 1_000 },
  { key: "tutuptoko",   minutes: 17 * 60 + 45, time: "17.45", title: "Tutup Toko & Rekap Kas",         desc: "Tutup toko, hitung kas harian, dan simpan barang dengan aman.", category: "bisnis",   session: "sore",   rewardMp: 1_500 },
  // ---------- MALAM ----------
  { key: "makansore",   minutes: 18 * 60 + 30, time: "18.30", title: "Makan Malam Bersama",            desc: "Makan malam bergizi — momen hangat bersama orang tercinta.", category: "keluarga", session: "malam",  rewardMp: 500 },
  { key: "belajar",     minutes: 20 * 60 + 0,  time: "20.00", title: "Belajar & Pengembangan Diri",    desc: "Ikuti pelatihan, tonton materi bisnis, atau baca 20 menit.", category: "belajar",  session: "malam",  rewardMp: 2_000 },
  { key: "agendabesok", minutes: 21 * 60 + 0,  time: "21.00", title: "Rencanakan Agenda Besok",        desc: "Tulis daftar prioritas esok hari sebelum lupa.", category: "bisnis",   session: "malam",  rewardMp: 1_500 },
  { key: "tidur",       minutes: 23 * 60 + 32, time: "23.32", title: "Menjelang Tidur",                desc: "Turunkan layar gadget, siapkan kebutuhan besok, dan tidur tepat waktu.", category: "kesehatan", session: "malam", rewardMp: 1_000 },
];

export interface SessionInfo {
  id: ActivitySession;
  label: string;
  range: string;
}

export const SESSIONS: SessionInfo[] = [
  { id: "dini",  label: "Dini Hari", range: "03.30 – 04.59" },
  { id: "pagi",  label: "Pagi",      range: "05.00 – 10.59" },
  { id: "siang", label: "Siang",     range: "11.00 – 14.59" },
  { id: "sore",  label: "Sore",      range: "15.00 – 17.59" },
  { id: "malam", label: "Malam",     range: "18.00 – 23.32" },
];

/** Tentukan sesi otomatis dari menit kegiatan. */
export function sessionForMinutes(m: number): ActivitySession {
  if (m < 300) return "dini"; // 03.30 – 04.59
  if (m < 660) return "pagi"; // 05.00 – 10.59
  if (m < 900) return "siang"; // 11.00 – 14.59
  if (m < 1080) return "sore"; // 15.00 – 17.59
  return "malam"; // 18.00 – 23.32
}

/**
 * Waktu ibadah untuk SEMUA agama (jadwal indikatif WIB — Jakarta & sekitarnya;
 * sesuaikan dengan jadwal setempat). Kegiatan ibadah pengguna mengikuti agama
 * yang dipilih dan digabung ke jadwal kegiatan harian.
 */
export const WORSHIP_SCHEDULE: Record<ReligionKey, ActivityDef[]> = {
  islam: [
    { key: "ib_islam_subuh",   minutes: 4 * 60 + 30,  time: "04.30", title: "Salat Subuh",        desc: "Salat Subuh dan dzikir pagi (jadwal indikatif — sesuaikan jadwal setempat).", category: "ibadah", session: "dini",  rewardMp: 1_500, religion: "islam" },
    { key: "ib_islam_dhuha",   minutes: 6 * 60 + 45,  time: "06.45", title: "Salat Dhuha & Dzikir", desc: "Salat sunnah Dhuha dan dzikir pagi sebelum mulai kesibukan.", category: "ibadah", session: "pagi",  rewardMp: 1_000, religion: "islam" },
    { key: "ib_islam_dzuhur",  minutes: 11 * 60 + 55, time: "11.55", title: "Salat Dzuhur",       desc: "Salat Dzuhur tepat waktu, diselingi rehat sejenak.", category: "ibadah", session: "siang", rewardMp: 1_000, religion: "islam" },
    { key: "ib_islam_ashar",   minutes: 15 * 60 + 15, time: "15.15", title: "Salat Ashar",        desc: "Salat Ashar di sela kesibukan usaha.", category: "ibadah", session: "sore",  rewardMp: 1_000, religion: "islam" },
    { key: "ib_islam_maghrib", minutes: 17 * 60 + 50, time: "17.50", title: "Salat Maghrib",      desc: "Salat Maghrib — sebaiknya bersama keluarga di rumah.", category: "ibadah", session: "sore",  rewardMp: 1_000, religion: "islam" },
    { key: "ib_islam_isya",    minutes: 19 * 60 + 5,  time: "19.05", title: "Salat Isya",         desc: "Salat Isya, dilanjutkan yasinan/tahlilan bila ada.", category: "ibadah", session: "malam", rewardMp: 1_000, religion: "islam" },
  ],
  kristen: [
    { key: "ib_kristen_saat_teduh", minutes: 5 * 60 + 30, time: "05.30", title: "Saat Teduh Pagi",   desc: "Doa pagi dan pembacaan Alkitab memulai hari dengan tenang.", category: "ibadah", session: "pagi",  rewardMp: 1_000, religion: "kristen" },
    { key: "ib_kristen_doa_siang",  minutes: 12 * 60 + 0, time: "12.00", title: "Doa & Ucapan Syukur Siang", desc: "Doa singkat dan syukur di tengah kesibukan siang.", category: "ibadah", session: "siang", rewardMp: 500, religion: "kristen" },
    { key: "ib_kristen_pujian",     minutes: 18 * 60 + 0, time: "18.00", title: "Pujian & Persekutuan", desc: "Pujian sore, ibadah lokal, atau persekutuan online bila ada.", category: "ibadah", session: "malam", rewardMp: 1_000, religion: "kristen" },
    { key: "ib_kristen_alkitab",    minutes: 20 * 60 + 30, time: "20.30", title: "Pembacaan Alkitab & Refleksi", desc: "Renungan malam dan doa penutup hari.", category: "ibadah", session: "malam", rewardMp: 1_500, religion: "kristen" },
  ],
  katolik: [
    { key: "ib_katolik_liturgi_pagi", minutes: 5 * 60 + 30, time: "05.30", title: "Doa Pagi / Liturgi Jam", desc: "Doa pagi dan liturgi jam memulai hari dengan tenang.", category: "ibadah", session: "pagi",  rewardMp: 1_000, religion: "katolik" },
    { key: "ib_katolik_angelus",      minutes: 12 * 60 + 0, time: "12.00", title: "Doa Angelus Tengah Hari", desc: "Angelus dan doa singkat di tengah kesibukan siang.", category: "ibadah", session: "siang", rewardMp: 500, religion: "katolik" },
    { key: "ib_katolik_rosario",      minutes: 17 * 60 + 30, time: "17.30", title: "Rosario Sore",         desc: "Rosario atau doa sore bersama keluarga.", category: "ibadah", session: "sore",  rewardMp: 1_000, religion: "katolik" },
    { key: "ib_katolik_komplemen",    minutes: 21 * 60 + 0, time: "21.00", title: "Komplemen / Doa Malam", desc: "Doa malam (komplemen) dan refleksi penutup hari — misa di hari Minggu & hari wajib.", category: "ibadah", session: "malam", rewardMp: 1_500, religion: "katolik" },
  ],
  hindu: [
    { key: "ib_hindu_canang",      minutes: 7 * 60 + 0,  time: "07.00", title: "Bakti di Sanggah & Canang", desc: "Sajikan canang/banten di sanggah keluarga sebagai bakti pagi.", category: "ibadah", session: "pagi",  rewardMp: 1_000, religion: "hindu" },
    { key: "ib_hindu_trisandya_pagi", minutes: 6 * 60 + 0, time: "06.00", title: "Tri Sandhya Pagi",    desc: "Mantram Tri Sandhya waktu pagi (sunya pagi).", category: "ibadah", session: "pagi",  rewardMp: 1_000, religion: "hindu" },
    { key: "ib_hindu_trisandya_siang", minutes: 12 * 60 + 0, time: "12.00", title: "Tri Sandhya Siang",  desc: "Mantram Tri Sandhya waktu siang (sunya siang).", category: "ibadah", session: "siang", rewardMp: 500, religion: "hindu" },
    { key: "ib_hindu_trisandya_sore", minutes: 18 * 60 + 0, time: "18.00", title: "Tri Sandhya Sore",   desc: "Mantram Tri Sandhya waktu sore (sunya sore) di rumah.", category: "ibadah", session: "malam", rewardMp: 1_000, religion: "hindu" },
  ],
  buddha: [
    { key: "ib_buddha_puja_pagi",   minutes: 5 * 60 + 30, time: "05.30", title: "Puja Bakti Pagi",      desc: "Penghormatan Triratna, pemberian dedaunan, dan niat baik pagi.", category: "ibadah", session: "pagi",  rewardMp: 1_000, religion: "buddha" },
    { key: "ib_buddha_doa_siang",   minutes: 12 * 60 + 0, time: "12.00", title: "Doa & Metta Siang",    desc: "Doa singkat dan metta (cinta kasih) di tengah hari.", category: "ibadah", session: "siang", rewardMp: 500, religion: "buddha" },
    { key: "ib_buddha_puja_sore",   minutes: 18 * 60 + 30, time: "18.30", title: "Puja Bakti Sore & Meditasi", desc: "Puja bakti sore dan meditasi samatha/vipassana singkat.", category: "ibadah", session: "malam", rewardMp: 1_500, religion: "buddha" },
  ],
  khonghucu: [
    { key: "ib_kong_pagi",    minutes: 6 * 60 + 0,  time: "06.00", title: "Sembahyang Pagi (Hio)",  desc: "Sembahyang pagi dengan hio di altar keluarga (Thian Tai).", category: "ibadah", session: "pagi",  rewardMp: 1_000, religion: "khonghucu" },
    { key: "ib_kong_renungan", minutes: 20 * 60 + 0, time: "20.00", title: "Renungan Kitab Suci (Sutra)", desc: "Baca renungan ajaran Nabi Konghucu (Lun Yu / Sutra).", category: "ibadah", session: "malam", rewardMp: 1_500, religion: "khonghucu" },
    { key: "ib_kong_sore",    minutes: 18 * 60 + 0, time: "18.00", title: "Sembahyang Sore (Hio)",  desc: "Sembahyang sore dengan hio dan doa syukur keluarga.", category: "ibadah", session: "malam", rewardMp: 1_000, religion: "khonghucu" },
  ],
};

/** Indeks semua kegiatan (umum + ibadah semua agama) untuk lookup cepat. */
export const ACTIVITY_INDEX: ReadonlyMap<string, ActivityDef> = new Map(
  [...ACTIVITY_SCHEDULE, ...Object.values(WORSHIP_SCHEDULE).flat()].map((a) => [a.key, a])
);

/** Cari definisi kegiatan umum/ibadah berdasarkan key. */
export function findActivityDef(key: string): ActivityDef | undefined {
  return ACTIVITY_INDEX.get(key);
}

/** Gabungkan kegiatan umum + kegiatan ibadah sesuai agama, urut jam. */
export function buildDaySchedule(religion: string): ActivityDef[] {
  const worship = religion && religion in WORSHIP_SCHEDULE ? WORSHIP_SCHEDULE[religion as ReligionKey] : [];
  return [...ACTIVITY_SCHEDULE, ...worship].sort((a, b) => a.minutes - b.minutes);
}

/** Menit sejak tengah malam dalam zona Asia/Jakarta (untuk gerbang jam kegiatan). */
export function jakartaMinutesNow(d: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

// ===================== 4 RUTINITAS HARIAN =====================

export interface DailyRoutineDef {
  key: string;
  title: string;
  description: string;
  /** Hadiah default (sebelum override Panel Super Admin). */
  rewardMp: number;
}

/** Definisi 4 rutinitas harian — satu sumber untuk GET /api/routines & klaim. */
export const DAILY_ROUTINE_DEFS: DailyRoutineDef[] = [
  { key: "absen",   title: "Absen Harian",         description: "Absen setiap hari untuk merawat konsistensi bisnis Anda.",   rewardMp: 1_000 },
  { key: "chat",    title: "Aktif Chatting",       description: "Balas pesan pelanggan dan jaga percakapan tetap hidup.",     rewardMp: 2_000 },
  { key: "profil",  title: "Kelola Profil Bisnis", description: "Pastikan identitas bisnis Anda selalu lengkap dan terbaru.", rewardMp: 3_000 },
  { key: "bagikan", title: "Bagikan IndiGoo",      description: "Sebarkan IndiGoo ke rekan usaha & pelanggan Anda.",          rewardMp: 1_000 },
];

// ===================== STREAK (RENTETAN HARI) =====================
const DAY_MS = 86_400_000;

function prevDay(day: string): string {
  return jakartaDay(new Date(jakartaDayStartMs(day) - DAY_MS));
}

/**
 * Streak berjalan = hari berturut-turut sampai hari ini
 * (jika hari ini belum check-in, streak kemarin masih dihitung — belum putus).
 */
export function computeStreak(days: Set<string>, today: string): number {
  let cursor = today;
  if (!days.has(cursor)) {
    const y = prevDay(cursor);
    if (!days.has(y)) return 0;
    cursor = y;
  }
  let streak = 0;
  let cur = cursor;
  while (days.has(cur) && streak < 4_000) {
    streak += 1;
    cur = prevDay(cur);
  }
  return streak;
}

/** Rekor streak terpanjang dari seluruh riwayat check-in. */
export function computeBestStreak(sortedDays: string[]): number {
  if (sortedDays.length === 0) return 0;
  let best = 1;
  let run = 1;
  for (let i = 1; i < sortedDays.length; i++) {
    const consecutive = jakartaDayStartMs(sortedDays[i]) - jakartaDayStartMs(sortedDays[i - 1]) === DAY_MS;
    run = consecutive ? run + 1 : 1;
    if (run > best) best = run;
  }
  return best;
}

// ===================== TIPE STATUS (dipakai API & UI) =====================

export interface CheckInInfo {
  checkedToday: boolean;
  /** true bila sudah lewat 24 jam sejak check-in terakhir (boleh klik lagi). */
  canCheckIn: boolean;
  /** ISO waktu Check-In berikutnya diperbolehkan (null bila boleh sekarang). */
  nextCheckInAt: string | null;
  total: number;
  streak: number;
  best: number;
  /** Sel terisi pada siklus berjalan (0..30). */
  cycleDone: number;
  /** Posisi check-in berikutnya (1..30). */
  nextPosition: number;
  /** Hadiah check-in berikutnya (mP). */
  nextReward: number;
  /** true bila posisi berikutnya adalah milestone. */
  nextIsMilestone: boolean;
}

export interface ScheduleItemStatus {
  key: string;
  minutes: number;
  time: string;
  title: string;
  desc: string;
  category: ActivityCategory;
  session: ActivitySession;
  rewardMp: number;
  done: boolean;
  available: boolean;
  /** Alasan terkunci (mis. "Tersedia mulai 12.00 WIB"). */
  requirement?: string;
  /** Diisi hanya untuk kegiatan ibadah spesifik agama. */
  religion?: string;
}
