"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useRef } from "react";
import { BadgeCheck, Camera, LogOut, RefreshCw, Save, ShieldCheck, Sparkles, Trash2, Upload, UserRound } from "lucide-react";
import { Spinner, StatusBadge, Toast } from "@/components/ui";
import { ACCESS_STATUS_LABEL, RELIGIONS, RELIGION_LABELS } from "@/lib/constants";
import { formatDateKeyShort, formatDateTimeWib } from "@/lib/time";
import { initials } from "@/lib/utils";

export function ProfileForm({
  user,
}: {
  user: {
    name: string;
    email: string;
    religion: string;
    phone: string | null;
    city: string | null;
    role: string;
    avatarUrl: string | null;
    accessCode: string | null;
    accessStatus: string;
    timerStartedAt: string | null;
    createdAt: string;
  };
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone ?? "");
  const [city, setCity] = useState(user.city ?? "");
  const [religion, setReligion] = useState(user.religion);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user.avatarUrl);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);

  const handlePhotoSelect = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setToast({ message: "File harus berupa gambar (JPG, PNG, WebP).", tone: "error" });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setToast({ message: "Ukuran foto maksimal 2 MB.", tone: "error" });
      return;
    }
    setUploadingPhoto(true);
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        // Resize to maximum 320x320 for optimal performance and crisp avatar
        const canvas = document.createElement("canvas");
        const maxDim = 320;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.88);
          setAvatarUrl(dataUrl);
          setToast({ message: "Foto profil dipilih. Klik 'Simpan perubahan' untuk menyimpan.", tone: "success" });
        } else {
          setAvatarUrl(String(reader.result));
        }
        setUploadingPhoto(false);
      };
      img.onerror = () => {
        setAvatarUrl(String(reader.result));
        setUploadingPhoto(false);
      };
      img.src = String(reader.result);
    };
    reader.onerror = () => {
      setUploadingPhoto(false);
      setToast({ message: "Gagal membaca file gambar.", tone: "error" });
    };
    reader.readAsDataURL(file);
  };

  const removePhoto = () => {
    setAvatarUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setToast({ message: "Foto profil dihapus. Klik 'Simpan perubahan' untuk mengonfirmasi.", tone: "success" });
  };

  const save = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, city, religion, avatarUrl }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Gagal menyimpan profil");
      setToast({ message: "Profil berhasil diperbarui", tone: "success" });
      router.refresh();
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : "Gagal menyimpan", tone: "error" });
    } finally {
      setSaving(false);
    }
  };

  const logout = async () => {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-master-500">Akun</p>
        <h1 className="mt-1 text-[26px] font-extrabold tracking-tight text-master-950">Profil Saya</h1>
        <p className="mt-1 text-sm text-slate-500">Kelola data diri dan preferensi ibadah untuk rutinitas harian.</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section className="card p-5">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => handlePhotoSelect(event.target.files?.[0])}
          />
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt={name || user.name}
                  className="h-20 w-20 rounded-3xl border-2 border-master-200 object-cover shadow-md"
                />
              ) : (
                <span className="grid h-20 w-20 place-items-center rounded-3xl bg-gradient-to-br from-master-500 to-master-800 text-2xl font-bold text-white shadow-md">
                  {initials(name || user.name)}
                </span>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto}
                className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-xl border border-white bg-master-600 text-white shadow-md transition hover:bg-master-700"
                title="Ubah foto profil"
              >
                {uploadingPhoto ? <Spinner className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
              </button>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-base font-bold text-master-950">{name || user.name}</p>
                <StatusBadge status={user.accessStatus} label={ACCESS_STATUS_LABEL[user.accessStatus]} />
                <span className="rounded-full bg-master-50 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-master-700">
                  {user.role === "super_admin"
                    ? "Super Admin"
                    : user.role === "admin"
                      ? "Admin"
                      : "Pengguna"}
                </span>
              </div>
              <p className="text-[11.5px] text-slate-500">{user.email}</p>

              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-master-800 shadow-sm transition hover:bg-rose-50"
                >
                  <Upload className="h-3.5 w-3.5 text-master-600" />
                  {avatarUrl ? "Ganti Foto Profil" : "Unggah Foto Profil"}
                </button>
                {avatarUrl ? (
                  <button
                    type="button"
                    onClick={removePhoto}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-rose-100 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Hapus
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label" htmlFor="profile-name">
                Nama lengkap
              </label>
              <input id="profile-name" className="input" value={name} onChange={(event) => setName(event.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="profile-email">
                Email
              </label>
              <input id="profile-email" className="input" value={user.email} disabled />
            </div>
            <div>
              <label className="label" htmlFor="profile-phone">
                Nomor WhatsApp
              </label>
              <input
                id="profile-phone"
                className="input"
                placeholder="0812-xxxx-xxxx"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="profile-city">
                Kota / Kabupaten
              </label>
              <input
                id="profile-city"
                className="input"
                placeholder="Contoh: Tasikmalaya"
                value={city}
                onChange={(event) => setCity(event.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="profile-religion">
                Agama / kepercayaan
              </label>
              <select
                id="profile-religion"
                className="input"
                value={religion}
                onChange={(event) => setReligion(event.target.value)}
              >
                {RELIGIONS.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="btn-primary text-[12.5px]" onClick={save} disabled={saving}>
              {saving ? <Spinner /> : <Save className="h-4 w-4" />} Simpan perubahan
            </button>
            <button type="button" className="btn text-[12.5px] text-rose-600 hover:bg-rose-50" onClick={logout} disabled={loggingOut}>
              <LogOut className="h-4 w-4" /> Keluar dari akun
            </button>
          </div>
        </section>

        <div className="space-y-5">
          <section className="card p-5">
            <h2 className="flex items-center gap-2 text-base font-bold text-master-950">
              <UserRound className="h-4 w-4 text-master-600" /> Detail Keanggotaan
            </h2>
            <dl className="mt-3 space-y-2 text-[12px]">
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Nomor Akses</dt>
                <dd className="font-mono font-bold text-master-900">{user.accessCode ?? "Belum Diterbitkan"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Bergabung</dt>
                <dd className="font-semibold text-slate-800">{formatDateKeyShort(user.createdAt.slice(0, 10))}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Agama</dt>
                <dd className="font-semibold text-slate-800">{RELIGION_LABELS[user.religion] ?? "-"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Status akses</dt>
                <dd className="font-semibold text-slate-800">{ACCESS_STATUS_LABEL[user.accessStatus]}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Timer dimulai</dt>
                <dd className="font-semibold text-slate-800">
                  {user.timerStartedAt ? formatDateTimeWib(user.timerStartedAt) : "Belum aktif"}
                </dd>
              </div>
            </dl>
          </section>

          <section className="rounded-3xl bg-gradient-to-br from-master-600 to-master-900 p-5 text-white">
            <p className="flex items-center gap-2 text-[12px] font-bold">
              <Sparkles className="h-4 w-4" /> Rutinitas sesuai keyakinan
            </p>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-rose-50/85">
              Mengubah agama/kepercayaan akan menyesuaikan rekomendasi aktivitas ibadah pada modul Rutinitas, mulai
              dari bangun 03.30 WIB hingga 22.00 WIB.
            </p>
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-[10.5px] text-rose-50/90">
              <BadgeCheck className="h-3.5 w-3.5" /> Data hanya dipakai untuk personalisasi aplikasi.
            </div>
          </section>

          <section className="card p-4">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-master-600" />
              <div>
                <p className="text-xs font-bold text-slate-800">Sinkronisasi Aplikasi Mobile</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
                  Data dan tampilan aplikasi diperbarui otomatis langsung dari server database. Jika Anda ingin memuat ulang secara manual tanpa instal ulang, gunakan tombol di bawah:
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={async () => {
                if ("caches" in window) {
                  const keys = await caches.keys();
                  await Promise.all(keys.map((k) => caches.delete(k)));
                }
                if ("serviceWorker" in navigator) {
                  const regs = await navigator.serviceWorker.getRegistrations();
                  for (const r of regs) await r.update();
                }
                window.location.reload();
              }}
              className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50/60 px-3 py-2 text-xs font-semibold text-master-800 transition hover:bg-rose-100"
            >
              <RefreshCw className="h-3.5 w-3.5 text-master-600" /> Segarkan & Bersihkan Cache
            </button>
          </section>
        </div>
      </div>

      <Toast message={toast?.message ?? null} tone={toast?.tone} onClose={() => setToast(null)} />
    </div>
  );
}
