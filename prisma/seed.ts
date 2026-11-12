/* Seed data demo: IndiGoo (WA Business clone) */
import { PrismaClient } from "@prisma/client";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { wibDateKey } from "../src/lib/wib";

const db = new PrismaClient();

// ---------- helpers ----------
const mins = (n: number) => new Date(Date.now() - n * 60_000);
const hrs = (n: number) => new Date(Date.now() - n * 3_600_000);
const days = (n: number) => new Date(Date.now() - n * 86_400_000);

function tinyWav(seconds = 1.2, freq = 620): Buffer {
  const sampleRate = 8000;
  const total = Math.floor(sampleRate * seconds);
  const data = Buffer.alloc(total * 2);
  for (let i = 0; i < total; i++) {
    const t = i / sampleRate;
    const fade = Math.min(1, t * 8) * Math.min(1, (seconds - t) * 4);
    const v = Math.sin(2 * Math.PI * freq * t) * 0.25 * fade;
    data.writeInt16LE(Math.round(v * 32767), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

// PDF satu halaman minimal (Batch 4: dokumen seed adalah berkas nyata di disk,
// bukan placeholder "#" maupun data URL di database)
function tinyPdf(): Buffer {
  const lines = [
    "Invoice BJ-2024-0187",
    "IndiGoo - Toko Souvenir & Pangan Olahan",
    "",
    "Batik Parang Sogan (2 m) x 2    500.000 mP",
    "Total: 500.000 mP",
    "",
    "Terima kasih atas pesanan Anda.",
  ];
  let content = "";
  let y = 790;
  for (const ln of lines) {
    content += `BT /F1 12 Tf 56 ${y} Td (${ln.replace(/[\\()]/g, " ")}) Tj ET\n`;
    y -= 24;
  }
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}endstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefStart = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += `${off.toString().padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(pdf, "latin1");
}

async function main() {
  // ==== PENJAGA NON-DESTRUKTIF (diperkuat Task 48) ====
  // Seed TIDAK PERNAH menimpa/menghidupkan kembali data apa pun. Reset total hanya jika
  // flag --force. Seed hanya berjalan bila database BENAR-BENAR kosong — sehingga data
  // yang dibuat/ubah/dihapus pengguna (produk, chat, kontak, channel, komunitas, dst.)
  // tidak akan pernah berubah kembali karena seed.
  const force = process.argv.includes("--force");
  if (!force) {
    const [existingProfile, contactCount, productCount, chatCount, messageCount, channelCount, communityCount] =
      await Promise.all([
        db.profile.findUnique({ where: { id: "main" } }),
        db.contact.count(),
        db.product.count(),
        db.chat.count(),
        db.message.count(),
        db.channel.count(),
        db.community.count(),
      ]);
    const hasAnyData = !!existingProfile || [contactCount, productCount, chatCount, messageCount, channelCount, communityCount].some((n) => n > 0);
    if (hasAnyData) {
      console.log("ℹ️  Seed dilewati: database sudah berisi data. Perubahan Anda AMAN (tidak ditimpa).");
      console.log("   Untuk reset total ke data demo: bun run db:seed:force");
      await db.$disconnect();
      return;
    }
  }

  // wipe (order matters) — hanya berjalan saat database kosong ATAU --force
  await db.message.deleteMany();
  await db.chat.deleteMany();
  await db.callLog.deleteMany();
  await db.story.deleteMany();
  await db.broadcast.deleteMany();
  await db.quickReply.deleteMany();
  await db.channelPost.deleteMany();
  await db.channel.deleteMany();
  await db.community.deleteMany();
  await db.device.deleteMany();
  await db.dailyStat.deleteMany();
  await db.chatBackup.deleteMany();
  await db.product.deleteMany();
  await db.collection.deleteMany();
  await db.label.deleteMany();
  await db.contact.deleteMany();

  // ---------- BERKAS MEDIA SEED (Batch 4) ----------
  // Media pesan seed ditulis sebagai berkas nyata di public/uploads/chat/ —
  // DB hanya menyimpan URL-nya (bukan lagi base64 / placeholder "#").
  const seedUploadDir = path.join(process.cwd(), "public", "uploads", "chat");
  await mkdir(seedUploadDir, { recursive: true });
  await writeFile(path.join(seedUploadDir, "seed-pesan-suara.wav"), tinyWav());
  await writeFile(path.join(seedUploadDir, "seed-invoice.pdf"), tinyPdf());
  const seedWavUrl = "/uploads/chat/seed-pesan-suara.wav";
  const seedInvoiceUrl = "/uploads/chat/seed-invoice.pdf";

  // PENTING: Profile TIDAK dihapus. Identitas bisnis (nama aplikasi/bisnis, logo,
  // deskripsi, pengaturan) adalah milik user — reset demo TIDAK BOLEH menimpanya.
  // Profile demo hanya dibuat bila database benar-benar belum punya profile.
  const existingProfile = await db.profile.findUnique({ where: { id: "main" } });
  if (!existingProfile) {
    // ---------- PROFILE ----------
    await db.profile.create({
      data: {
        id: "main",
        businessName: "IndiGoo",
        ownerName: "Pak Jaya Santoso",
        category: "Toko Souvenir & Pangan Olahan",
        description:
          "Toko oleh-oleh khas Yogyakarta sejak 2015. Menyediakan kopi arabika, keripik singkong, batik tulis, songket, dan kerajinan kulit. Melayani pembelian retail & grosir (reseller).",
        address: "Jl. Malioboro No. 24, Sosromenduran, Gedong Tengen, Kota Yogyakarta, DIY 55271",
        lat: -7.7929,
        lng: 110.3657,
        phone: "+62 851-9651-3337",
        email: "halo@indigoo.id",
        website: "https://indigoo.id",
        instagram: "indigoo",
        facebook: "IndiGoo",
        tiktok: "indigoo",
        hours: JSON.stringify([
          { day: "Senin", open: "08:00", close: "17:00", closed: false },
          { day: "Selasa", open: "08:00", close: "17:00", closed: false },
          { day: "Rabu", open: "08:00", close: "17:00", closed: false },
          { day: "Kamis", open: "08:00", close: "17:00", closed: false },
          { day: "Jumat", open: "08:00", close: "16:30", closed: false },
          { day: "Sabtu", open: "08:00", close: "18:00", closed: false },
          { day: "Minggu", open: "", close: "", closed: true },
        ]),
        logoUrl: "/images/logo.png",
        greetingText:
          "Halo! Terima kasih sudah menghubungi IndiGoo 🙏 Ada yang bisa kami bantu? Ketik *katalog* untuk melihat produk kami.",
        awayText:
          "Terima kasih atas pesan Anda. Saat ini kami sedang di luar jam operasional (08.00–17.00 WIB). Pesan Anda akan segera kami balas begitu toko buka kembali. 🙏",
      },
    });
    console.log("✅ Profile demo dibuat (database belum punya profile).");
  } else {
    console.log(`🛡️  Profile bisnis DIPERTAHANKAN: "${existingProfile.businessName}" — perubahan Anda aman.`);
  }

  // ---------- LABELS ----------
  const labelData = [
    { name: "Pelanggan Baru", colorKey: "emerald", sortOrder: 1 },
    { name: "Prospek", colorKey: "amber", sortOrder: 2 },
    { name: "Menunggu Pembayaran", colorKey: "orange", sortOrder: 3 },
    { name: "Sudah Bayar", colorKey: "teal", sortOrder: 4 },
    { name: "Pesanan Diproses", colorKey: "purple", sortOrder: 5 },
    { name: "Pesanan Selesai", colorKey: "green", sortOrder: 6 },
    { name: "VIP", colorKey: "pink", sortOrder: 7 },
    { name: "Reseller", colorKey: "red", sortOrder: 8 },
  ];
  const labels: Record<string, { id: string }> = {};
  for (const l of labelData) {
    labels[l.name] = await db.label.create({ data: l });
  }

  // ---------- CONTACTS ----------
  const c = async (
    name: string,
    phone: string,
    colorKey: string,
    about: string,
    labelNames: string[],
    lastSeenMin: number | null
  ) => {
    const found = await db.contact.create({
      data: {
        name,
        phone,
        colorKey,
        about,
        lastSeen: lastSeenMin === null ? null : mins(lastSeenMin),
        labelIds: JSON.stringify(labelNames.map((n) => labels[n].id)),
      },
    });
    return found;
  };

  const budi = await c("Budi Santoso", "+62 813-1111-2222", "emerald", "Halo, saya Budi 👋", ["Pelanggan Baru", "Prospek"], 12);
  const siti = await c("Siti Rahayu", "+62 812-2222-3333", "purple", "Sibuk dulu ya", ["VIP", "Sudah Bayar"], 45);
  const andi = await c("Andi Wijaya", "+62 813-3333-4444", "amber", "Available", ["Prospek"], 180);
  const dewi = await c("Dewi Lestari", "+62 812-4444-5555", "pink", "Bertedua di cahaya-Nya", ["Pesanan Diproses", "Menunggu Pembayaran"], 30);
  const rudi = await c("Rudi Hartono", "+62 813-5555-6666", "teal", "Di kantor", ["Pelanggan Baru"], 2880);
  const maya = await c("Maya Putri", "+62 812-6666-7777", "rose", "Reseller resmi BJ ✅", ["VIP", "Reseller"], 100);
  const agus = await c("Agus Salim", "+62 813-7777-8888", "orange", "Santai dulu", ["Pesanan Selesai"], 4320);
  const fitri = await c("Fitri Handayani", "+62 812-8888-9999", "violet", "Owner Toko Fitri", ["Reseller", "Sudah Bayar"], 90);
  const maju = await c("Toko Maju Jaya", "+62 813-9999-0000", "cyan", "Toko grosir jakarta", ["Reseller", "VIP"], 200);
  const kiosk = await c("Ibu Kiosk", "+62 812-0000-1111", "lime", "Bu Kios Malioboro", ["Prospek"], 10080);

  const allContacts = [budi, siti, andi, dewi, rudi, maya, agus, fitri, maju, kiosk];

  // ---------- CHATS & MESSAGES ----------
  type Msg = Partial<{
    sender: string;
    type: string;
    body: string;
    mediaUrl: string;
    mediaName: string;
    mediaMime: string;
    mediaSize: number;
    latitude: number;
    longitude: number;
    placeName: string;
    cardName: string;
    cardPhone: string;
    productId: string;
    status: string;
    at: Date;
  }>;

  const mkChat = async (
    data: { type?: string; name?: string; contactId?: string; members?: string; groupDesc?: string; pinned?: boolean; archived?: boolean; muted?: boolean; unread?: number; isBusinessChat?: boolean; colorKey?: string; avatarUrl?: string },
    msgs: Msg[]
  ) => {
    const last = msgs.length ? msgs[msgs.length - 1].at ?? hrs(1) : hrs(1);
    const chat = await db.chat.create({
      data: {
        type: "PRIVATE",
        ...data,
        lastMessageAt: last,
      },
    });
    for (const m of msgs) {
      await db.message.create({
        data: {
          chatId: chat.id,
          sender: m.sender ?? "me",
          type: m.type ?? "TEXT",
          body: m.body ?? "",
          mediaUrl: m.mediaUrl,
          mediaName: m.mediaName,
          mediaMime: m.mediaMime,
          mediaSize: m.mediaSize,
          latitude: m.latitude,
          longitude: m.longitude,
          placeName: m.placeName,
          cardName: m.cardName,
          cardPhone: m.cardPhone,
          productId: m.productId,
          status: m.sender === "me" || m.sender === "system" ? m.status ?? "READ" : "READ",
          createdAt: m.at ?? hrs(1),
        },
      });
    }
    return chat;
  };

  // Budi Santoso — tanya produk kopi (unread 2)
  const chatBudi = await mkChat(
    { contactId: budi.id, unread: 2, isBusinessChat: true },
    [
      { sender: budi.id, body: "Halo kak, mau tanya kopi arabika gayo tersedia?", at: hrs(5) },
      { sender: "system", type: "SYSTEM", body: "Pesan otomatis: Halo! Terima kasih sudah menghubungi IndiGoo 🙏", at: hrs(5) },
      { sender: "me", body: "Halo Pak Budi 😊 Tersedia kak! Roast bean maupun grinding ada.", status: "READ", at: hrs(4.9) },
      { sender: "me", type: "PRODUCT", productId: "prod-kopi", body: "Kopi Arabika Gayo 250g", status: "READ", at: hrs(4.8) },
      { sender: budi.id, body: "Ini tadi beli 2 di toko, enak banget kopi nya 👍", at: hrs(3.2) },
      { sender: budi.id, type: "IMAGE", mediaUrl: "/images/product-kopi.png", body: "Ini yang kemarin ya kak", at: mins(28) },
      { sender: budi.id, body: "Besok bisa antar ke Kaliurang gak? 😄", at: mins(15) },
    ]
  );

  // Siti Rahayu — VIP, order batik (pinned)
  const chatSiti = await mkChat(
    { contactId: siti.id, pinned: true, isBusinessChat: true },
    [
      { sender: siti.id, body: "Kak, batik parang 2 meter warna sogan ada stok?", at: days(1.2) },
      { sender: "me", body: "Ada kak, hari ini baru masuk 5 lembar ✅", status: "READ", at: days(1.1) },
      { sender: "me", type: "IMAGE", mediaUrl: "/images/product-batik.png", body: "Ini kak motifnya", status: "READ", at: days(1.09) },
      { sender: siti.id, body: "Oke, ambil 2 ya. Transfer kemarin sudah dikirim", at: days(1) },
      { sender: "me", type: "DOC", mediaUrl: seedInvoiceUrl, mediaName: "Invoice_BJ-2024-0187.pdf", mediaMime: "application/pdf", mediaSize: 184320, body: "Terima kasih 🙏 Berikut invoice-nya", status: "READ", at: days(0.9) },
      { sender: "me", type: "LOCATION", latitude: -7.7929, longitude: 110.3657, placeName: "IndiGoo, Malioboro", body: "Ini lokasi toko kami kak, bisa ambil langsung", status: "READ", at: days(0.8) },
      { sender: siti.id, type: "AUDIO", mediaUrl: seedWavUrl, body: "Pesan suara (1:12)", mediaSize: 56000, at: hrs(20) },
      { sender: siti.id, body: "Sudah sampai, batiknya bagus banget! Terima kasih ya 😍", at: hrs(2) },
    ]
  );

  // Dewi Lestari — nunggu pembayaran
  const chatDewi = await mkChat(
    { contactId: dewi.id, unread: 1, isBusinessChat: true },
    [
      { sender: dewi.id, body: "Kak, madu hutan 500ml ready?", at: hrs(7) },
      { sender: "me", body: "Ready kak 😊 120 ribu, free bubble wrap + bubble wrap anti pecah", status: "DELIVERED", at: hrs(6.9) },
      { sender: "me", body: "Bisa juga COD area Jogja kak", status: "READ", at: hrs(6.8) },
      { sender: dewi.id, body: "Oke siap, saya transfer besok pagi ya", at: hrs(2.5) },
    ]
  );

  // Maya Putri — reseller
  const chatMaya = await mkChat(
    { contactId: maya.id, isBusinessChat: true },
    [
      { sender: maya.id, body: "Kak, keripik balado bisa 50 pcs harga reseller?", at: days(2) },
      { sender: "me", body: "Bisa kak, 20.000/pcs, free ongkir ke Semarang min. 50 pcs ✅", status: "READ", at: days(1.9) },
      { sender: maya.id, body: "Siap, saya kirim alamat ya", at: days(1.8) },
      { sender: "me", type: "CONTACT_CARD", cardName: "Kurir IndiGoo (Anton)", cardPhone: "+62 811-2345-6789", body: "Nanti dijemput kurir kami", status: "READ", at: days(1.7) },
      { sender: maya.id, body: "Sudah dikirim uangnya kak, cek ya 🙏", at: hrs(10) },
      { sender: "me", body: "Sudah masuk kak, terima kasih! Pesanan diproses hari ini 🚚", status: "READ", at: hrs(9.5) },
    ]
  );

  // Andi Wijaya — prospek pendek
  const chatAndi = await mkChat(
    { contactId: andi.id },
    [
      { sender: andi.id, body: "Permisi, untuk songket tenun bisa lihat katalog?", at: days(3) },
      { sender: "me", body: "Tentu kak, ini katalog lengkap kami:", status: "READ", at: days(3) },
      { sender: "me", type: "IMAGE", mediaUrl: "/images/product-songket.png", body: "Songket Tenun Premium — Rp 450.000", status: "READ", at: days(2.9) },
    ]
  );

  // Rudi Hartono — archived
  const chatRudi = await mkChat(
    { contactId: rudi.id, archived: true },
    [
      { sender: rudi.id, body: "Kak, tas kulitnya ready stock warna hitam?", at: days(6) },
      { sender: "me", body: "Ready kak, besok bisa kami kirim ✅", status: "READ", at: days(6) },
      { sender: rudi.id, body: "Sudah diterima, makasih!", at: days(5) },
    ]
  );

  // Agus Salim — lama
  const chatAgus = await mkChat(
    { contactId: agus.id },
    [
      { sender: agus.id, body: "Terima kasih kak, pesanan #BJ-2024-0142 sudah sampai dan aman 🙏", at: days(8) },
      { sender: "me", body: "Sama-sama kak! Jangan lupa review ya 😊", status: "READ", at: days(8) },
    ]
  );

  // Group Reseller
  const chatGroup = await mkChat(
    {
      type: "GROUP",
      name: "Reseller IndiGoo 🛍️",
      colorKey: "teal",
      groupDesc: "Grup reseller resmi IndiGoo. Info stok, harga grosir & pengiriman.",
      members: JSON.stringify([
        { contactId: maya.id, role: "admin" },
        { contactId: fitri.id, role: "admin" },
        { contactId: maju.id, role: "member" },
      ]),
      unread: 3,
    },
    [
      { sender: "system", type: "SYSTEM", body: "Maya Putri menambahkan Toko Maju Jaya", at: days(4) },
      { sender: fitri.id, body: "Pagil! Stok batik sogan masih ada gak kak?", at: hrs(26) },
      { sender: "me", body: "Ada kak Fitri, sisa 12 lembar. Prioritas reseller dulu 😊", status: "READ", at: hrs(25) },
      { sender: maju.id, body: "Untuk grosir ke Jakarta bisa rekap mingguan?", at: hrs(9) },
      { sender: "me", body: "Bisa banget kak. Nanti saya buatkan price list rekapnya 📋", status: "READ", at: hrs(8.5) },
      { sender: maya.id, body: "Noted kak 🙌", at: hrs(8) },
      { sender: fitri.id, body: "Mantap, thanks kak 👍", at: hrs(1.5) },
    ]
  );

  // ---------- CALLS ----------
  await db.callLog.createMany({
    data: [
      { contactId: siti.id, contactName: siti.name, colorKey: siti.colorKey, kind: "VIDEO", direction: "IN", durationSec: 0, createdAt: hrs(3) },
      { contactId: budi.id, contactName: budi.name, colorKey: budi.colorKey, kind: "VOICE", direction: "OUT", durationSec: 125, createdAt: hrs(14) },
      { contactId: dewi.id, contactName: dewi.name, colorKey: dewi.colorKey, kind: "VOICE", direction: "IN", durationSec: 45, createdAt: days(1) },
      { contactId: maya.id, contactName: maya.name, colorKey: maya.colorKey, kind: "VIDEO", direction: "OUT", durationSec: 300, createdAt: days(1.5) },
      { contactId: fitri.id, contactName: fitri.name, colorKey: fitri.colorKey, kind: "VOICE", direction: "MISSED", durationSec: 0, createdAt: days(2) },
      { contactId: agus.id, contactName: agus.name, colorKey: agus.colorKey, kind: "VOICE", direction: "OUT", durationSec: 62, createdAt: days(3) },
    ],
  });

  // ---------- KATALOG ----------
  const makanan = await db.collection.create({ data: { name: "Makanan & Minuman" } });
  const kerajinan = await db.collection.create({ data: { name: "Kerajinan" } });
  const fashion = await db.collection.create({ data: { name: "Fashion" } });

  await db.product.createMany({
    data: [
      {
        id: "prod-kopi",
        name: "Kopi Arabika Gayo 250g",
        price: 85000,
        description: "Kopi arabika single origin dari dataran tinggi Gayo, Aceh. Roast medium, notes cokelat & karamel. Tersedia whole bean / grind.",
        sku: "BJ-KOPI-001",
        imageUrl: "/images/product-kopi.png",
        link: "https://indigoo.id/kopi-arabika-gayo",
        stock: 42,
        collectionId: makanan.id,
      },
      {
        name: "Keripik Singkong Balado 500g",
        price: 25000,
        description: "Keripik singkong renyah dengan bumbu balado khas Jogja. Tanpa MSG, tahan 3 bulan.",
        sku: "BJ-KRPIK-002",
        imageUrl: "/images/product-keripik.png",
        link: "https://indigoo.id/keripik-balado",
        stock: 120,
        collectionId: makanan.id,
      },
      {
        name: "Madu Hutan Murni 500ml",
        price: 120000,
        description: "Madu hutan asli Sumbawa, dipanen petani lokal. Tanpa gula tambahan, sudah uji lab.",
        sku: "BJ-MADU-003",
        imageUrl: "/images/product-madu.png",
        link: "https://indigoo.id/madu-hutan",
        stock: 35,
        collectionId: makanan.id,
      },
      {
        name: "Batik Tulis Parang Sogan 2m",
        price: 275000,
        description: "Batik tulis asli Pekalongan, motif parang sogan, pewarna alami indigofera. Cocok untuk baju & sarung.",
        sku: "BJ-BTK-004",
        imageUrl: "/images/product-batik.png",
        link: "https://indigoo.id/batik-parang",
        stock: 12,
        collectionId: kerajinan.id,
      },
      {
        name: "Songket Tenun Premium",
        price: 450000,
        description: "Songket tenun tangan dengan benang emas asli. Pilihan tepat untuk acara adat & hantaran.",
        sku: "BJ-SNGKT-005",
        imageUrl: "/images/product-songket.png",
        link: "https://indigoo.id/songket-premium",
        stock: 8,
        collectionId: kerajinan.id,
      },
      {
        name: "Tas Kulit Jepit Handmade",
        price: 165000,
        description: "Tas kulit sapi asli buatan tangan pengrajin Kotagede. Tersedia warna cokelat, hitam, mustard.",
        sku: "BJ-TAS-006",
        imageUrl: "/images/product-tas.png",
        link: "https://indigoo.id/tas-kulit",
        stock: 20,
        collectionId: fashion.id,
      },
    ],
  });

  // ---------- STATUS / STORIES ----------
  await db.story.createMany({
    data: [
      {
        sender: "me",
        mediaType: "TEXT",
        body: "Promo Gajian! Diskon 20% semua produk s/d akhir pekan 🎉🎉",
        bgColor: "emerald",
        views: 34,
        createdAt: hrs(4),
        expiresAt: hrs(20),
      },
      {
        sender: "me",
        mediaType: "IMAGE",
        body: "Menu baru: Kopi Gayo biji segar roasting hari ini 🔥",
        mediaUrl: "/images/product-kopi.png",
        views: 51,
        createdAt: hrs(10),
        expiresAt: hrs(14),
      },
      {
        sender: "me",
        mediaType: "IMAGE",
        body: "Testimoni ibu Siti — terima kasih sudah order lagi 😍",
        mediaUrl: "/images/product-batik.png",
        views: 19,
        createdAt: hrs(28),
        expiresAt: hrs(-4), // sudah lewat 4 jam lagi? no: 20 jam lagi
      },
      {
        sender: siti.id,
        mediaType: "IMAGE",
        body: "Batiknya sampai! Mantap 🔥",
        mediaUrl: "/images/product-batik.png",
        views: 8,
        createdAt: hrs(6),
        expiresAt: hrs(18),
      },
      {
        sender: maya.id,
        mediaType: "IMAGE",
        body: "Restock keripik dulu 🙌",
        mediaUrl: "/images/product-keripik.png",
        views: 5,
        createdAt: hrs(12),
        expiresAt: hrs(12),
      },
      {
        sender: budi.id,
        mediaType: "TEXT",
        body: "Buka puasa bareng kopinya IndiGoo ☕",
        bgColor: "amber",
        views: 3,
        createdAt: hrs(8),
        expiresAt: hrs(16),
      },
    ],
  });

  // ---------- BROADCASTS ----------
  await db.broadcast.createMany({
    data: [
      {
        name: "Promo Gajian Akhir Bulan",
        message: "🎉 *PROMO GAJIAN!* Diskon 20% untuk semua produk di IndiGoo. Berlaku sampai akhir pekan. Kunjungi katalog: indigoo.id/katalog",
        audienceType: "ALL",
        recipientCount: 10,
        sentCount: 10,
        deliveredCount: 9,
        readCount: 7,
        failedCount: 1,
        status: "SENT",
        createdAt: days(2),
        sentAt: days(2),
      },
      {
        name: "Rilis Produk: Songket Premium",
        message: "✨ Produk baru! Songket tenun premium dengan benang emas asli. Harga spesial untuk reseller. Cek katalog sekarang!",
        audienceType: "LABEL",
        audienceLabel: labels["Reseller"].id,
        recipientCount: 3,
        sentCount: 3,
        deliveredCount: 3,
        readCount: 3,
        failedCount: 0,
        status: "SENT",
        createdAt: days(5),
        sentAt: days(5),
      },
      {
        name: "Diskon Hari Kemerdekaan",
        message: "🇮🇩 DIRGAHAYU! Diskon 17% semua kerajinan batik & songket. Gunakan kode MERDEKA17.",
        audienceType: "ALL",
        status: "DRAFT",
        createdAt: hrs(30),
      },
    ],
  });

  // ---------- QUICK REPLIES ----------
  await db.quickReply.createMany({
    data: [
      { shortcut: "/harga", message: "Berikut daftar harga terbaru kami kak: Kopi Gayo 250g Rp 85.000, Keripik Balado Rp 25.000, Madu Hutan Rp 120.000, Batik Tulis Rp 275.000, Songket Rp 450.000, Tas Kulit Rp 165.000. 😊", sortOrder: 1 },
      { shortcut: "/ongkir", message: "Ongkir dihitung sesuai berat & lokasi ya kak. Area Jogja free ongkir min. belanja Rp 100.000 🚚 Luar kota via JNE/J&T/SiCepat.", sortOrder: 2 },
      { shortcut: "/bayar", message: "Pembayaran bisa via Transfer (BCA 1234567890 a.n. IndiGoo), QRIS, atau COD area Jogja 🙏", sortOrder: 3 },
      { shortcut: "/katalog", message: "Katalog lengkap bisa dilihat di: https://indigoo.id/katalog atau ketik nama produk yang kakak cari 😊", sortOrder: 4 },
      { shortcut: "/thanks", message: "Terima kasih sudah berbelanja di IndiGoo 🙏🙏 Jangan lupa follow IG @indigoo untuk promo terbaru!", sortOrder: 5 },
    ],
  });

  // ---------- CHANNELS ----------
  const chMine = await db.channel.create({
    data: {
      name: "IndiGoo Official",
      handle: "indigoo",
      description: "Channel resmi IndiGoo. Info produk, promo & tips UMKM.",
      colorKey: "emerald",
      followers: 1240,
      isMine: true,
      verified: false,
    },
  });
  const chUmkm = await db.channel.create({
    data: {
      name: "UMKM Indonesia",
      handle: "umkmindonesia",
      description: "Channel terbesar untuk pelaku UMKM se-Indonesia. Tips, pelatihan & info subsidi.",
      colorKey: "amber",
      followers: 152000,
      following: true,
      verified: true,
    },
  });
  const chKuliner = await db.channel.create({
    data: {
      name: "Kuliner Nusantara",
      handle: "kulinernusantara",
      description: "Update kuliner legendaris dari Sabang sampai Merauke 🍜",
      colorKey: "orange",
      followers: 89300,
      following: true,
    },
  });
  const chTips = await db.channel.create({
    data: {
      name: "Tips Jualan Online",
      handle: "tipsjualan",
      description: "Tips marketing, foto produk & closing jualan tiap hari 📈",
      colorKey: "purple",
      followers: 45200,
      following: false,
    },
  });

  await db.channelPost.createMany({
    data: [
      { channelId: chMine.id, body: "🚨 RESTOCK! Kopi Arabika Gayo 250g sudah tersedia kembali. Buruan order sebelum kehabisan!", likes: 42, views: 512, createdAt: hrs(6) },
      { channelId: chMine.id, body: "Tips hari ini: Balas chat pelanggan maksimal 5 menit, konversi naik sampai 3x lipat! ⏱️", likes: 88, views: 923, createdAt: days(1) },
      { channelId: chMine.id, body: "Terima kasih 1.200 followers! 🎉 Berikut video behind the scene roasting kopi kami.", imageUrl: "/images/product-kopi.png", likes: 120, views: 1100, createdAt: days(2) },
      { channelId: chUmkm.id, body: "📋 Pendaftaran pelatihan digital marketing gratis untuk 500 UMKM dibuka! Link pendaftaran di bio.", likes: 990, views: 12400, createdAt: hrs(20) },
      { channelId: chUmkm.id, body: "Penting! Mulai bulan depan, laporan pajak UMKM bisa via aplikasi. Simak panduannya pada unggahan berikutnya.", likes: 650, views: 8100, createdAt: days(2) },
      { channelId: chKuliner.id, body: "🍜 5 warung bakmi legendaris Jogja yang buka 24 jam. Simak daftarnya!", likes: 430, views: 5600, createdAt: hrs(30) },
      { channelId: chKuliner.id, body: "Polling: Gudeg Yu Djum vs Gudeg Pawon? Komen pilihanmu! 👇", likes: 210, views: 3200, createdAt: days(1.5) },
      { channelId: chTips.id, body: "Fotoproduk pakai cahaya jendela pagi (07-09) hasilnya 2x lebih bagus daripada lampu kuning 💡📸", likes: 320, views: 4100, createdAt: days(3) },
    ],
  });

  // ---------- COMMUNITY ----------
  await db.community.create({
    data: {
      name: "Komunitas UMKM Jogja",
      description: "Wadah pelaku usaha mikro & kecil di DIY. Berbagi info stok, kurir, dan event bazar.",
      colorKey: "teal",
      memberCount: 256,
      announcement: "Bazar UMKM Ramadhan akan dihelat di Taman Pintar, 15-20 bulan depan. Pendaftaran lapak via pengurus.",
      groups: JSON.stringify([
        { id: "g1", name: "Pengumuman", members: 256, description: "Info penting dari pengurus" },
        { id: "g2", name: "Diskusi Produk", members: 190, description: "Showcase & diskusi produk anggota" },
        { id: "g3", name: "Kurir & Ongkir", members: 175, description: "Info tarif & rekomendasi kurir" },
        { id: "g4", name: "Bazar & Event", members: 210, description: "Koordinasi event bazar" },
      ]),
    },
  });

  // ---------- DEVICES ----------
  await db.device.createMany({
    data: [
      { name: "iPhone 13 (Perangkat utama)", platform: "PHONE", current: true, lastActive: mins(1), location: "Yogyakarta, Indonesia" },
      { name: "Chrome di Windows", platform: "WEB", lastActive: hrs(2), location: "Yogyakarta, Indonesia" },
      { name: "MacBook Pro — WhatsApp Desktop", platform: "DESKTOP", lastActive: days(1), location: "Yogyakarta, Indonesia" },
      { name: "iPad Air (Safari)", platform: "TABLET", lastActive: days(4), location: "Semarang, Indonesia" },
    ],
  });

  // ---------- STATS ----------
  const statRows: { date: string; sent: number; delivered: number; read: number; received: number; failed: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = days(i);
    const sent = 60 + Math.round(Math.sin(i * 1.7) * 25 + Math.random() * 40);
    const delivered = Math.round(sent * (0.88 + Math.random() * 0.1));
    const read = Math.round(delivered * (0.7 + Math.random() * 0.25));
    const received = Math.round(sent * (0.5 + Math.random() * 0.4));
    const failed = sent - delivered;
    statRows.push({
      // Batch 4: kunci tanggal harian pakai kalender WIB — konsisten dengan
      // bumpDailyStat() di runtime (lihat src/lib/daily-stat.ts)
      date: wibDateKey(d),
      sent,
      delivered,
      read,
      received,
      failed,
    });
  }
  await db.dailyStat.createMany({ data: statRows });

  // ---------- BACKUPS ----------
  await db.chatBackup.createMany({
    data: [
      { sizeKb: 18432, messageCount: 8642, auto: true, createdAt: days(1) },
      { sizeKb: 16890, messageCount: 7911, auto: true, createdAt: days(2) },
      { sizeKb: 15234, messageCount: 7102, auto: false, createdAt: days(5) },
    ],
  });

  console.log("✅ Seed selesai: profile, 8 label, 10 kontak, 8 chat, produk, story, siaran, channel, komunitas, perangkat, statistik, backup");
  console.log(`   chat ids: budi=${chatBudi.id} siti=${chatSiti.id} group=${chatGroup.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
