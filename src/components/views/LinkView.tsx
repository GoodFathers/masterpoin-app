"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  Facebook,
  Lightbulb,
  Link2,
  Loader2,
  MessageCircle,
  QrCode,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

function toDigits(phone: string): string {
  let d = (phone || "").replace(/\D/g, "");
  if (d.startsWith("0")) d = "62" + d.slice(1);
  return d;
}

export default function LinkView() {
  const { toast } = useToast();
  const [phone, setPhone] = useState("");
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const msgTouchedRef = useRef(false);
  const [message, setMessage] = useState("Halo kak, saya mau tanya-tanya produk kami 🙏");
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState("");
  const [qrLoading, setQrLoading] = useState(false);

  // Prefill nomor & nama bisnis dari profil DB
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/privacy", { cache: "no-store" });
        if (!res.ok) return;
        const d = await res.json();
        if (!phoneTouched && d?.profile?.phone) setPhone(d.profile.phone);
        if (d?.profile?.businessName) {
          setBusinessName(d.profile.businessName);
          if (!msgTouchedRef.current) {
            setMessage(`Halo kak, saya mau tanya-tanya produk ${d.profile.businessName} 🙏`);
          }
        }
      } catch {
        /* abaikan — pengguna bisa ketik manual */
      }
    })();
  }, [phoneTouched]);

  const digits = toDigits(phone);
  const validLink = digits.length >= 9 && digits.startsWith("62");
  const link = validLink
    ? `https://wa.me/${digits}${message.trim() ? `?text=${encodeURIComponent(message.trim())}` : ""}`
    : "";

  // QR otomatis mengikuti link (debounce 400ms)
  useEffect(() => {
    if (!validLink) {
      setQr("");
      return;
    }
    setQrLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/qr?text=${encodeURIComponent(link)}`, { cache: "no-store" });
        if (!res.ok) throw new Error("gagal");
        const d = await res.json();
        setQr(d.dataUrl ?? "");
      } catch {
        setQr("");
      } finally {
        setQrLoading(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [link, validLink]);

  const copyLink = useCallback(async () => {
    if (!link) {
      toast({ title: "Nomor belum valid", description: "Gunakan nomor Indonesia diawali 62.", variant: "destructive" });
      return;
    }
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Link disalin ✅", description: "Siap ditempel di bio, chat, atau QR." });
    } catch {
      toast({ title: "Gagal menyalin", description: "Salin manual dari kotak link.", variant: "destructive" });
    }
  }, [link, toast]);

  const openLink = (url: string) => {
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header — hanya desktop; di mobile judul sudah ditampilkan top bar AppShell */}
      <header className="hidden h-14 shrink-0 items-center gap-2.5 border-b border-border bg-sidebar px-4 md:flex md:px-6">
        <Link2 className="h-5 w-5 text-primary" aria-hidden />
        <div className="min-w-0">
          <h1 className="text-base font-semibold leading-tight">Link Bisnis</h1>
          <p className="text-xs text-muted-foreground leading-tight truncate">Satu tautan untuk semua pelanggan Anda</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto wa-scrollbar p-4">
        {/* grid-cols-1 (minmax(0,1fr)) WAJIB: tanpa template kolom eksplisit, track implisit
            di mobile mengikuti min-content URL wa.me yang panjang → seluruh kartu meluber
            keluar viewport (grid blowout). */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5 max-w-5xl mx-auto">
          {/* ---- Kolom kiri: pembuat link ---- */}
          <Card className="min-w-0 lg:col-span-3">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-primary" aria-hidden="true" /> Buat Link wa.me
              </CardTitle>
              <CardDescription>
                Link wa.me membuka chat WhatsApp langsung dengan nomor bisnis Anda — tanpa perlu menyimpan kontak.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="link-phone">Nomor WhatsApp bisnis</Label>
                <Input
                  id="link-phone"
                  value={phone}
                  onChange={(e) => {
                    setPhoneTouched(true);
                    setPhone(e.target.value);
                  }}
                  placeholder="+62 812-3456-7890"
                  inputMode="tel"
                  autoComplete="tel"
                />
                <p className="text-[11px] text-muted-foreground">
                  {validLink ? (
                    <span className="text-maroon-600 font-medium">✓ Nomor valid: +{digits}</span>
                  ) : (
                    "Gunakan format Indonesia, mis. 0812… atau +62 812…"
                  )}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="link-msg">Pesan otomatis (opsional)</Label>
                <Textarea
                  id="link-msg"
                  value={message}
                  onChange={(e) => {
                    msgTouchedRef.current = true;
                    setMessage(e.target.value.slice(0, 300));
                  }}
                  placeholder="Tulis pesan pembuka untuk pelanggan…"
                  rows={3}
                  maxLength={300}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Link Anda</Label>
                <div className="flex items-stretch gap-2">
                  <div
                    className="flex-1 min-w-0 flex items-center h-10 rounded-md border bg-muted/50 px-3 font-mono text-xs sm:text-sm truncate"
                    aria-live="polite"
                  >
                    {link ? (
                      <span className="truncate">{link}</span>
                    ) : (
                      <span className="text-muted-foreground">Masukkan nomor yang valid…</span>
                    )}
                  </div>
                  <Button onClick={copyLink} disabled={!link} aria-label="Salin link">
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    <span className="hidden sm:inline">{copied ? "Tersalin" : "Salin Link"}</span>
                  </Button>
                  <Button variant="outline" onClick={() => openLink(link)} disabled={!link} aria-label="Uji link di tab baru">
                    <ExternalLink className="h-4 w-4" />
                    <span className="hidden sm:inline">Uji Link</span>
                  </Button>
                </div>
              </div>

              {/* Bagikan */}
              <div className="space-y-2 pt-1">
                <Label>Bagikan lewat</Label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    className="bg-[#a83a4c] hover:bg-[#8f2b3b] text-white"
                    onClick={() =>
                      openLink(`https://wa.me/?text=${encodeURIComponent(`Cek katalog ${businessName || "kami"} 🛍️ ${link}`)}`)
                    }
                    disabled={!link}
                    aria-label="Bagikan lewat WhatsApp"
                  >
                    <MessageCircle className="h-4 w-4" /> WhatsApp
                  </Button>
                  <Button
                    size="sm"
                    className="bg-[#1877F2] hover:bg-[#166fe0] text-white"
                    onClick={() => openLink(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`)}
                    disabled={!link}
                    aria-label="Bagikan lewat Facebook"
                  >
                    <Facebook className="h-4 w-4" /> Facebook
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      openLink(
                        `https://twitter.com/intent/tweet?text=${encodeURIComponent(`Cek katalog ${businessName || "kami"} 🛍️`)}&url=${encodeURIComponent(link)}`
                      )
                    }
                    disabled={!link}
                    aria-label="Bagikan lewat X"
                  >
                    <span className="font-bold text-sm leading-none" aria-hidden="true">𝕏</span> X
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ---- Kolom kanan: QR + tips ---- */}
          <div className="min-w-0 space-y-4 lg:col-span-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <QrCode className="h-4 w-4 text-primary" aria-hidden="true" /> QR Code
                </CardTitle>
                <CardDescription>Cetak & tempel di kasir, kemasan, atau etalase.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-3">
                <div className="w-48 h-48 rounded-xl border bg-white p-2 flex items-center justify-center overflow-hidden">
                  {qrLoading ? (
                    <Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="Membuat QR" />
                  ) : qr ? (
                    <img src={qr} alt="QR Code link WhatsApp bisnis" className="w-full h-full" />
                  ) : (
                    <QrCode className="h-16 w-16 text-muted-foreground/40" aria-hidden="true" />
                  )}
                </div>
                <Button variant="outline" size="sm" asChild disabled={!qr}>
                  <a href={qr || undefined} download="qr-wa-toko-berkah-jaya.png" aria-label="Unduh QR Code">
                    <Download className="h-4 w-4" /> Unduh QR
                  </a>
                </Button>
              </CardContent>
            </Card>

            <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2 text-amber-700 dark:text-amber-400">
                  <Lightbulb className="h-4 w-4" aria-hidden="true" /> Tips Promosi
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-amber-800 dark:text-amber-300/90 list-disc list-inside">
                  <li>Tambahkan link ke bio Instagram & kemasan produk.</li>
                  <li>Cetak QR code dan taruh di meja kasir toko.</li>
                  <li>Sisipkan link di balasan otomatis & pesan siaran.</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
