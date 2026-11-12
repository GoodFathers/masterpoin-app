// Daftar bahasa untuk fitur Terjemahan (lokal Indonesia + asing).
// Dipakai bersama oleh dialog terjemahan di chat & tab Tampilan di Pengaturan.

export interface TranslateLang {
  code: string; // dipakai sebagai `target` di POST /api/translate
  name: string; // label UI (Bahasa Indonesia)
}

/** Bahasa daerah Indonesia + Melayu yang dekat. */
export const LOCAL_LANGS: TranslateLang[] = [
  { code: "su", name: "Bahasa Sunda" },
  { code: "jv", name: "Bahasa Jawa" },
  { code: "id", name: "Bahasa Indonesia" },
  { code: "mad", name: "Bahasa Madura" },
  { code: "min", name: "Bahasa Minangkabau" },
  { code: "btk", name: "Bahasa Batak" },
  { code: "ban", name: "Bahasa Bali" },
  { code: "bug", name: "Bahasa Bugis" },
  { code: "ace", name: "Bahasa Aceh" },
  { code: "ms", name: "Bahasa Melayu" },
];

/** Bahasa asing populer untuk pelanggan luar negeri. */
export const FOREIGN_LANGS: TranslateLang[] = [
  { code: "en", name: "Bahasa Inggris" },
  { code: "ar", name: "Bahasa Arab" },
  { code: "zh", name: "Bahasa Mandarin" },
  { code: "ja", name: "Bahasa Jepang" },
  { code: "ko", name: "Bahasa Korea" },
  { code: "hi", name: "Bahasa Hindi" },
  { code: "es", name: "Bahasa Spanyol" },
  { code: "fr", name: "Bahasa Prancis" },
  { code: "de", name: "Bahasa Jerman" },
  { code: "th", name: "Bahasa Thailand" },
  { code: "vi", name: "Bahasa Vietnam" },
];

const ALL: TranslateLang[] = [...LOCAL_LANGS, ...FOREIGN_LANGS];

/** Nama bahasa dari kode; undefined jika kode tidak dikenal (dipakai API utk validasi). */
export function langNameOf(code: string): string | undefined {
  return ALL.find((l) => l.code === code)?.name;
}

/** Bahasa tujuan awal sebelum user memilih (disimpan di display-prefs). */
export const DEFAULT_TRANSLATE_TARGET = "su";
