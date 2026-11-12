-- =====================================================================
-- MIGRASI SUPABASE: Hapus fitur Misi -> Fitur Appointment (+ pelengkap)
-- IndiGoo — 10 Nov 2026
--
-- Isi:
--   1. DROP kolom "User"."claimedMissions" (sisa fitur Misi yang dihapus)
--   2. CREATE TABLE "VideoWatch"     (Task 77 — belum sempat disinkronkan)
--   3. CREATE TABLE "VideoComment"   (Task 77 — belum sempat disinkronkan)
--   4. CREATE TABLE "Appointment"    (fitur baru pengganti Misi:
--      10.000 mP per appointment, batas 5 pembuatan per hari WIB)
--
-- IDEMPOTEN: aman dijalankan berulang. Jalankan sekali di
-- Supabase Dashboard -> SQL Editor, lalu simpan/abaikan file ini.
-- =====================================================================

-- 1) Sisa kolom fitur Misi
ALTER TABLE "User" DROP COLUMN IF EXISTS "claimedMissions";

-- 2) VideoWatch (Task 77)
CREATE TABLE IF NOT EXISTS "VideoWatch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "mp" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VideoWatch_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "VideoWatch_userId_day_idx" ON "VideoWatch"("userId", "day");
CREATE UNIQUE INDEX IF NOT EXISTS "VideoWatch_userId_videoId_day_key" ON "VideoWatch"("userId", "videoId", "day");

-- 3) VideoComment (Task 77)
CREATE TABLE IF NOT EXISTS "VideoComment" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "userId" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VideoComment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "VideoComment_videoId_createdAt_idx" ON "VideoComment"("videoId", "createdAt");
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'VideoComment_videoId_fkey') THEN
        ALTER TABLE "VideoComment" ADD CONSTRAINT "VideoComment_videoId_fkey"
            FOREIGN KEY ("videoId") REFERENCES "VideoPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- 4) Appointment (pengganti Misi)
CREATE TABLE IF NOT EXISTS "Appointment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "location" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'TERJADWAL',
    "mpAwarded" INTEGER NOT NULL DEFAULT 0,
    "day" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Appointment_userId_day_idx" ON "Appointment"("userId", "day");
CREATE INDEX IF NOT EXISTS "Appointment_userId_scheduledAt_idx" ON "Appointment"("userId", "scheduledAt");
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Appointment_userId_fkey') THEN
        ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
