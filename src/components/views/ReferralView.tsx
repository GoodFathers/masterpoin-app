"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  Check,
  Copy,
  Gift,
  Info,
  Loader2,
  Send,
  Users,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { formatMp } from "@/lib/indigoo";

// ===================== PROGRAM REFERRAL INDIIGOO =====================
// Kode undangan pribadi + statistik + klaim kode teman.
// Bonus: pengundang +Pengundang mP, pengguna baru +Pengguna Baru mP.

interface ReferralPayload {
  code: string;
  bonusInviter: number;
  bonusNewUser: number;
  totalReferrals: number;
  totalMpEarned: number;
  referred: { username: string; accessId: string; createdAt: string }[];
  usedCode: boolean;
}

export default function ReferralView({ onBack }: { onBack?: () => void }) {
  const { toast } = useToast();
  const [data, setData] = useState<ReferralPayload | null>(null);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [applying, setApplying] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/referral", { cache: "no-store" });
      if (!res.ok) throw new Error("gagal");
      setData((await res.json()) as ReferralPayload);
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const inviteLink = data && typeof window !== "undefined" ? `${window.location.origin}/?ref=${data.code}` : "";

  const copyCode = async () => {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.code);
      setCopied(true);
      toast({ title: "Kode referral disalin", description: data.code });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Gagal menyalin", description: "Salin manual: " + data.code, variant: "destructive" });
    }
  };

  const shareInvite = async () => {
    if (!data) return;
    const text = `Yuk gabung di IndiGoo! Pakai kode referral ${data.code} saat mendaftar dan kita sama-sama dapat bonus mP. ${inviteLink}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Undangan IndiGoo", text, url: inviteLink });
        return;
      }
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
    } catch {
      // pengguna membatalkan share — abaikan
    }
  };

  const applyCode = async () => {
    const code = codeInput.trim();
    if (!code || applying) return;
    setApplying(true);
    try {
      const res = await fetch("/api/referral", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const out = (await res.json().catch(() => ({}))) as { error?: string; inviterUsername?: string; bonusNewUser?: number };
      if (!res.ok) {
        toast({ title: "Gagal memakai kode", description: out.error ?? "Coba lagi", variant: "destructive" });
        return;
      }
      toast({
        title: "Kode referral berhasil dipakai!",
        description: `Bonus +${formatMp(out.bonusNewUser ?? 0)} mP dari ${out.inviterUsername ?? "teman Anda"}.`,
      });
      setCodeInput("");
      await load();
    } catch {
      toast({ title: "Tidak dapat menghubungi server", variant: "destructive" });
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto wa-scrollbar bg-background">
      <header className="hidden md:flex sticky top-0 z-10 items-center gap-3 px-4 py-3 border-b border-border bg-card/95 backdrop-blur">
        {onBack && (
          <Button variant="ghost" size="icon" onClick={onBack} aria-label="Kembali">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        <div className="min-w-0">
          <h1 className="text-lg font-bold tracking-tight">Referral</h1>
          <p className="text-xs text-muted-foreground">Undang teman, keduanya dapat bonus mP</p>
        </div>
      </header>

      <div className="p-4 space-y-4 max-w-3xl mx-auto pb-8">
        {error && (
          <Card>
            <CardContent className="py-8 text-center space-y-3">
              <p className="text-sm text-muted-foreground">Gagal memuat data referral.</p>
              <Button variant="outline" size="sm" onClick={() => void load()}>
                <Loader2 className="h-4 w-4" /> Coba lagi
              </Button>
            </CardContent>
          </Card>
        )}

        {!data && !error && (
          <div className="space-y-4">
            <Skeleton className="h-40 w-full rounded-2xl" />
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
        )}

        {data && (
          <>
            {/* ---- Kode pribadi ---- */}
            <Card className="border-primary/30 bg-gradient-to-br from-primary/10 via-card to-maroon-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Gift className="h-5 w-5 text-primary" /> Kode Undangan Anda
                </CardTitle>
                <CardDescription>Bagikan kode ini — teman daftar, Anda berdua dibayar mP.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-center gap-3 rounded-xl border border-dashed border-primary/40 bg-background/60 px-4 py-3">
                  <span className="font-mono text-xl sm:text-2xl font-bold tracking-widest text-primary">{data.code}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" onClick={() => void copyCode()} className="gap-2 min-h-11">
                    {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                    {copied ? "Tersalin" : "Salin Kode"}
                  </Button>
                  <Button onClick={() => void shareInvite()} className="gap-2 min-h-11">
                    <Send className="h-4 w-4" /> Bagikan
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground break-all text-center">
                  Tautan undangan: <span className="font-mono">{inviteLink}</span>
                </p>
              </CardContent>
            </Card>

            {/* ---- Statistik ---- */}
            <div className="grid grid-cols-3 gap-2">
              <Card className="py-3">
                <CardContent className="px-3 flex flex-col items-center text-center gap-0.5">
                  <Users className="h-4 w-4 text-primary" />
                  <span className="text-lg font-bold leading-none">{data.totalReferrals}</span>
                  <span className="text-[10px] text-muted-foreground leading-tight">Teman Bergabung</span>
                </CardContent>
              </Card>
              <Card className="py-3">
                <CardContent className="px-3 flex flex-col items-center text-center gap-0.5">
                  <Gift className="h-4 w-4 text-primary" />
                  <span className="text-lg font-bold leading-none">+{formatMp(data.bonusInviter)}</span>
                  <span className="text-[10px] text-muted-foreground leading-tight">mP per Teman</span>
                </CardContent>
              </Card>
              <Card className="py-3">
                <CardContent className="px-3 flex flex-col items-center text-center gap-0.5">
                  <Wallet className="h-4 w-4 text-primary" />
                  <span className="text-lg font-bold leading-none">+{formatMp(data.totalMpEarned)}</span>
                  <span className="text-[10px] text-muted-foreground leading-tight">Total mP Referral</span>
                </CardContent>
              </Card>
            </div>

            {/* ---- Pakai kode teman ---- */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Punya Kode Teman?</CardTitle>
                <CardDescription>
                  {data.usedCode
                    ? "Anda sudah memakai kode referral — bonus sambutan hanya sekali."
                    : `Masukkan kode teman untuk mendapat bonus sambutan +${formatMp(data.bonusNewUser)} mP.`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data.usedCode ? (
                  <Badge variant="secondary" className="gap-1.5">
                    <Check className="h-3.5 w-3.5 text-primary" /> Kode referral sudah dipakai
                  </Badge>
                ) : (
                  <form
                    className="flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void applyCode();
                    }}
                  >
                    <Input
                      value={codeInput}
                      onChange={(e) => setCodeInput(e.target.value)}
                      placeholder="mis. REF-000001"
                      aria-label="Kode referral teman"
                      className="font-mono uppercase min-h-11"
                      maxLength={20}
                    />
                    <Button type="submit" disabled={!codeInput.trim() || applying} className="min-h-11 gap-2">
                      {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      Pakai
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>

            {/* ---- Daftar yang bergabung ---- */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" /> Yang Sudah Bergabung
                </CardTitle>
                <CardDescription>
                  {data.referred.length > 0
                    ? `${data.referred.length} pengguna masuk lewat kode Anda`
                    : "Belum ada yang bergabung — bagikan kode Anda sekarang"}
                </CardDescription>
              </CardHeader>
              {data.referred.length > 0 && (
                <CardContent className="space-y-1.5">
                  {data.referred.map((r) => (
                    <div key={r.accessId} className="flex items-center justify-between gap-3 rounded-lg bg-secondary/40 px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{r.username}</p>
                        <p className="text-[11px] text-muted-foreground font-mono">{r.accessId}</p>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {new Date(r.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    </div>
                  ))}
                  <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground pt-1">
                    <Info className="h-3.5 w-3.5 shrink-0 mt-px" />
                    Bonus mP otomatis masuk ke saldo setiap teman menyelesaikan pendaftaran dengan kode Anda.
                  </p>
                </CardContent>
              )}
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
