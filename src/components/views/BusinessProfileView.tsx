"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Store,
  Camera,
  Image as ImageIcon,
  Trash2,
  Loader2,
  Save,
  MapPin,
  Clock,
  Phone,
  Mail,
  Globe,
  Instagram,
  Facebook,
  Music2,
  ExternalLink,
  ShieldCheck,
  StoreIcon,
} from "lucide-react";
import { cn } from "@/lib/wa-utils";
import { useToast } from "@/hooks/use-toast";
import ViewHeader from "@/components/business/ViewHeader";
import WaImg from "@/components/business/WaImg";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { uploadImage } from "@/lib/upload";
import { useIsDesktop } from "@/lib/useIsDesktop";
import { defaultHours, parseHours, type HourRow, type Profile } from "@/components/business/types";

interface FormState {
  businessName: string;
  ownerName: string;
  category: string;
  description: string;
  address: string;
  lat: string;
  lng: string;
  email: string;
  website: string;
  instagram: string;
  facebook: string;
  tiktok: string;
  logoUrl: string;
  coverUrl: string;
}

const EMPTY_FORM: FormState = {
  businessName: "",
  ownerName: "",
  category: "",
  description: "",
  address: "",
  lat: "",
  lng: "",
  email: "",
  website: "",
  instagram: "",
  facebook: "",
  tiktok: "",
  logoUrl: "/images/logo.png",
  coverUrl: "",
};

function todayIndex(): number {
  return (new Date().getDay() + 6) % 7; // Senin = 0
}

