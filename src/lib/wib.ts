// ===================== ZONA WAKTU WIB (Asia/Jakarta, UTC+7) =====================
// Seluruh kunci tanggal harian aplikasi (DailyStat, dsb.) wajib memakai
// kalender WIB — bukan UTC — agar pengguna Indonesia melihat "hari ini"
// yang benar antara pukul 00.00–07.00 WIB (saat UTC masih hari sebelumnya).

const WIB_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** "YYYY-MM-DD" menurut kalender WIB. */
export function wibDateKey(d: Date = new Date()): string {
  return WIB_DATE.format(d);
}
