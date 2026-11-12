// Engine review verifikasi bisnis yang NYATA.
// Mengevaluasi Profil dari DB terhadap 9 kriteria, satu per satu.
// Setiap kriteria menghasilkan { key, label, pass, detail } untuk ditampilkan
// apa adanya ke pengguna (tanpa auto-approve, tanpa setTimeout palsu).

export type Criterion = {
  key: string;
  label: string;
  pass: boolean;
  detail: string;
};

/** Profil minimum yang dibutuhkan engine (subset model Profile). */
export type VerifiableProfile = {
  businessName: string;
  category: string;
  description: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  instagram: string;
  facebook: string;
  tiktok: string;
  hours: string;
  logoUrl: string;
};

const PHONE_REGEX = /^\+62[\d\s\-]{8,}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type HourRow = { day?: unknown; open?: unknown; close?: unknown; closed?: unknown };

/** Kriteria 7 — hours: JSON valid & ≥1 hari terbuka. */
export function evaluateHours(hoursJson: string): Criterion {
  const label = "Jam Operasional";
  if (!hoursJson || !hoursJson.trim()) {
    return { key: "hours", label, pass: false, detail: "Jam operasional belum diatur" };
  }
  let rows: HourRow[];
  try {
    const parsed: unknown = JSON.parse(hoursJson);
    if (!Array.isArray(parsed)) throw new Error("bukan array");
    rows = parsed as HourRow[];
  } catch {
    return { key: "hours", label, pass: false, detail: "Format jam operasional tidak valid" };
  }
  const openDays = rows.filter((r) => r && r.closed !== true);
  if (openDays.length < 1) {
    return { key: "hours", label, pass: false, detail: "Tidak ada hari yang terbuka" };
  }
  return {
    key: "hours",
    label,
    pass: true,
    detail: `${openDays.length} dari ${rows.length} hari dibuka`,
  };
}

/** Kriteria 9 — minimal 1 kanal sosial (website/instagram/facebook/tiktok) terisi. */
export function evaluateSocial(p: VerifiableProfile): Criterion {
  const channels: Array<[string, string]> = [
    ["website", p.website],
    ["instagram", p.instagram],
    ["facebook", p.facebook],
    ["tiktok", p.tiktok],
  ];
  const filled = channels.filter(([, v]) => Boolean(v && v.trim()));
  return {
    key: "social",
    label: "Kanal Sosial / Website",
    pass: filled.length >= 1,
    detail:
      filled.length >= 1
        ? `Terisi: ${filled.map(([k]) => k).join(", ")}`
        : "Minimal 1 dari: website, Instagram, Facebook, TikTok",
  };
}

/** Evaluasi seluruh 9 kriteria secara deterministik dari data profil. */
export function evaluateProfileCriteria(p: VerifiableProfile): Criterion[] {
  const criteria: Criterion[] = [];

  // 1) Nama bisnis ≥ 3 karakter
  const nameLen = (p.businessName ?? "").trim().length;
  criteria.push({
    key: "businessName",
    label: "Nama Bisnis",
    pass: nameLen >= 3,
    detail:
      nameLen >= 3
        ? `Terisi: "${(p.businessName ?? "").trim()}"`
        : "Nama bisnis wajib diisi (minimal 3 karakter)",
  });

  // 2) Kategori terisi
  const cat = (p.category ?? "").trim();
  criteria.push({
    key: "category",
    label: "Kategori Bisnis",
    pass: cat.length > 0,
    detail: cat.length > 0 ? `Terisi: "${cat}"` : "Kategori bisnis belum ditentukan",
  });

  // 3) Deskripsi ≥ 30 karakter
  const descLen = (p.description ?? "").trim().length;
  criteria.push({
    key: "description",
    label: "Deskripsi Bisnis",
    pass: descLen >= 30,
    detail:
      descLen >= 30
        ? `${descLen} karakter`
        : `Minimal 30 karakter (saat ini ${descLen} karakter)`,
  });

  // 4) Alamat ≥ 10 karakter
  const addrLen = (p.address ?? "").trim().length;
  criteria.push({
    key: "address",
    label: "Alamat",
    pass: addrLen >= 10,
    detail:
      addrLen >= 10
        ? `${addrLen} karakter`
        : `Minimal 10 karakter (saat ini ${addrLen} karakter)`,
  });

  // 5) Telepon format Indonesia (+62…)
  const phone = (p.phone ?? "").trim();
  const phoneOk = PHONE_REGEX.test(phone);
  criteria.push({
    key: "phone",
    label: "Nomor Telepon",
    pass: phoneOk,
    detail: phoneOk
      ? `Format Indonesia valid: ${phone}`
      : "Wajib format Indonesia, diawali +62 diikuti 8–13 digit",
  });

  // 6) Email wajib terisi & format valid
  const email = (p.email ?? "").trim();
  const emailOk = email.length > 0 && EMAIL_REGEX.test(email);
  criteria.push({
    key: "email",
    label: "Email",
    pass: emailOk,
    detail: emailOk
      ? `Format valid: ${email}`
      : email.length === 0
        ? "Email wajib diisi"
        : "Format email tidak valid (contoh: nama@domain.id)",
  });

  // 7) Jam operasional
  criteria.push(evaluateHours(p.hours ?? ""));

  // 8) Logo terisi
  const logo = (p.logoUrl ?? "").trim();
  criteria.push({
    key: "logoUrl",
    label: "Logo Bisnis",
    pass: logo.length > 0,
    detail: logo.length > 0 ? `Logo tersedia: ${logo}` : "Logo bisnis belum diunggah",
  });

  // 9) Kanal sosial
  criteria.push(evaluateSocial(p));

  return criteria;
}

/** Label kriteria yang gagal — dipakai untuk note log & pesan toast. */
export function failedLabels(criteria: Criterion[]): string[] {
  return criteria.filter((c) => !c.pass).map((c) => c.label);
}
