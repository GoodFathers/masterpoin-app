// Migrasi data: SQLite (db/custom.db) -> Supabase PostgreSQL (session pooler).
// Jalankan: bun scripts/migrate-sqlite-to-pg.mjs  (idempoten — TRUNCATE dulu)
// Prasyarat: SUPABASE_DB_URL di .env (session pooler port 5432) dan schema
// sudah di-push via `prisma db push --schema prisma/schema.postgres.prisma`.
// Format: Prisma SQLite menyimpan DateTime sebagai INTEGER epoch-ms dan
// Boolean sebagai INTEGER 0/1 — dikonversi di sini ke Date/boolean PG.
import { Database } from "bun:sqlite";
import postgres from "postgres";

// Urutan insert aman FK: User dulu (Profile/Channel/Community/VideoPost
// punya FK ke User), Contact sebelum Chat, Chat sebelum Message, dst.
const TABLES = [
  "User", "Profile", "Label", "Contact", "Chat", "Message", "CallLog",
  "Collection", "Product", "Story", "Broadcast", "QuickReply", "Channel",
  "ChannelPost", "Community", "Device", "DailyStat", "ChatBackup",
  "SupportTicket", "Order", "VerificationLog", "VideoPost", "MarketItem",
  "SystemConfig", "DailyCheckIn", "ActivityCheck", "RoutineCheck", "ActivityLog",
];

const DATETIME = {
  User: ["createdAt", "activatedAt", "timerStartedAt", "activationRequestedAt", "activationProcessedAt", "locationAt"],
  Profile: ["updatedAt"],
  Contact: ["lastSeen", "createdAt"],
  Chat: ["lastMessageAt", "createdAt"],
  Message: ["createdAt"],
  CallLog: ["createdAt"],
  Product: ["createdAt"],
  Story: ["createdAt", "expiresAt"],
  Broadcast: ["createdAt", "sentAt"],
  Channel: ["createdAt"],
  ChannelPost: ["createdAt"],
  Community: ["createdAt"],
  Device: ["lastActive"],
  ChatBackup: ["createdAt"],
  SupportTicket: ["createdAt", "updatedAt"],
  Order: ["createdAt", "updatedAt"],
  VerificationLog: ["createdAt"],
  VideoPost: ["createdAt"],
  MarketItem: ["createdAt"],
  SystemConfig: ["updatedAt"],
  DailyCheckIn: ["createdAt"],
  ActivityCheck: ["createdAt"],
  RoutineCheck: ["createdAt"],
  ActivityLog: ["createdAt", "updatedAt"],
};

const BOOLEAN = {
  Profile: ["verified", "brandProtected", "readReceipts", "twoStepEnabled", "blockedStrangers", "notifMessages", "notifGroups", "notifCalls", "notifPreview", "notifSound", "greetingEnabled", "awayEnabled", "storeOpen"],
  Contact: ["blocked"],
  Chat: ["pinned", "archived", "muted", "isBusinessChat", "favorite"],
  Message: ["starred"],
  Product: ["available"],
  Device: ["current"],
  User: ["active", "timerCompleted"],
  VideoPost: ["isFollower", "isFollowing"],
};

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error("SUPABASE_DB_URL tidak ditemukan di .env — batal.");
  process.exit(1);
}

const lite = new Database("db/custom.db", { readonly: true });
const sql = postgres(url, { prepare: false, max: 1 });

// Konverter nilai tangguh: epoch-ms (number/string) -> Date; 0/1 -> boolean.
// Catatan: string kosong "" adalah nilai sah (bukan null) — jangan diubah.
function convert(k, v, dt, bl) {
  if (v === null || v === undefined) return null;
  if (dt.has(k)) {
    const num = typeof v === "number" ? v : /^\d{10,17}$/.test(String(v).trim()) ? Number(v) : NaN;
    if (Number.isFinite(num)) return new Date(num);
    const parsed = new Date(v); // fallback: string ISO
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (bl.has(k)) return v === 1 || v === "1" || v === true || v === "true";
  return v;
}

// 1) Bersihkan tabel tujuan agar migrasi idempoten (TRUNCATE 28 tabel milik kita).
// Catatan: postgres-js v4 tidak punya sql.join — daftar tabel hardcode (dari konstanta di atas, aman).
await sql.unsafe(`truncate table ${TABLES.map((t) => `"${t}"`).join(", ")} cascade`);

// 2) Baca SQLite, transformasi, insert, hitung ulang — dengan laporan per tabel.
const report = [];
let mismatch = false;
for (const t of TABLES) {
  const rows = lite.query(`select * from "${t}"`).all();
  const dt = new Set(DATETIME[t] ?? []);
  const bl = new Set(BOOLEAN[t] ?? []);
  const transformed = rows.map((r) => {
    const o = {};
    for (const [k, v] of Object.entries(r)) o[k] = convert(k, v, dt, bl);
    return o;
  });
  try {
    if (transformed.length > 0) {
      await sql`insert into ${sql.identifier(t)} ${sql(transformed)}`;
    }
    const after = (await sql`select count(*)::int as c from ${sql.identifier(t)}`)[0].c;
    const ok = after === transformed.length;
    if (!ok) mismatch = true;
    report.push(`${ok ? "OK  " : "BEDA"} ${t}: sqlite=${transformed.length} -> pg=${after}`);
  } catch (err) {
    mismatch = true;
    report.push(`GAGAL ${t}: ${err.message}`);
  }
}

await sql.end();
for (const line of report) console.log(line);
const total = report.reduce((a, l) => a + (Number(l.match(/pg=(\d+)/)?.[1] ?? 0)), 0);
console.log(mismatch ? `MIGRASI ADA SELISIH (total pg=${total})` : `MIGRASI SELESAI — semua baris cocok (total pg=${total}). ✔`);
process.exitCode = mismatch ? 1 : 0;
