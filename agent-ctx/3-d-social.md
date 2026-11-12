# Task ID: 3-d — agent-ctx record

Agent: 3-d (Channels / Community / Promotions / Verification)
Status: SELESAI

## Ringkasan
Membangun seluruh API dan view untuk Channel, Komunitas, Promosi, dan Verifikasi Bisnis aplikasi WA Bisnis Panel (Toko Berkah Jaya), sesuai kontrak di worklog.md.

## File yang dibuat/diedit (batas keras dipatuhi)
API (11 route):
- src/app/api/channels/route.ts (GET list + POST create, auto-slug + suffix angka)
- src/app/api/channels/[id]/route.ts (POST toggle ikuti, GET detail)
- src/app/api/channels/[id]/follow/route.ts (POST toggle ikuti — path kontrak worklog)
- src/app/api/channels/[id]/posts/route.ts (POST unggahan)
- src/app/api/posts/[id]/route.ts (POST ?action=like, DELETE)
- src/app/api/posts/[id]/like/route.ts (POST like toggle)
- src/app/api/communities/route.ts (GET)
- src/app/api/communities/[id]/route.ts (PATCH announcement)
- src/app/api/verification/route.ts (GET, PATCH brandProtected)
- src/app/api/verification/apply/route.ts (POST → PENDING)
- src/app/api/verification/check/route.ts (POST → VERIFIED)

Sub-komponen src/components/social/ (6):
- ChannelPostCard.tsx, ChannelComposer.tsx, CreateChannelDialog.tsx, AdCampaignCard.tsx, SocialConnectCard.tsx, ChatButtonCard.tsx, QrPromoCard.tsx, PromoTemplatesCard.tsx

View (4): ChannelsView.tsx, CommunityView.tsx, PromotionsView.tsx, VerificationView.tsx

Aset: public/images/{logo,product-kopi,product-keripik,product-batik,product-tas,product-madu,product-songket,story-promo}.png (folder kosong sebelumnya → digenerate via z-ai image CLI agar tidak 404).

## Keputusan teknis penting (untuk agent berikutnya)
- localStorage keys 3-d: bj_promo_ads, bj_social_fb, bj_social_ig.
- Semua GET route pakai `export const dynamic = "force-dynamic"`; params Promise (Next 16) sudah di-await.
- Like/follow pakai optimistic update di klien; gagal → revert + toast destruktif.
- State demo dikembalikan ke kondisi seed setelah QA (verification NONE/false/false; channel uji dihapus; localStorage dibersihkan).
- Post baru diberi views awal acak kecil (8–47) untuk realisme demo.
- Dialog Buat Iklan scrollable (max-h-[85vh]) karena kontennya tinggi.

## QA dilakukan
bunx tsc --noEmit → bersih utk file 3-d; ESLint bersih; alur end-to-end diuji via agent-browser (ikuti/unfollow, like, buat/hapus unggahan, buat channel, edit & kirim pengumuman, buat iklan, QR, verifikasi penuh). Bug crash Dialog (AdCampaignCard tanpa wrapper <Dialog>) ditemukan lewat QA browser dan diperbaiki.
