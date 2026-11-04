import { randomInt } from "node:crypto";

/**
 * Menghasilkan Nomor Akses Pengguna Otomatis.
 * Perpaduan Huruf Besar dan Angka yang berurutan tapi acak/random.
 * Contoh format: MST-7A8B9C, NAP-2K3L4M, dsb.
 *
 * Pola:
 * - 3 huruf prefix acak yang berurutan dalam alfabet (misal JKL, PQR, DEF, ABC)
 * - Pemisah (-)
 * - 6 karakter selang-seling Angka & Huruf berurutan dengan lompatan terkendali
 *   (misal: 7 + D + 8 + E + 9 + F) sehingga terlihat berurutan ritmis namun tetap unik dan acak.
 */
export function generateUserAccessNumber(): string {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // tanpa I/O agar tidak tertukar angka 1/0
  const digits = "23456789"; // tanpa 0/1 agar tidak ambigu

  // Pilih starting letter untuk prefix 3 huruf berurutan
  const startLetterIndex = randomInt(0, letters.length - 3);
  const prefix = letters.slice(startLetterIndex, startLetterIndex + 3);

  // Pilih digit awal (misal 3, 4, 5, 6)
  const startDigit = randomInt(2, 7);
  const d1 = startDigit;
  const d2 = (startDigit + 1) % 10;
  const d3 = (startDigit + 2) % 10;

  // Pilih huruf berikutnya berurutan
  const lIndex = randomInt(0, letters.length - 3);
  const l1 = letters[lIndex];
  const l2 = letters[lIndex + 1];
  const l3 = letters[lIndex + 2];

  // Hasil gabungan berurutan: Prefix + (Angka1+Huruf1 + Angka2+Huruf2 + Angka3+Huruf3)
  // Contoh: ABC-4K5L6M atau PQR-7D8E9F
  return `${prefix}-${d1}${l1}${d2}${l2}${d3}${l3}`;
}
