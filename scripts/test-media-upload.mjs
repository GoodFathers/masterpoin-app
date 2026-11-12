// ===================== UJI TUNTAS MEDIA UPLOAD (sandbox) =====================
// 1. register user uji → login → token
// 2. unggah langsung (PNG 1 KB) → GET via /uploads/* (tanpa sesi) → byte cocok
// 3. unggah bertahap (5 MB, 2 potongan) → GET → byte cocok
// 4. permintaan Range → 206 + Content-Range
// 5. HEAD → 200 + Content-Length
// 6. bersih-bersih: hapus media uji + user uji
import { PrismaClient } from "@prisma/client";
import { createHash } from "crypto";

const prisma = new PrismaClient();
const BASE = "http://localhost:3000";
let pass = 0, failcnt = 0;
function check(label, cond, extra = "") {
  if (cond) { pass++; console.log(`  ✓ ${label} ${extra}`); }
  else { failcnt++; console.log(`  ✗ GAGAL: ${label} ${extra}`); }
}

const PNG_1KB = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(1000, 0x42),
]);
const BIG = Buffer.alloc(5 * 1024 * 1024 + 12345); // >4 MB → jalur bertahap
for (let i = 0; i < BIG.length; i += 7919) BIG[i] = 0x7f; // pola pseudo-acak

const UNAME = "mediatestx" + Math.floor(Math.random() * 900 + 100);
let token = "", userId = "";

