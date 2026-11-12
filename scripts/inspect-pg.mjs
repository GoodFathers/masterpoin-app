// Inspeksi baseline struktur DB Supabase
import postgres from "postgres";

const url = process.env.SUPABASE_DB_URL;
if (!url) { console.error("SUPABASE_DB_URL tidak ada"); process.exit(1); }
const sql = postgres(url, { ssl: "require", connect_timeout: 15, max: 1 });

const tables = await sql`
  select tablename from pg_tables
  where schemaname = 'public' order by tablename`;
console.log("=== TABEL (" + tables.length + ") ===");
console.log(tables.map(t => t.tablename).join(", "));

for (const t of ["Appointment", "VideoWatch", "VideoComment", "Mission"]) {
  const ex = await sql`select count(*)::int as n from pg_tables where schemaname='public' and tablename=${t}`;
  console.log(`${t}: ${ex[0].n ? "ADA" : "tidak ada"}`);
}

const col = await sql`
  select count(*)::int as n from information_schema.columns
  where table_schema='public' and table_name='User' and column_name='claimedMissions'`;
console.log(`User.claimedMissions: ${col[0].n ? "MASIH ADA (perlu drop)" : "sudah tidak ada"}`);

const counts = await sql`
  select (select count(*)::int from "User") as users,
         (select count(*)::int from "VideoPost") as videos,
         (select count(*)::int from "Media") as media,
         (select count(*)::int from "SystemConfig") as sysconfig`;
console.log("=== JUMLAH BARIS ===");
console.log(JSON.stringify(counts[0]));

await sql.end({ timeout: 3 });
process.exit(0);
