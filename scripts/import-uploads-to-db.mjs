// ===================== IMPOR BERKAS LAMA KE DATABASE =====================
// Memindahkan seluruh berkas di public/uploads/<kind>/<name> ke tabel Media
// (kolom Bytes) supaya tersaji lewat /api/media/<name> di mana pun — termasuk
// produksi yang filesystem-nya hanya-baca (Vercel).
//
// Pemakaian:
//   bun scripts/import-uploads-to-db.mjs              → target: sqlite + pg
//   bun scripts/import-uploads-to-db.mjs --target=pg  → hanya Supabase PG
//   bun scripts/import-uploads-to-db.mjs --target=sqlite → hanya SQLite lokal
//
// Idempoten: baris dengan nama sama di-upsert (data diperbarui).

import { readdirSync, readFileSync, statSync } from "fs";
import path from "path";
import postgres from "postgres";
import { PrismaClient } from "@prisma/client";

const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");

const MIME_BY_EXT = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml",
  ".bmp": "image/bmp", ".ico": "image/x-icon",
  ".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime",
  ".avi": "video/x-msvideo", ".mkv": "video/x-matroska", ".3gp": "video/3gpp",
  ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".oga": "audio/ogg",
  ".opus": "audio/opus", ".wav": "audio/wav", ".m4a": "audio/mp4",
  ".aac": "audio/aac", ".amr": "audio/amr",
  ".pdf": "application/pdf", ".txt": "text/plain",
  ".zip": "application/zip",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

function mimeFor(name) {
  return MIME_BY_EXT[path.extname(name).toLowerCase()] ?? "application/octet-stream";
}

/** Daftar { kind, name, mime, size, data } dari public/uploads. */
function collectFiles() {
  const out = [];
  for (const kind of readdirSync(UPLOADS_DIR)) {
    const dir = path.join(UPLOADS_DIR, kind);
    if (!statSync(dir).isDirectory()) continue;
    for (const name of readdirSync(dir)) {
      const fp = path.join(dir, name);
      if (!statSync(fp).isFile()) continue;
      out.push({ kind, name, mime: mimeFor(name), size: statSync(fp).size, data: readFileSync(fp) });
    }
  }
  return out;
}

// ---------- argumen ----------
const targetArg = process.argv.find((a) => a.startsWith("--target="));
const target = targetArg ? targetArg.split("=")[1] : "both"; // both | sqlite | pg

const files = collectFiles();
console.log(`Ditemukan ${files.length} berkas di public/uploads (target: ${target})`);
if (files.length === 0) process.exit(0);

let okSqlite = 0, okPg = 0, fail = 0;

// ---------- SQLite (Prisma) ----------
if (target === "sqlite" || target === "both") {
  const prisma = new PrismaClient();
  try {
    for (const f of files) {
      await prisma.media.upsert({
        where: { name: f.name },
        create: {
          kind: f.kind, name: f.name, originalName: f.name,
          mimeType: f.mime, size: f.size, data: f.data,
          status: "ready", uploadedById: "", totalChunks: 0,
        },
        update: { data: f.data, size: f.size, mimeType: f.mime, kind: f.kind },
      });
      okSqlite++;
    }
    console.log(`SQLite : ${okSqlite}/${files.length} berkas terimpor`);
  } catch (e) {
    fail++;
    console.error(`SQLite GAGAL: ${e.message}`);
  } finally {
    await prisma.$disconnect();
  }
}

// ---------- PostgreSQL (Supabase) ----------
if (target === "pg" || target === "both") {
  const url = process.env.SUPABASE_DB_URL;
  if (!url) {
    fail++;
    console.error("PG GAGAL: SUPABASE_DB_URL tidak ada di .env");
  } else {
    const sql = postgres(url, { prepare: false, max: 1 });
    try {
      for (const f of files) {
        await sql`
          INSERT INTO "Media" ("id","kind","name","originalName","mimeType","size","data","status","totalChunks","uploadedById","createdAt")
          VALUES (gen_random_uuid()::text, ${f.kind}, ${f.name}, ${f.name}, ${f.mime}, ${f.size}, ${f.data}, 'ready', 0, '', now())
          ON CONFLICT ("name") DO UPDATE
          SET "data" = ${f.data}, "size" = ${f.size}, "mimeType" = ${f.mime}, "kind" = ${f.kind}
        `;
        okPg++;
      }
      console.log(`PG     : ${okPg}/${files.length} berkas terimpor`);
    } catch (e) {
      fail++;
      console.error(`PG GAGAL: ${e.message}`);
    } finally {
      await sql.end();
    }
  }
}

console.log(fail === 0 ? "SELESAI ✓" : "SELESAI DENGAN GALAT ✗");
process.exit(fail === 0 ? 0 : 1);
