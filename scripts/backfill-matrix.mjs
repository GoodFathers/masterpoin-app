// Backfill Hybrid Matrix Spillover 3 Fase: masukkan seluruh pengguna yang ada
// ke pohon (urutan createdAt = urutan penempatan; tanpa sponsor → BFS di bawah
// akar). Idempoten — baris yang sudah ada dilewati.
// Jalankan: bun scripts/backfill-matrix.mjs sqlite|pg|both
import { Database } from "bun:sqlite";
import postgres from "postgres";
import { randomBytes } from "node:crypto";

const TARGET = (process.argv[2] ?? "both").toLowerCase();
const P2_LABELS = ["Magang 1","Magang 2","Magang 3","Magang 4","Junior Staf 1","Junior Staf 2","Staf 1","Staf 2","Staf 3","Staf 4","Senior Staf 1","Senior Staf 2","Tim Leader 1","Tim Leader 2","Tim Leader 3","Tim Leader 4","Supervisor"];
const P3_LABELS = ["Manager 1","Manager 2","Manager 3","Manager 4","Senior Manager 1","Senior Manager 2","Kepala Bagian 1","Kepala Bagian 2","Kepala Bagian 3","Kepala Bagian 4","Director 1","Director 2","Director 3","Director 4","Director 5","Director 6","President Director"];
const P_COUNTS = Array.from({ length: 17 }, (_, i) => 2 ** (i + 1));

function evaluateRank(phase, jabatan, b2, b3, total) {
  let p = phase, j = jabatan, phase2Base = b2, phase3Base = b3;
  if (p === 1) {
    if (total >= 100) { p = 2; j = "Training 2"; phase2Base = total; }
    else if (total >= 10) j = "Training 1";
    else j = "Anggota";
  }
  if (p === 2) {
    const progress = total - phase2Base;
    if (progress >= 131072) { p = 3; j = "Supervisor"; phase3Base = total; }
    else {
      j = "Training 2";
      for (let i = 0; i < P2_LABELS.length; i++) if (progress >= P_COUNTS[i]) j = P2_LABELS[i]; else break;
    }
  }
  if (p === 3) {
    const progress = total - phase3Base;
    j = "Supervisor";
    for (let i = 0; i < P3_LABELS.length; i++) if (progress >= P_COUNTS[i]) j = P3_LABELS[i]; else break;
  }
  return { phase: p, jabatan: j, phase2Base, phase3Base };
}

const genId = () => `cmx${Date.now().toString(36)}${randomBytes(6).toString("hex")}`;

function buildTree(users) {
  // users: [{id, createdAt}] urut createdAt asc
  const nodes = new Map(); // userId -> {id(node), userId, parentId(node), ...}
  const children = new Map(); // nodeParentId -> [nodeId]
  const byNode = new Map(); // nodeId -> node
  let rootId = null; // userId akar
  for (const u of users) {
    if (nodes.has(u.id)) continue;
    if (!rootId) {
      const row = { id: genId(), userId: u.id, parentId: null, position: "KIRI", phase: 1, jabatan: "Anggota", phase2Base: 0, phase3Base: 0, downlineTotal: 0 };
      nodes.set(u.id, row);
      byNode.set(row.id, row);
      rootId = u.id;
      continue;
    }
    // BFS dari akar → slot kosong pertama (antrian memakai NODE id)
    const queue = [nodes.get(rootId).id];
    let parent = null, position = null;
    while (queue.length) {
      const pid = queue.shift();
      const kids = children.get(pid) ?? [];
      const left = kids.find((k) => byNode.get(k).position === "KIRI");
      const right = kids.find((k) => byNode.get(k).position === "KANAN");
      if (!left || !right) { parent = pid; position = !left ? "KIRI" : "KANAN"; break; }
      queue.push(left, right);
    }
    const row = { id: genId(), userId: u.id, parentId: parent, position, phase: 1, jabatan: "Anggota", phase2Base: 0, phase3Base: 0, downlineTotal: 0 };
    nodes.set(u.id, row);
    byNode.set(row.id, row);
    children.set(parent, [...(children.get(parent) ?? []), row.id]);
  }

  // downlineTotal bottom-up (jalan pohon via node id)
  const totalOf = (nodeId) => {
    const kids = children.get(nodeId) ?? [];
    return kids.length + kids.reduce((acc, k) => acc + totalOf(k), 0);
  };
  const result = [...nodes.values()]; // urutan Map = urutan penempatan
  for (const n of result) {
    n.downlineTotal = totalOf(n.id);
    const next = evaluateRank(n.phase, n.jabatan, n.phase2Base, n.phase3Base, n.downlineTotal);
    Object.assign(n, next);
  }
  return result;
}

