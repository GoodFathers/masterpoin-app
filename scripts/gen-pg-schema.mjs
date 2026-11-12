// Buat prisma/schema.postgres.prisma dari schema.prisma (provider sqlite -> postgresql).
// Dipakai build Vercel (script "build") supaya client Prisma production memakai PostgreSQL,
// sementara sandbox tetap memakai SQLite lokal — kode aplikasi tidak berubah sama sekali.
import { readFileSync, writeFileSync } from "node:fs";

const SRC = new URL("../prisma/schema.prisma", import.meta.url);
const DST = new URL("../prisma/schema.postgres.prisma", import.meta.url);

let text = readFileSync(SRC, "utf8");
if (!/provider\s*=\s*"sqlite"/.test(text)) {
  console.error("gen-pg-schema: schema.prisma tidak memakai provider sqlite — batal (tidak ada yang diubah).");
  process.exit(1);
}
text = text.replace(/provider\s*=\s*"sqlite"/, 'provider = "postgresql"');
writeFileSync(DST, text);
console.log("gen-pg-schema: OK — prisma/schema.postgres.prisma dibuat (provider postgresql)");
