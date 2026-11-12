/**
 * Seed konten Beranda (feed video), Marketplace, dan riwayat Panggilan.
 * - Tanpa argumen: hanya seed jika tabel masih kosong (aman dijalankan ulang).
 * - --force: hapus konten demo (authorType=demo / semua MarketItem demo) lalu seed ulang.
 *   Konten yang diunggah pengguna (authorType=user) TIDAK dihapus.
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const force = process.argv.includes("--force");

const VIDEOS = [
  { title: "Busana Batik Prambanan", category: "hiburan", authorName: "Rina Putri", videoUrl: "/videos/hiburan-1.mp4", posterUrl: "/videos/hiburan-1.jpg", likes: 214, isFollower: true, isFollowing: false },
  { title: "Gig Kotagede Malam Hari", category: "hiburan", authorName: "Dedi Setia", videoUrl: "/videos/hiburan-2.mp4", posterUrl: "/videos/hiburan-2.jpg", likes: 96, isFollower: false, isFollowing: true },
  { title: "Cover Gamelan Modern", category: "hiburan", authorName: "Sanggar Svara", videoUrl: "/videos/hiburan-3.mp4", posterUrl: "/videos/hiburan-3.jpg", likes: 178, isFollower: true, isFollowing: true },
  { title: "Suasana Pagi Malioboro", category: "domisili", authorName: "Bayu Amanta", videoUrl: "/videos/domisili-1.mp4", posterUrl: "/videos/domisili-1.jpg", likes: 320, isFollower: true, isFollowing: false },
  { title: "Kalasan dari Drone", category: "domisili", authorName: "JogjaDrone ID", videoUrl: "/videos/domisili-2.mp4", posterUrl: "/videos/domisili-2.jpg", likes: 156, isFollower: false, isFollowing: true },
  { title: "Senja Pantai Indrayanti", category: "domisili", authorName: "Wisata Keluarga", videoUrl: "/videos/domisili-3.mp4", posterUrl: "/videos/domisili-3.jpg", likes: 88, isFollower: false, isFollowing: false },
  { title: "Promo Keripik 20 Persen", category: "promo", authorName: "IndiGoo Official", videoUrl: "/videos/promo-1.mp4", posterUrl: "/videos/promo-1.jpg", likes: 412, isFollower: true, isFollowing: true },
  { title: "Diskon Batik Cap 30 Persen", category: "promo", authorName: "Batik Larasati", videoUrl: "/videos/promo-2.mp4", posterUrl: "/videos/promo-2.jpg", likes: 143, isFollower: true, isFollowing: false },
  { title: "Bundling Kopi Klotok", category: "promo", authorName: "Kopi Klotok Yuk", videoUrl: "/videos/promo-3.mp4", posterUrl: "/videos/promo-3.jpg", likes: 67, isFollower: false, isFollowing: true },
  { title: "Grand Opening Cabang Solo", category: "promo", authorName: "IndiGoo Official", videoUrl: "/videos/promo-4.mp4", posterUrl: "/videos/promo-4.jpg", likes: 251, isFollower: true, isFollowing: true },
];

const MARKET = [
  { name: "Keripik Belut Pedas 250gr", price: 25000, emoji: "🌶️", colorKey: "rose", category: "makanan", sellerName: "IndiGoo Official", sellerPhone: "+62 851-9651-3337", location: "Yogyakarta", rating: 4.9, sold: 1240, stock: 80 },
  { name: "Batik Cap Parang Klasik", price: 185000, emoji: "🧵", colorKey: "amber", category: "fashion", sellerName: "Batik Larasati", sellerPhone: "+62 812-2222-3333", location: "Bantul", rating: 4.8, sold: 320, stock: 25 },
  { name: "Wayang Kulit Miniatur", price: 95000, emoji: "🎭", colorKey: "violet", category: "kerajinan", sellerName: "Sanggar Svara", sellerPhone: "+62 813-4444-5555", location: "Kotagede", rating: 4.7, sold: 95, stock: 14 },
  { name: "Kopi Klotok Bubuk 500gr", price: 45000, emoji: "☕", colorKey: "emerald", category: "makanan", sellerName: "Kopi Klotok Yuk", sellerPhone: "+62 814-5555-6666", location: "Sleman", rating: 4.9, sold: 860, stock: 60 },
  { name: "Perak Kotagede Cincin", price: 150000, emoji: "💍", colorKey: "sky", category: "kerajinan", sellerName: "Kotagede Silver", sellerPhone: "+62 815-6666-7777", location: "Kotagede", rating: 4.8, sold: 210, stock: 18 },
  { name: "Jasa Foto Produk UMKM", price: 350000, emoji: "📸", colorKey: "teal", category: "jasa", sellerName: "JogjaDrone ID", sellerPhone: "+62 816-7777-8888", location: "Sleman", rating: 5.0, sold: 47, stock: 5 },
  { name: "Bakpia Pathok Isi 25", price: 62500, emoji: "🥮", colorKey: "orange", category: "makanan", sellerName: "Toko Bakia Pathok", sellerPhone: "+62 817-8888-9999", location: "Pathok", rating: 4.9, sold: 2100, stock: 120 },
  { name: "Kerajinan Bambu Lampu", price: 120000, emoji: "🏮", colorKey: "lime", category: "kerajinan", sellerName: "Bambu Ngejogja", sellerPhone: "+62 818-9999-0000", location: "Gunungkidul", rating: 4.6, sold: 76, stock: 22 },
  { name: "Kaos Distro Gudeg", price: 89000, emoji: "👕", colorKey: "cyan", category: "fashion", sellerName: "Gudeg Wear", sellerPhone: "+62 819-0000-1111", location: "Yogyakarta", rating: 4.7, sold: 430, stock: 40 },
  { name: "Sayur Hydroponic Segar", price: 20000, emoji: "🥬", colorKey: "green", category: "agro", sellerName: "Hidroponik Omah", sellerPhone: "+62 811-1111-2222", location: "Sleman", rating: 4.8, sold: 640, stock: 55 },
  { name: "Gudeg Kaleng Ready", price: 35000, emoji: "🍲", colorKey: "amber", category: "makanan", sellerName: "Dapur Bu Tum", sellerPhone: "+62 812-3333-4444", location: "Yogyakarta", rating: 4.9, sold: 1780, stock: 90 },
  { name: "Sepeda Gotrik Custom", price: 750000, emoji: "🚲", colorKey: "red", category: "jasa", sellerName: "Bengkel Roda Dua", sellerPhone: "+62 813-2222-1111", location: "Bantul", rating: 4.5, sold: 12, stock: 3 },
  // Kategori Sembako — paket kebutuhan pokok IndiGoo Official
  { name: "Paket Sembako 250.000 mP", price: 250000, emoji: "🍚", colorKey: "red", category: "sembako", sellerName: "IndiGoo Official", sellerPhone: "+62 851-9651-3337", location: "Yogyakarta", rating: 4.9, sold: 152, stock: 40 },
  { name: "Paket Sembako 500.000 mP", price: 500000, emoji: "🍚", colorKey: "red", category: "sembako", sellerName: "IndiGoo Official", sellerPhone: "+62 851-9651-3337", location: "Yogyakarta", rating: 4.9, sold: 96, stock: 30 },
  { name: "Paket Sembako 750.000 mP", price: 750000, emoji: "🍚", colorKey: "red", category: "sembako", sellerName: "IndiGoo Official", sellerPhone: "+62 851-9651-3337", location: "Yogyakarta", rating: 4.9, sold: 61, stock: 20 },
  { name: "Paket Sembako 1.000.000 mP", price: 1000000, emoji: "🍚", colorKey: "red", category: "sembako", sellerName: "IndiGoo Official", sellerPhone: "+62 851-9651-3337", location: "Yogyakarta", rating: 4.9, sold: 38, stock: 15 },
];

const CALLS = [
  { contactName: "Siti Rahayu", colorKey: "purple", kind: "VOICE", direction: "IN", durationSec: 132 },
  { contactName: "Budi Santoso", colorKey: "emerald", kind: "VIDEO", direction: "OUT", durationSec: 305 },
  { contactName: "Dewi Lestari", colorKey: "pink", kind: "VOICE", direction: "MISSED", durationSec: 0 },
  { contactName: "Reseller IndiGoo", colorKey: "teal", kind: "VOICE", direction: "OUT", durationSec: 58 },
  { contactName: "Maya Putri", colorKey: "rose", kind: "VIDEO", direction: "MISSED", durationSec: 0 },
  { contactName: "Agus Salim", colorKey: "orange", kind: "VOICE", direction: "IN", durationSec: 421 },
];

async function main() {
  // ---------- Video ----------
  const videoCount = await db.videoPost.count();
  const demoCount = await db.videoPost.count({ where: { authorType: "demo" } });
  if (force && demoCount > 0) {
    await db.videoPost.deleteMany({ where: { authorType: "demo" } });
    console.log(`🧹 ${demoCount} video demo dihapus`);
  }
  const videoLeft = await db.videoPost.count();
  if (videoLeft === 0) {
    await db.videoPost.createMany({
      data: VIDEOS.map((v) => ({ ...v, authorType: "demo" })),
    });
    console.log(`✅ ${VIDEOS.length} video Beranda dibuat`);
  } else {
    console.log(`⏭️ Video sudah ada (${videoLeft}) — dilewati`);
  }

  // ---------- Marketplace ----------
  const marketCount = await db.marketItem.count();
  if (force || marketCount === 0) {
    if (force) await db.marketItem.deleteMany();
    await db.marketItem.createMany({ data: MARKET });
    console.log(`✅ ${MARKET.length} produk Marketplace dibuat`);
  } else {
    console.log(`⏭️ Marketplace sudah ada (${marketCount}) — dilewati`);
  }

  // ---------- Riwayat Panggilan ----------
  const callCount = await db.callLog.count();
  if (callCount === 0) {
    const now = Date.now();
    await db.callLog.createMany({
      data: CALLS.map((c, i) => ({ ...c, createdAt: new Date(now - (i + 1) * 3600_000 * 5) })),
    });
    console.log(`✅ ${CALLS.length} riwayat panggilan dibuat`);
  } else {
    console.log(`⏭️ Riwayat panggilan sudah ada (${callCount}) — dilewati`);
  }
}

main()
  .catch((e) => {
    console.error("Seed beranda gagal:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
