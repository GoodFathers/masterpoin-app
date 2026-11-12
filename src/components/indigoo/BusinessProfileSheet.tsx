"use client";

// ===================== KARTU PROFIL BISNIS PENGGUNA LAIN (Task 34) =====================
// Dipakai mis. saat mengetuk "Lihat penjual {nama}" di Beranda: menampilkan kartu
// bisnis milik akun lain via GET /api/users/[id]/business (id atau username).
// Sebelumnya tombol ini hanya melompat ke Marketplace (perilaku demo) karena
// profil bisnis aplikasi masih singleton — kini tiap akun punya profil sendiri
// sehingga kartu bisnis pengguna lain bisa ditampilkan.

import { useCallback, useEffect, useState } from "react";
import {
  BadgeCheck,
  Clock,
  Facebook,
  Globe,
  Instagram,
  Loader2,
  Mail,
  MapPin,
  Music2,
  Phone,
  Store,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { parseHours } from "@/components/business/types";

interface OtherBusiness {
  businessName: string;
  ownerName: string;
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
  coverUrl: string;
  verified: boolean;
  verificationStatus: string;
  storeOpen: boolean;
}

interface Payload {
  user: { id: string; username: string; name: string; role: string };
  business: OtherBusiness;
}

function initialsOfName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "IG";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Nomor telepon → tautan wa.me (format 08… diubah ke 62…, seperti QrPromoCard). */
function waLink(phone: string): string | null {
  const digits = phone.replace(/[^0-9]/g, "");
  if (!digits) return null;
  const intl = digits.startsWith("0") ? `62${digits.slice(1)}` : digits;
  return `https://wa.me/${intl}`;
}

export default function BusinessProfileSheet({
  userId,
  open,
  onOpenChange,
  onBrowseCatalog,
}: {
  /** User.id ATAU username pemilik bisnis yang ingin dilihat. */
  userId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Aksi sekunder (mis. buka Marketplace) — dipertahankan dari perilaku lama. */
  onBrowseCatalog?: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Payload | null>(null);

  const load = useCallback(async (target: string) => {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(target)}/business`, { cache: "no-store" });
      const json = (await res.json()) as Payload & { error?: string };
      if (!res.ok || !json.business) {
        setError(json.error ?? "Gagal memuat profil bisnis");
        return;
      }
      setData(json);
    } catch {
      setError("Tidak dapat menghubungi server");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && userId) void load(userId);
    if (!open) {
      setData(null);
      setError(null);
    }
  }, [open, userId, load]);

  const b = data?.business;
  const displayName = b?.businessName?.trim() || data?.user.name || data?.user.username || "Bisnis";
  const hours = b ? parseHours(b.hours) : [];
  const openDays = hours.filter((h) => !h.closed);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden" aria-describedby="biz-sheet-desc">
        <span id="biz-sheet-desc" className="sr-only">
          Kartu profil bisnis milik pengguna lain
        </span>
        {loading && (
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-16 w-16 rounded-2xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <div className="flex justify-center pt-1">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />
            </div>
          </div>
        )}

        {!loading && error && (
          <div className="p-6 text-center space-y-3">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
              <Store className="h-7 w-7 text-muted-foreground" aria-hidden="true" />
            </span>
            <DialogHeader className="space-y-1.5">
              <DialogTitle className="text-base">Profil bisnis tidak tersedia</DialogTitle>
              <DialogDescription>{error}</DialogDescription>
            </DialogHeader>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Tutup
            </Button>
          </div>
        )}

        {!loading && !error && b && (
          <div>
            {/* Kepala kartu — latar kustom bila ada (Task 42), bila tidak gradasi bawaan */}
            <div className="relative overflow-hidden bg-gradient-to-br from-maroon-600 to-maroon-700 p-5 text-white">
              {b.coverUrl ? (
                <>
                  <img
                    src={b.coverUrl}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/25 to-black/35" aria-hidden="true" />
                </>
              ) : null}
              <div className="relative z-10 flex items-start gap-3.5">
                {b.logoUrl ? (
                  <img
                    src={b.logoUrl}
                    alt={`Logo ${displayName}`}
                    className="h-16 w-16 rounded-2xl object-cover ring-2 ring-white/40 bg-white/20 shrink-0"
                  />
                ) : (
                  <span className="h-16 w-16 rounded-2xl bg-white/20 ring-2 ring-white/40 flex items-center justify-center text-lg font-bold shrink-0">
                    {initialsOfName(displayName)}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h2 className="font-bold text-base leading-tight truncate">{displayName}</h2>
                    {b.verified && (
                      <span title="Bisnis terverifikasi">
                        <BadgeCheck className="h-5 w-5 text-amber-300 shrink-0" aria-label="Terverifikasi" />
                      </span>
                    )}
                  </div>
                  <p className="text-white/85 text-xs mt-0.5">
                    {[b.ownerName?.trim() || data?.user.name || data?.user.username, b.category?.trim()].filter(Boolean).join(" • ")}
                  </p>
                  <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                    <Badge className={b.storeOpen ? "bg-white/20 text-white hover:bg-white/20 border border-white/30" : "bg-black/25 text-white/80 hover:bg-black/25 border border-white/20"}>
                      <Store className="h-3 w-3 mr-0.5" aria-hidden="true" />
                      {b.storeOpen ? "Toko Buka" : "Toko Tutup"}
                    </Badge>
                    {b.verificationStatus === "PENDING" && (
                      <Badge className="bg-amber-400/90 text-amber-950 hover:bg-amber-400/90">Verifikasi Ditinjau</Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Isi kartu */}
            <div className="p-5 space-y-4 max-h-[52vh] overflow-y-auto wa-scrollbar">
              {b.description?.trim() && (
                <p className="text-sm text-muted-foreground leading-relaxed">{b.description.trim()}</p>
              )}

              <ul className="space-y-2.5 text-sm">
                {b.address?.trim() && (
                  <li className="flex items-start gap-2.5">
                    <MapPin className="h-4 w-4 text-maroon-600 mt-0.5 shrink-0" aria-hidden="true" />
                    <span className="min-w-0">{b.address.trim()}</span>
                  </li>
                )}
                {b.phone?.trim() && waLink(b.phone.trim()) && (
                  <li className="flex items-center gap-2.5">
                    <Phone className="h-4 w-4 text-maroon-600 shrink-0" aria-hidden="true" />
                    <a href={waLink(b.phone.trim()) as string} target="_blank" rel="noreferrer" className="hover:underline min-w-0 truncate">
                      {b.phone.trim()}
                    </a>
                  </li>
                )}
                {b.email?.trim() && (
                  <li className="flex items-center gap-2.5 min-w-0">
                    <Mail className="h-4 w-4 text-maroon-600 shrink-0" aria-hidden="true" />
                    <a href={`mailto:${b.email.trim()}`} className="hover:underline min-w-0 truncate">
                      {b.email.trim()}
                    </a>
                  </li>
                )}
                {b.website?.trim() && (
                  <li className="flex items-center gap-2.5 min-w-0">
                    <Globe className="h-4 w-4 text-maroon-600 shrink-0" aria-hidden="true" />
                    <a href={b.website.startsWith("http") ? b.website.trim() : `https://${b.website.trim()}`} target="_blank" rel="noreferrer" className="hover:underline min-w-0 truncate">
                      {b.website.trim()}
                    </a>
                  </li>
                )}
                {b.instagram?.trim() && (
                  <li className="flex items-center gap-2.5 min-w-0">
                    <Instagram className="h-4 w-4 text-maroon-600 shrink-0" aria-hidden="true" />
                    <span className="truncate">@{b.instagram.replace(/^@+/, "").trim()}</span>
                  </li>
                )}
                {b.facebook?.trim() && (
                  <li className="flex items-center gap-2.5 min-w-0">
                    <Facebook className="h-4 w-4 text-maroon-600 shrink-0" aria-hidden="true" />
                    <span className="truncate">{b.facebook.trim()}</span>
                  </li>
                )}
                {b.tiktok?.trim() && (
                  <li className="flex items-center gap-2.5 min-w-0">
                    <Music2 className="h-4 w-4 text-maroon-600 shrink-0" aria-hidden="true" />
                    <span className="truncate">@{b.tiktok.replace(/^@+/, "").trim()}</span>
                  </li>
                )}
              </ul>

              {openDays.length > 0 && (
                <div className="rounded-xl border border-border p-3">
                  <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mb-2">
                    <Clock className="h-3.5 w-3.5" aria-hidden="true" /> Jam Operasional
                  </p>
                  <ul className="grid grid-cols-1 gap-1 text-xs">
                    {hours.map((h) => (
                      <li key={h.day} className={`flex justify-between ${h.closed ? "text-muted-foreground/60" : ""}`}>
                        <span>{h.day}</span>
                        <span className="font-medium tabular-nums">{h.closed ? "Tutup" : `${h.open} – ${h.close}`}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Aksi */}
            <div className="border-t border-border p-4 flex items-center gap-2">
              {onBrowseCatalog && (
                <Button
                  className="flex-1"
                  onClick={() => {
                    onOpenChange(false);
                    onBrowseCatalog();
                  }}
                >
                  <Store className="h-4 w-4" aria-hidden="true" />
                  Lihat Katalog
                </Button>
              )}
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Tutup
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