try {
  // ---- 0) register + login ----
  const reg = await fetch(`${BASE}/api/auth/register`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: UNAME, pin: "998877", password: "sandiuji123", agree: true }),
  });
  check("register", reg.ok, reg.ok ? "" : (await reg.text()).slice(0, 120));
  const regData = await reg.json();
  userId = regData?.user?.id ?? "";

  const login = await fetch(`${BASE}/api/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: UNAME, password: "sandiuji123" }),
  });
  const loginData = await login.json();
  token = loginData?.token ?? "";
  check("login dapat token", token.length > 20);
  const H = { Authorization: `Bearer ${token}` };

  // ---- 1) unggah langsung ----
  const fd = new FormData();
  fd.append("file", new File([PNG_1KB], "uji.png", { type: "image/png" }), "uji.png");
  fd.append("kind", "chat");
  const up = await fetch(`${BASE}/api/upload`, { method: "POST", body: fd, headers: H });
  const upData = await up.json();
  check("upload langsung 200", up.ok, `url=${upData?.url ?? upData?.error}`);
  const url1 = upData?.url ?? "";
  check("bentuk URL /uploads/", /^\/uploads\/chat\/.+\.png$/.test(url1), url1);

  // ---- 2) ambil via /uploads/* TANPA sesi (jalur rewrite → DB) ----
  const g1 = await fetch(`${BASE}${url1}`);
  const b1 = Buffer.from(await g1.arrayBuffer());
  check("GET /uploads/* tanpa sesi 200", g1.status === 200, `ct=${g1.headers.get("content-type")}`);
  check("byte cocok (langsung)", b1.equals(PNG_1KB), `${b1.length}B`);
  check("Cache-Control immutable", (g1.headers.get("cache-control") ?? "").includes("immutable"));

  // ---- 3) HEAD ----
  const h1 = await fetch(`${BASE}${url1}`, { method: "HEAD" });
  check("HEAD 200 + length", h1.status === 200 && h1.headers.get("content-length") === String(PNG_1KB.length));

  // ---- 4) /api/media/<name> dengan sesi (jalur langsung) ----
  const name1 = url1.split("/").pop();
  const g2 = await fetch(`${BASE}/api/media/${name1}`, { headers: H });
  check("GET /api/media + sesi 200", g2.status === 200);

  // ---- 5) unggah bertahap 5 MB ----
  const total = 2, per = Math.ceil(BIG.length / total);
  const initFd = new FormData();
  initFd.append("action", "init");
  initFd.append("file", new File([], "besar.mp4", { type: "video/mp4" }), "besar.mp4");
  initFd.append("size", String(BIG.length));
  initFd.append("mime", "video/mp4");
  initFd.append("kind", "chat");
  initFd.append("totalChunks", String(total));
  const init = await fetch(`${BASE}/api/upload/chunk`, { method: "POST", body: initFd, headers: H });
  const initData = await init.json();
  check("chunk init", init.ok, `id=${initData?.id ?? initData?.error}`);

  for (let i = 0; i < total; i++) {
    const part = BIG.subarray(i * per, Math.min((i + 1) * per, BIG.length));
    const cfd = new FormData();
    cfd.append("id", initData.id);
    cfd.append("index", String(i));
    cfd.append("final", String(i === total - 1));
    cfd.append("file", new Blob([part]), `${i}.part`);
    const c = await fetch(`${BASE}/api/upload/chunk`, { method: "POST", body: cfd, headers: H });
    const cd = await c.json();
    check(`chunk ${i}${i === total - 1 ? " (final)" : ""}`, c.ok, cd?.error ?? "");
  }
  const url2 = initData.url;
  const g3 = await fetch(`${BASE}${url2}`);
  const b3 = Buffer.from(await g3.arrayBuffer());
  check("GET besar 200 + byte cocok", b3.equals(BIG), `${b3.length}/${BIG.length}B`);
  const md1 = createHash("md5").update(BIG).digest("hex");
  const md2 = createHash("md5").update(b3).digest("hex");
  check("md5 identik", md1 === md2, md2.slice(0, 10));

  // ---- 6) Range request ----
  const r1 = await fetch(`${BASE}${url2}`, { headers: { Range: "bytes=0-99" } });
  check("Range 0-99 → 206", r1.status === 206, r1.headers.get("content-range") ?? "");
  const rb = Buffer.from(await r1.arrayBuffer());
  check("Range isi cocok", rb.length === 100 && rb.equals(BIG.subarray(0, 100)));

  const r2 = await fetch(`${BASE}${url2}`, { headers: { Range: "bytes=-500" } });
  const rb2 = Buffer.from(await r2.arrayBuffer());
  check("Range suffix -500", r2.status === 206 && rb2.equals(BIG.subarray(BIG.length - 500)));

  // ---- 7) berkas DB-only via /uploads/<kind>/<name> (skenario produksi) ----
  //      (url2 TIDAK ada di disk — seluruhnya dari DB)

  // ---- 8) penolakan tanpa sesi ----
  const noAuth = await fetch(`${BASE}/api/upload`, { method: "POST", body: new FormData() });
  check("upload tanpa sesi → 401", noAuth.status === 401);

  // ---- 9) SVG dipaksa unduh (anti-XSS) ----
  const svgFd = new FormData();
  svgFd.append("file", new File([Buffer.from("<svg onload=alert(1)>")], "x.svg", { type: "image/svg+xml" }), "x.svg");
  svgFd.append("kind", "misc");
  const svgUp = await fetch(`${BASE}/api/upload`, { method: "POST", body: svgFd, headers: H });
  const svgData = await svgUp.json();
  if (svgUp.ok) {
    const svgGet = await fetch(`${BASE}${svgData.url}`);
    check("SVG → octet-stream (unduh)", (svgGet.headers.get("content-type") ?? "").includes("octet-stream"));
    await prisma.media.deleteMany({ where: { name: svgData.url.split("/").pop() } });
  } else {
    check("SVG ditolak saat unggah", [400, 415].includes(svgUp.status));
  }

  // ---- 10) pemberesan: hapus media uji ----
  const names = [name1, url2.split("/").pop()];
  const del = await prisma.media.deleteMany({ where: { name: { in: names } } });
  check("hapus media uji (pemberesan)", del.count === 2, `hapus=${del.count}`);

  console.log(`\nHASIL: ${pass} lulus, ${failcnt} gagal — user uji: ${UNAME} (id ${userId || "?"})`);
  process.exit(failcnt === 0 ? 0 : 1);
} catch (e) {
  console.error("ERROR:", e.message);
  process.exit(1);
} finally {
  // bersih-bersih user uji (media dihapus eksplisit di atas)
  if (UNAME) await prisma.user.deleteMany({ where: { username: UNAME } }).catch(() => undefined);
  await prisma.$disconnect();
}
