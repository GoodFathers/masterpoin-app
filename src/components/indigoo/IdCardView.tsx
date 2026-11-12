"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  Check,
  Copy,
  Gift,
  Loader2,
  QrCode,
  ScanLine,
  ShieldCheck,
  Timer as TimerIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/hooks/use-session";
import { useBusinessProfile } from "@/lib/useBusinessProfile";
import { useToast } from "@/hooks/use-toast";
import { formatMp, roleLabelId } from "@/lib/indigoo";

export default function IdCardView({ onBack }: { onBack: () => void }) {
  const { user, loading } = useSession();
  const { profile } = useBusinessProfile();
  const { toast } = useToast();
  const [qr, setQr] = useState("");
  const [qrLoading, setQrLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // QR berisi ID Akses — dipakai untuk verifikasi member.
  useEffect(() => {
    if (!user?.accessId) return;
    let alive = true;
    setQrLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/qr?text=${encodeURIComponent(user.accessId)}`, { cache: "no-store" });
        if (!res.ok) throw new Error("gagal");
        const d = (await res.json()) as { dataUrl?: string };
        if (alive) setQr(d.dataUrl ?? "");
      } catch {
        if (alive) setQr("");
      } finally {
        if (alive) setQrLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [user?.accessId]);

  const copyAccessId = useCallback(async () => {
    if (!user) return;
    try {
      await navigator.clipboard.writeText(user.accessId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "ID Akses disalin ✅", description: user.accessId });
    } catch {
      toast({ title: "Gagal menyalin", description: "Salin manual dari kartu.", variant: "destructive" });
    }
  }, [toast, user]);

  const memberSince = user
    ? new Intl.DateTimeFormat("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Asia/Jakarta",
      }).format(new Date(user.createdAt))
    : "";
  const initial = user ? user.username.charAt(0).toUpperCase() : "?";

  return (
    <div className="h-full flex flex-col bg-background">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card shrink-0">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="Kembali">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-lg font-bold tracking-tight">ID Card Member</h1>
          <p className="text-xs text-muted-foreground">Kartu identitas digital IndiGoo</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto wa-scrollbar p-4">
        <div className="max-w-2xl w-full mx-auto space-y-4">
          {loading || !user ? (
            <Skeleton className="h-64 w-full rounded-3xl" />
          ) : (
            <>
              {/* ===== Kartu member ===== */}
              <div className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-maroon-600 via-maroon-500 to-maroon-600 p-6 text-white shadow-xl shadow-maroon-900/25 ring-1 ring-maroon-900/20 transition-all duration-300 hover:shadow-2xl hover:shadow-maroon-900/30 hover:-translate-y-0.5">
                {/* pattern dekoratif */}
                <div className="absolute -right-14 -top-16 h-52 w-52 rounded-full bg-white/10" aria-hidden="true" />
                <div className="absolute -right-6 top-10 h-24 w-24 rounded-full bg-white/10" aria-hidden="true" />
                <div
                  className="absolute inset-0 opacity-[0.07]"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 1px, transparent 12px)",
                  }}
                  aria-hidden="true"
                />
                <div className="relative">
                  {/* baris atas: logo + wordmark + badge peran */}
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                      <img
                        src={profile.logoUrl || "/images/logo.png"}
                        alt={`Logo ${profile.businessName}`}
                        className="h-11 w-11 rounded-full bg-white object-contain p-1 ring-2 ring-white/40"
                      />
                      <div>
                        <p className="text-xl font-extrabold tracking-wide leading-none">IndiGoo</p>
                        <p className="text-[11px] text-maroon-50/90 mt-1">Member Card</p>
                      </div>
                    </div>
                    <Badge className="bg-white/20 text-white border-0 hover:bg-white/20 gap-1 backdrop-blur-sm">
                      <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                      {roleLabelId(user.role)}
                    </Badge>
                  </div>

                  {/* baris utama: identitas kiri, QR kanan */}
                  <div className="mt-6 flex items-end justify-between gap-4 flex-wrap sm:flex-nowrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-4">
                        <div className="h-20 w-20 rounded-full bg-white/25 ring-4 ring-white/30 flex items-center justify-center text-3xl font-bold backdrop-blur-sm select-none shrink-0">
                          {initial}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] uppercase tracking-widest text-maroon-50/80">Nama Anggota</p>
                          <p className="text-xl font-bold truncate">{user.username}</p>
                          <p className="text-xs text-maroon-50/90 mt-1">
                            Anggota sejak {memberSince}
                          </p>
                        </div>
                      </div>

                      <div className="mt-5">
                        <p className="text-[11px] uppercase tracking-widest text-maroon-50/80">ID Akses</p>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="font-mono text-lg font-semibold tracking-[0.15em] bg-white/15 rounded-lg px-3 py-1 backdrop-blur-sm">
                            {user.accessId}
                          </span>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => void copyAccessId()}
                            aria-label="Salin ID Akses"
                            className="h-8 w-8 text-white hover:bg-white/20 hover:text-white"
                          >
                            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* QR kanan */}
                    <div className="shrink-0 rounded-2xl bg-white p-2.5 shadow-lg transition-transform duration-300 group-hover:scale-[1.03]">
                      {qrLoading ? (
                        <div className="h-28 w-28 flex items-center justify-center">
                          <Loader2 className="h-6 w-6 animate-spin text-maroon-600" aria-label="Membuat QR" />
                        </div>
                      ) : qr ? (
                        <img src={qr} alt={`QR Code ID Akses ${user.accessId}`} className="h-28 w-28" />
                      ) : (
                        <div className="h-28 w-28 flex items-center justify-center">
                          <QrCode className="h-12 w-12 text-muted-foreground/40" aria-hidden="true" />
                        </div>
                      )}
                      <p className="mt-1 text-center text-[10px] font-medium text-slate-600">Pindai untuk verifikasi</p>
                    </div>
                  </div>

                  {/* strip bawah */}
                  <div className="mt-6 flex items-center justify-between gap-2 border-t border-white/25 pt-3 text-[11px] text-maroon-50/90">
                    <span className="font-medium">{profile.businessName}</span>
                    <span className="font-mono">Saldo: {formatMp(user.totalMp)} mP</span>
                  </div>
                </div>
              </div>

              {/* ===== Keunggulan member ===== */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ScanLine className="h-4 w-4 text-maroon-600" aria-hidden="true" /> Keunggulan Member IndiGoo
                  </CardTitle>
                  <CardDescription>Satu kartu untuk semua manfaat ekonomi poin.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="grid sm:grid-cols-2 gap-3 text-sm">
                    <li className="flex items-start gap-2.5 rounded-xl border bg-muted/40 p-3">
                      <TimerIcon className="h-4 w-4 mt-0.5 shrink-0 text-maroon-600" aria-hidden="true" />
                      <span>
                        <span className="font-medium">Timer mP otomatis</span>
                        <br />
                        <span className="text-xs text-muted-foreground">
                          Poin menumpuk tiap detik tanpa perlu buka aplikasi.
                        </span>
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5 rounded-xl border bg-muted/40 p-3">
                      <Gift className="h-4 w-4 mt-0.5 shrink-0 text-amber-500" aria-hidden="true" />
                      <span>
                        <span className="font-medium">Bonus rutinitas &amp; appointment</span>
                        <br />
                        <span className="text-xs text-muted-foreground">
                          Tambahan mP harian dan hadiah appointment pribadi.
                        </span>
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5 rounded-xl border bg-muted/40 p-3">
                      <QrCode className="h-4 w-4 mt-0.5 shrink-0 text-maroon-600" aria-hidden="true" />
                      <span>
                        <span className="font-medium">QR verifikasi cepat</span>
                        <br />
                        <span className="text-xs text-muted-foreground">
                          Tunjukkan QR di kartu untuk validasi identitas instan.
                        </span>
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5 rounded-xl border bg-muted/40 p-3">
                      <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0 text-maroon-600" aria-hidden="true" />
                      <span>
                        <span className="font-medium">Identitas resmi</span>
                        <br />
                        <span className="text-xs text-muted-foreground">
                          ID Akses unik berlaku di seluruh layanan IndiGoo.
                        </span>
                      </span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