async function backfillPg() {
  const url = process.env.SUPABASE_DB_URL;
  if (!url) { console.error("SUPABASE_DB_URL tidak ada di .env"); return; }
  const sql = postgres(url, { ssl: "require", max: 1 });
  const users = await sql`select id, "createdAt" from "User" where id not in (select "userId" from "MatrixNode") order by "createdAt" asc`;
  console.log(`PG: ${users.length} pengguna belum berada di matriks`);
  const tree = buildTree(users.map((u) => ({ id: u.id, createdAt: u.createdAt })));
  for (const n of tree) {
    await sql`insert into "MatrixNode" ("id","userId","sponsorId","parentId","position","phase","depth","downlineTotal","phase2Base","phase3Base","jabatan","createdAt")
      values (${n.id}, ${n.userId}, null, ${n.parentId}, ${n.position}, ${n.phase}, 0, ${n.downlineTotal}, ${n.phase2Base}, ${n.phase3Base}, ${n.jabatan}, now())
      on conflict ("userId") do nothing`;
  }
  // kedalaman: hitung berjenjang
  await sql`update "MatrixNode" set depth = 0 where "parentId" is null`;
  for (let d = 0; d < 50; d++) {
    const r = await sql`update "MatrixNode" c set depth = p.depth + 1 from "MatrixNode" p where c."parentId" = p.id and p.depth = ${d} and c.depth <> p.depth + 1 returning c.id`;
    if (r.length === 0) break;
  }
  console.log(`PG: ${tree.length} node dimasukkan`);
  await sql.end({ timeout: 3 });
}

function backfillSqlite() {
  const db = new Database("/home/z/my-project/db/custom.db");
  const users = db.query(`select id, createdAt from User where id not in (select userId from MatrixNode) order by createdAt asc`).all();
  console.log(`SQLite: ${users.length} pengguna belum berada di matriks`);
  const tree = buildTree(users.map((u) => ({ id: u.id, createdAt: u.createdAt })));
  const ins = db.query(`insert or ignore into MatrixNode (id,userId,sponsorId,parentId,position,phase,depth,downlineTotal,phase2Base,phase3Base,jabatan,createdAt) values (?,?,?,?,?,?,?,?,?,?,?,?)`);
  for (const n of tree) ins.run(n.id, n.userId, null, n.parentId, n.position, n.phase, 0, n.downlineTotal, n.phase2Base, n.phase3Base, n.jabatan, Date.now());
  db.query(`update MatrixNode set depth = 0 where parentId is null`).run();
  for (let d = 0; d < 50; d++) {
    const r = db.query(`update MatrixNode set depth = (select depth from MatrixNode p where p.id = MatrixNode.parentId) + 1 where parentId is not null and depth = (select depth from MatrixNode p where p.id = MatrixNode.parentId)`).run();
    if (r.changes === 0) break;
  }
  console.log(`SQLite: ${tree.length} node dimasukkan`);
  db.close();
}

if (TARGET === "sqlite" || TARGET === "both") backfillSqlite();
if (TARGET === "pg" || TARGET === "both") await backfillPg();
console.log("backfill-matrix selesai");
process.exit(0);
