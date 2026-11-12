// ===================== UJI MEDIA UPLOAD DI PRODUKSI =====================
// Target: https://www.indonesiandigitalgoo.com — akun uji dibuat lalu dihapus
// (media dihapus langsung via Supabase PG oleh skrip pemanggil).
const BASE = "https://www.indonesiandigitalgoo.com";
const UNAME = "mediaprod" + Math.floor(Math.random() * 9000 + 1000);
let pass = 0, failn = 0, userId = "", mediaNames = [];
function check(label, cond, extra = "") {
  if (cond) { pass++; console.log(`  ✓ ${label} ${extra}`); }
  else { failn++; console.log(`  ✗ GAGAL: ${label} ${extra}`); }
}

const PNG_1KB = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(1000, 0x42)]);
const BIG = Buffer.alloc(5 * 1024 * 1024 + 777);
for (let i = 0; i < BIG.length; i += 104729) BIG[i] = 0x2c;

try {
  const reg = await fetch(`${BASE}/api/auth/register`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: UNAME, pin: "778899", password: "prodtest123", agree: true }),
  });
  const regRes = await reg.text();
  check("register di produksi", reg.ok, regRes.slice(0, 100));
  let regData = {};
  try { regData = JSON.parse(regRes); } catch { /* sudah dicek di atas */ }
  userId = regData?.user?.id ?? "";

  const login = await fetch(`${BASE}/api/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: UNAME, password: "prodtest123" }),
  });
  const { token } = await login.json();
  check("login produksi", token?.length > 20);
  const H = { Authorization: `Bearer ${token}` };

  // --- unggah langsung (≤4 MB) ---
  const fd = new FormData();
  fd.append("file", new File([PNG_1KB], "prod-uji.png", { type: "image/png" }), "prod-uji.png");
  fd.append("kind", "chat");
  const up = await fetch(`${BASE}/api/upload`, { method: "POST", body: fd, headers: H });
  const upData = await up.json();
  check("upload langsung produksi", up.ok, upData?.url ?? upData?.error);
  const url1 = upData?.url ?? "";
  mediaNames.push(url1.split("/").pop());

  const g1 = await fetch(`${BASE}${url1}`);
  const b1 = Buffer.from(await g1.arrayBuffer());
  check("GET /uploads/* (rewrite→DB Supabase)", g1.status === 200 && b1.equals(PNG_1KB), `ct=${g1.headers.get("content-type")} ${b1.length}B`);

  // --- unggah bertahap (5 MB, 2 potongan) ---
  const per = Math.ceil(BIG.length / 2);
  const initFd = new FormData();
  initFd.append("action", "init");
  initFd.append("file", new File([], "prod-besar.mp4", { type: "video/mp4" }), "prod-besar.mp4");
  initFd.append("size", String(BIG.length));
  initFd.append("mime", "video/mp4");
  initFd.append("kind", "chat");
  initFd.append("totalChunks", "2");
  const init = await fetch(`${BASE}/api/upload/chunk`, { method: "POST", body: initFd, headers: H });
  const initData = await init.json();
  check("chunk init produksi", init.ok, initData?.id ?? initData?.error);

  for (let i = 0; i < 2; i++) {
    const part = BIG.subarray(i * per, Math.min((i + 1) * per, BIG.length));
    const cfd = new FormData();
    cfd.append("id", initData.id);
    cfd.append("index", String(i));
    cfd.append("final", String(i === 1));
    cfd.append("file", new Blob([part]), `${i}.part`);
    const c = await fetch(`${BASE}/api/upload/chunk`, { method: "POST", body: cfd, headers: H });
    check(`potongan ${i} produksi`, c.ok, (await c.text()).slice(0, 80));
  }
  mediaNames.push(initData.url.split("/").pop());

  const g2 = await fetch(`${BASE}${initData.url}`);
  const b2 = Buffer.from(await g2.arrayBuffer());
  check("GET besar byte-cocok di produksi", b2.equals(BIG), `${b2.length}/${BIG.length}B`);

  const r1 = await fetch(`${BASE}${initData.url}`, { headers: { Range: "bytes=0-999" } });
  check("Range produksi → 206", r1.status === 206, r1.headers.get("content-range") ?? "");

  console.log(`\nHASIL PRODUKSI: ${pass} lulus, ${failn} gagal — user uji: ${UNAME} (id: ${userId})`);
  console.log(`MEDIA_UJI: ${mediaNames.join(",")}`);
  process.exit(failn === 0 ? 0 : 1);
} catch (e) {
  console.error("ERROR:", e.message);
  console.log(`USER_ID: ${userId}`);
  process.exit(1);
}