export default function BusinessProfileView() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [hoursRows, setHoursRows] = useState<HourRow[]>(defaultHours());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/profile", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memuat profil");
      const p: Profile = data.profile;
      setProfile(p);
      setForm({
        businessName: p.businessName ?? "",
        ownerName: p.ownerName ?? "",
        category: p.category ?? "",
        description: p.description ?? "",
        address: p.address ?? "",
        lat: String(p.lat ?? ""),
        lng: String(p.lng ?? ""),
        email: p.email ?? "",
        website: p.website ?? "",
        instagram: p.instagram ?? "",
        facebook: p.facebook ?? "",
        tiktok: p.tiktok ?? "",
        logoUrl: p.logoUrl || "/images/logo.png",
        coverUrl: p.coverUrl ?? "",
      });
      setHoursRows(parseHours(p.hours));
    } catch (e) {
      toast({
        title: "Gagal memuat profil",
        description: e instanceof Error ? e.message : "Coba muat ulang halaman",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const patch = (p: Partial<FormState>) => setForm((prev) => ({ ...prev, ...p }));

  // ===================== FOTO LANGSUNG TERSIMPAN (Task 49) =====================
  // Sebelumnya foto logo/latar hanya di-patch ke state form — bila "Simpan Profil"
  // tidak ditekan (atau gagal validasi "Nama bisnis wajib diisi"), foto hilang saat
  // halaman dimuat ulang sehingga terkesan "gagal muat". Kini, selaras dengan foto
  // channel/komunitas (Task 45/47), unggahan di-patch ke /api/profile seketika sehingga
  // pasti tersimpan di server tanpa bergantung pada tombol simpan.
  const persistPhotoField = useCallback(async (field: "logoUrl" | "coverUrl", value: string) => {
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ [field]: value }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.profile) throw new Error(data?.error || "Gagal menyimpan profil bisnis");
    setProfile(data.profile);
    // Beri tahu seluruh aplikasi (sidebar, header) bahwa profil berubah
    window.dispatchEvent(new CustomEvent("wa:profile-updated"));
  }, []);

  const handleLogoFile = async (file: File) => {
    const prev = form.logoUrl;
    try {
      // Batch 4: logo diunggah ke server (URL), bukan base64 di DB
      const url = await uploadImage(file, "logo");
      patch({ logoUrl: url });
      await persistPhotoField("logoUrl", url);
      toast({ title: "Logo diperbarui", description: "Foto logo langsung tersimpan." });
    } catch (e) {
      patch({ logoUrl: prev }); // batalkan pratinjau bila gagal agar form tak menipu
      toast({
        title: "Gagal memuat logo",
        description: e instanceof Error ? e.message : "Coba gambar lain",
        variant: "destructive",
      });
    }
  };

  const handleRemoveLogo = async () => {
    const prev = form.logoUrl;
    patch({ logoUrl: "" });
    try {
      await persistPhotoField("logoUrl", "");
      toast({ title: "Logo dihapus", description: "Kembali memakai logo bawaan IndiGoo." });
    } catch (e) {
      patch({ logoUrl: prev });
      toast({
        title: "Gagal menghapus logo",
        description: e instanceof Error ? e.message : "Coba lagi",
        variant: "destructive",
      });
    }
  };

  const handleCoverFile = async (file: File) => {
    const prev = form.coverUrl;
    try {
      // Latar (cover) profil diunggah ke server (URL), bukan base64 di DB
      const url = await uploadImage(file, "cover");
      patch({ coverUrl: url });
      await persistPhotoField("coverUrl", url);
      toast({ title: "Latar belakang diperbarui", description: "Foto latar langsung tersimpan." });
    } catch (e) {
      patch({ coverUrl: prev }); // batalkan pratinjau bila gagal agar form tak menipu
      toast({
        title: "Gagal memuat latar belakang",
        description: e instanceof Error ? e.message : "Coba gambar lain",
        variant: "destructive",
      });
    }
  };

  const handleRemoveCover = async () => {
    const prev = form.coverUrl;
    patch({ coverUrl: "" });
    try {
      await persistPhotoField("coverUrl", "");
      toast({ title: "Latar belakang dihapus", description: "Kartu profil kembali memakai warna bawaan." });
    } catch (e) {
      patch({ coverUrl: prev });
      toast({
        title: "Gagal menghapus latar belakang",
        description: e instanceof Error ? e.message : "Coba lagi",
        variant: "destructive",
      });
    }
  };

  const handleSave = async () => {
    if (!form.businessName.trim()) {
      toast({ title: "Nama bisnis wajib diisi", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: form.businessName.trim(),
          ownerName: form.ownerName.trim(),
          category: form.category.trim(),
          description: form.description,
          address: form.address.trim(),
          lat: parseFloat(form.lat) || 0,
          lng: parseFloat(form.lng) || 0,
          email: form.email.trim(),
          website: form.website.trim(),
          instagram: form.instagram.replace(/^@+/, "").trim(),
          facebook: form.facebook
            .replace(/^https?:\/\/(www\.)?facebook\.com\//i, "")
            .replace(/^\/+/, "")
            .trim(),
          tiktok: form.tiktok.replace(/^@+/, "").trim(),
          hours: JSON.stringify(hoursRows),
          logoUrl: form.logoUrl,
          coverUrl: form.coverUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan profil");
      setProfile(data.profile);
      // Beri tahu seluruh aplikasi (sidebar, header, layar keluar) bahwa profil berubah
      window.dispatchEvent(new CustomEvent("wa:profile-updated"));
      toast({ title: "Profil disimpan", description: "Informasi bisnis berhasil diperbarui." });
    } catch (e) {
      toast({
        title: "Gagal menyimpan",
        description: e instanceof Error ? e.message : "Coba lagi",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const formProps = { form, patch, hoursRows, setHoursRows, phone: profile?.phone ?? "", onSave: handleSave, saving, onLogoFile: handleLogoFile, onCoverFile: handleCoverFile, onRemoveLogo: handleRemoveLogo, onRemoveCover: handleRemoveCover };
  const previewProps = { form, hoursRows, phone: profile?.phone ?? "", verified: profile?.verified ?? false, category: profile?.category ?? "" };
  const isDesktop = useIsDesktop();

  return (
    <div className="h-full flex flex-col">
      {/* Header view hanya desktop — di mobile dihapus (judul sudah tampil di panel header atas,
          sesuai anotasi screenshot "Hapus Bagian Ini"). */}
      {isDesktop && (
        <ViewHeader icon={Store} title="Profil Bisnis" subtitle="Kelola informasi toko yang dilihat pelanggan" />
      )}

      {loading ? (
        <div className="flex-1 overflow-y-auto wa-scrollbar p-4 sm:p-6">
          <div className="max-w-3xl mx-auto space-y-4">
            <div className="flex items-center gap-4">
              <Skeleton className="h-20 w-20 rounded-2xl" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-52" />
              </div>
            </div>
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      ) : !profile ? (
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">Profil tidak tersedia.</div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto wa-scrollbar">
          {isDesktop ? (
            /* Desktop: edit + pratinjau berdampingan */
            <div className="p-4 sm:p-6">
              <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-5">
                <div className="lg:col-span-3">
                  <ProfileForm {...formProps} />
                </div>
                <div className="lg:col-span-2">
                  <ProfilePreview {...previewProps} />
                </div>
              </div>
            </div>
          ) : (
            /* Mobile/tablet: Tabs Pratinjau / Edit (Pratinjau dulu, lalu Edit) */
            <div className="p-4 sm:p-6">
              <Tabs defaultValue="edit">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="preview">Pratinjau</TabsTrigger>
                  <TabsTrigger value="edit">Edit</TabsTrigger>
                </TabsList>
                <TabsContent value="preview">
                  <ProfilePreview {...previewProps} />
                </TabsContent>
                <TabsContent value="edit">
                  <ProfileForm {...formProps} />
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ===================== FORM =====================

interface ProfileFormProps {
  form: FormState;
  patch: (p: Partial<FormState>) => void;
  hoursRows: HourRow[];
  setHoursRows: React.Dispatch<React.SetStateAction<HourRow[]>>;
  phone: string;
  onSave: () => void;
  saving: boolean;
  onLogoFile: (file: File) => void;
  onCoverFile: (file: File) => void;
  onRemoveLogo: () => void | Promise<void>;
  onRemoveCover: () => void | Promise<void>;
}

function ProfileForm({ form, patch, hoursRows, setHoursRows, phone, onSave, saving, onLogoFile, onCoverFile, onRemoveLogo, onRemoveCover }: ProfileFormProps) {
  const setHour = (idx: number, p: Partial<HourRow>) =>
    setHoursRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...p } : r)));

  const latNum = parseFloat(form.lat);
  const lngNum = parseFloat(form.lng);
  const hasCoords = Number.isFinite(latNum) && Number.isFinite(lngNum);

  return (
    <Card>
      <CardContent className="p-4 sm:p-6 space-y-6">
        {/* Logo */}
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <WaImg
              src={form.logoUrl || "/images/logo.png"}
              alt="Logo bisnis"
              className="h-20 w-20 rounded-2xl object-cover ring-1 ring-border bg-muted"
            />
            <label
              className="absolute -bottom-1.5 -right-1.5 h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center cursor-pointer shadow-md hover:bg-primary/90 transition-colors"
              title="Ubah logo"
            >
              <Camera className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">Ubah logo bisnis</span>
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onLogoFile(f);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium">Logo bisnis</p>
            <p className="text-xs text-muted-foreground">Tampil di profil & chat pelanggan. PNG/JPG, maks 30 MB.</p>
            {form.logoUrl && form.logoUrl !== "/images/logo.png" ? (
              <Button
                variant="ghost"
                size="sm"
                className="mt-1 h-7 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40"
                onClick={() => void onRemoveLogo()}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" aria-hidden="true" /> Hapus logo
              </Button>
            ) : null}
          </div>
        </div>

        {/* Latar belakang (cover) — sesuai permintaan: latar kartu profil dapat diganti */}
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            {form.coverUrl ? (
              <WaImg
                src={form.coverUrl}
                alt="Latar belakang profil bisnis"
                className="h-20 w-36 rounded-xl object-cover ring-1 ring-border bg-muted"
              />
            ) : (
              <div
                className="h-20 w-36 rounded-xl bg-gradient-to-br from-maroon-600 to-maroon-700 flex items-center justify-center"
                aria-hidden="true"
              >
                <ImageIcon className="h-6 w-6 text-white/70" />
              </div>
            )}
            <label
              className="absolute -bottom-1.5 -right-1.5 h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center cursor-pointer shadow-md hover:bg-primary/90 transition-colors"
              title="Ubah latar belakang"
            >
              <Camera className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">Ubah latar belakang profil bisnis</span>
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onCoverFile(f);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium">Latar belakang</p>
            <p className="text-xs text-muted-foreground">Tampil di kepala kartu profil. PNG/JPG, maks 30 MB.</p>
            {form.coverUrl ? (
              <Button
                variant="ghost"
                size="sm"
                className="mt-1 h-7 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40"
                onClick={() => void onRemoveCover()}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" aria-hidden="true" /> Hapus latar
              </Button>
            ) : null}
          </div>
        </div>

        {/* Identitas */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="bp-name">Nama bisnis</Label>
            <Input id="bp-name" value={form.businessName} onChange={(e) => patch({ businessName: e.target.value })} placeholder="IndiGoo" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bp-owner">Nama pemilik</Label>
            <Input id="bp-owner" value={form.ownerName} onChange={(e) => patch({ ownerName: e.target.value })} placeholder="Pak Jaya Santoso" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bp-category">Kategori</Label>
            <Input id="bp-category" value={form.category} onChange={(e) => patch({ category: e.target.value })} placeholder="Toko Souvenir & Pangan Olahan" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="bp-desc">Deskripsi</Label>
            <Textarea
              id="bp-desc"
              rows={3}
              value={form.description}
              onChange={(e) => patch({ description: e.target.value })}
              placeholder="Ceritakan tentang bisnis Anda..."
            />
          </div>
        </div>

        {/* Alamat & koordinat */}
        <div className="space-y-4">
          <p className="text-sm font-semibold text-foreground/90">Alamat</p>
          <div className="space-y-1.5">
            <Label htmlFor="bp-address">Alamat lengkap</Label>
            <Input id="bp-address" value={form.address} onChange={(e) => patch({ address: e.target.value })} placeholder="Jl. Malioboro No. 123, Yogyakarta" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="bp-lat">Latitude</Label>
              <Input id="bp-lat" type="number" step="any" inputMode="decimal" value={form.lat} onChange={(e) => patch({ lat: e.target.value })} placeholder="-7.7956" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bp-lng">Longitude</Label>
              <Input id="bp-lng" type="number" step="any" inputMode="decimal" value={form.lng} onChange={(e) => patch({ lng: e.target.value })} placeholder="110.3695" />
            </div>
          </div>
          {hasCoords ? (
            <a
              href={`https://www.google.com/maps?q=${latNum},${lngNum}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <MapPin className="h-4 w-4" aria-hidden="true" />
              Lihat di Google Maps
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          ) : (
            <p className="text-xs text-muted-foreground">Isi latitude & longitude untuk pratinjau lokasi di Google Maps.</p>
          )}
        </div>

        {/* Kontak */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="bp-email">Email bisnis</Label>
            <Input id="bp-email" type="email" value={form.email} onChange={(e) => patch({ email: e.target.value })} placeholder="halo@indigoo.id" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bp-website">Website</Label>
            <Input id="bp-website" value={form.website} onChange={(e) => patch({ website: e.target.value })} placeholder="https://indigoo.id" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Nomor telepon (WhatsApp)</Label>
            <div className="flex items-center gap-2 rounded-md border border-input bg-muted/50 px-3 h-9 text-sm text-muted-foreground">
              <Phone className="h-4 w-4 shrink-0" aria-hidden="true" />
              {phone || "—"}
              <span className="ml-auto text-[11px]">tidak dapat diubah</span>
            </div>
          </div>
        </div>

        {/* Media sosial */}
        <div className="space-y-4">
          <p className="text-sm font-semibold text-foreground/90">Media Sosial</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="bp-ig">Instagram</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none" aria-hidden="true">@</span>
                <Input id="bp-ig" className="pl-8" value={form.instagram} onChange={(e) => patch({ instagram: e.target.value })} placeholder="indigoo" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bp-fb">Facebook</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none" aria-hidden="true">fb.com/</span>
                <Input id="bp-fb" className="pl-14" value={form.facebook} onChange={(e) => patch({ facebook: e.target.value })} placeholder="IndiGoo" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bp-tt">TikTok</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none" aria-hidden="true">@</span>
                <Input id="bp-tt" className="pl-8" value={form.tiktok} onChange={(e) => patch({ tiktok: e.target.value })} placeholder="indigoo" />
              </div>
            </div>
          </div>
        </div>

        {/* Jam operasional */}
        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold text-foreground/90">Jam Operasional</p>
            <p className="text-xs text-muted-foreground">Atur hari & jam buka toko.</p>
          </div>
          <div className="rounded-xl border border-border divide-y">
            {hoursRows.map((row, idx) => (
              <div key={row.day} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
                <span className="w-16 shrink-0 text-sm font-medium">{row.day}</span>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={!row.closed}
                    onCheckedChange={(v) => setHour(idx, { closed: !v })}
                    aria-label={`Buka atau tutup pada hari ${row.day}`}
                  />
                  <span className={cn("text-xs w-10", row.closed ? "text-red-500" : "text-maroon-600")}>{row.closed ? "Tutup" : "Buka"}</span>
                </div>
                <div className={cn("flex items-center gap-2 ml-auto transition-opacity", row.closed && "opacity-40")}>
                  <Input
                    type="time"
                    value={row.open}
                    disabled={row.closed}
                    onChange={(e) => setHour(idx, { open: e.target.value })}
                    className="w-[106px] h-8 text-sm"
                    aria-label={`Jam buka hari ${row.day}`}
                  />
                  <span className="text-xs text-muted-foreground" aria-hidden="true">–</span>
                  <Input
                    type="time"
                    value={row.close}
                    disabled={row.closed}
                    onChange={(e) => setHour(idx, { close: e.target.value })}
                    className="w-[106px] h-8 text-sm"
                    aria-label={`Jam tutup hari ${row.day}`}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end border-t pt-4">
          <Button onClick={onSave} disabled={saving} className="min-w-36">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            {saving ? "Menyimpan..." : "Simpan Profil"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ===================== PRATINJAU =====================

interface ProfilePreviewProps {
  form: FormState;
  hoursRows: HourRow[];
  phone: string;
  verified: boolean;
  category: string;
}

function ProfilePreview({ form, hoursRows, phone, verified, category }: ProfilePreviewProps) {
  const today = todayIndex();
  const hasSocial = Boolean(form.instagram || form.facebook || form.tiktok);
  const websiteUrl = form.website
    ? form.website.startsWith("http")
      ? form.website
      : `https://${form.website}`
    : "";

  return (
    <Card className="overflow-hidden lg:sticky lg:top-0">
      <div className="relative overflow-hidden bg-primary px-6 pt-8 pb-6 flex flex-col items-center text-center text-primary-foreground">
        {form.coverUrl ? (
          <>
            {/* Latar belakang kustom (Task 42): foto menutupi kepala kartu + gradasi gelap agar teks terbaca */}
            <WaImg
              src={form.coverUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/25 to-black/35" aria-hidden="true" />
          </>
        ) : null}
        <div className="relative z-10 flex flex-col items-center">
        <WaImg
          src={form.logoUrl || "/images/logo.png"}
          alt={`Logo ${form.businessName || "bisnis"}`}
          className="h-20 w-20 rounded-full object-cover ring-2 ring-white/40 bg-white/10"
        />
        <p className="mt-3 text-lg font-semibold leading-tight break-words">{form.businessName || "Nama Bisnis"}</p>
        <p className="mt-0.5 text-xs text-primary-foreground/85">{form.category || category || "Kategori bisnis"}</p>
        {verified ? (
          <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-medium">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> Bisnis Terverifikasi
          </span>
        ) : null}
        </div>
      </div>

      <CardContent className="p-5 space-y-5">
        {form.description ? (
          <section>
            <p className="text-xs font-medium text-muted-foreground mb-1">Deskripsi</p>
            <p className="text-sm whitespace-pre-wrap break-words text-justify">{form.description}</p>
          </section>
        ) : null}

        {form.address || hasCoords(form.lat, form.lng) ? (
          <section>
            <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" aria-hidden="true" /> Alamat
            </p>
            {form.address ? <p className="text-sm text-justify">{form.address}</p> : null}
            {hasCoords(form.lat, form.lng) ? (
              <a
                href={`https://www.google.com/maps?q=${parseFloat(form.lat)},${parseFloat(form.lng)}`}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                {form.lat || 0}, {form.lng || 0} — Lihat di Google Maps
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            ) : null}
          </section>
        ) : null}

        <section>
          <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" /> Jam Operasional
          </p>
          <div className="divide-y rounded-lg border px-3 py-1">
            {hoursRows.map((row, i) => (
              <div key={row.day} className="flex items-center justify-between py-1.5 text-sm">
                <span className={cn(i === today && "font-semibold")}>
                  {row.day}
                  {i === today && <span className="ml-1.5 text-[10px] font-medium text-primary">Hari ini</span>}
                </span>
                <span className={cn("text-xs", row.closed ? "text-red-500 font-medium" : "text-muted-foreground")}>
                  {row.closed ? "Tutup" : `${row.open} – ${row.close}`}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Kontak</p>
          {phone ? (
            <p className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" /> {phone}
            </p>
          ) : null}
          {form.email ? (
            <p className="flex items-center gap-2 text-sm break-all">
              <Mail className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" /> {form.email}
            </p>
          ) : null}
          {form.website ? (
            <a href={websiteUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline break-all">
              <Globe className="h-4 w-4 shrink-0" aria-hidden="true" /> {form.website}
            </a>
          ) : null}
          {!phone && !form.email && !form.website ? <p className="text-sm text-muted-foreground">Belum ada info kontak.</p> : null}
        </section>

        <section>
          <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
            <StoreIcon className="h-3.5 w-3.5" aria-hidden="true" /> Media Sosial
          </p>
          {hasSocial ? (
            <div className="space-y-2">
              {form.instagram ? (
                <p className="flex items-center gap-2 text-sm">
                  <Instagram className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" /> @{form.instagram.replace(/^@+/, "")}
                </p>
              ) : null}
              {form.facebook ? (
                <p className="flex items-center gap-2 text-sm break-all">
                  <Facebook className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" /> fb.com/{form.facebook.replace(/^https?:\/\/(www\.)?facebook\.com\//i, "").replace(/^\/+/, "")}
                </p>
              ) : null}
              {form.tiktok ? (
                <p className="flex items-center gap-2 text-sm">
                  <Music2 className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" /> @{form.tiktok.replace(/^@+/, "")}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Belum diisi.</p>
          )}
        </section>

        <p className="text-[11px] text-muted-foreground text-center pt-1">Beginilah tampilan profil bisnis Anda di mata pelanggan.</p>
      </CardContent>
    </Card>
  );
}

function hasCoords(lat: string, lng: string): boolean {
  return Number.isFinite(parseFloat(lat)) && Number.isFinite(parseFloat(lng));
}
