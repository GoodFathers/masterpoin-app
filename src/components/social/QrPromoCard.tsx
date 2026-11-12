"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Loader2, QrCode } from "lucide-react";
import { cn } from "@/lib/wa-utils";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBusinessProfile } from "@/lib/useBusinessProfile";

/** Kartu "QR Code Promosi": pesan promo → tautan wa.me → QR via GET /api/qr. Nama & nomor WA selalu dari profil DB. */
export default function QrPromoCard() {
  const { toast } = useToast();
  const { businessName, phone } = useBusinessProfile();
  const [promo, setPromo] = useState("");
  const promoTouchedRef = useRef(false);
  const [qr, setQr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const seq = useRef(0);

  // Isi pesan promo default mengikuti nama bisnis terbaru (tidak menimpa jika user sudah mengetik)
  useEffect(() => {
    if (!promoTouchedRef.current && businessName) setPromo(`Promo 20% di ${businessName}!`);
  }, [businessName]);

  // Nomor wa.me dari profil DB — format 08… diubah ke 62…
  let waDigits = (phone || "").replace(/\D/g, "");
  if (waDigits.startsWith("0")) waDigits = "62" + waDigits.slice(1);
  const link = waDigits ? `https://wa.me/${waDigits}?text=${encodeURIComponent(promo)}` : "";

  useEffect(() => {
    if (!link) {
      setQr(null);
      setLoading(false);
      return;
    }
    const id = ++seq.current;
    const t = setTimeout(async () => {
      setLoading(true);
      setFailed(false);
      try {
        const res = await fetch(`/api/qr?text=${encodeURIComponent(link)}`, { cache: "no-store" });
        const data = await res.json();
        if (seq.current !== id) return;
        if (res.ok && data?.dataUrl) {
          setQr(data.dataUrl);
        } else {
          setQr(null);
          setFailed(true);
        }
      } catch {
        if (seq.current !== id) return;
        setQr(null);
        setFailed(true);
      } finally {
        if (seq.current === id) setLoading(false);
      }
    }, 450);
    return () => clearTimeout(t);
  }, [link]);

  return (
    <Card>
      <CardContent className="space-y-3 p-4 md:p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10" aria-hidden>
            <QrCode className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold">QR Code Promosi</h3>
            <p className="text-xs text-muted-foreground">
              Cetak QR untuk etalase/kemasan — pelanggan memindai dan langsung masuk ke chat promo Anda.
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="promo-msg">Pesan promo</Label>
          <Input
            id="promo-msg"
            value={promo}
            onChange={(e) => {
              promoTouchedRef.current = true;
              setPromo(e.target.value);
            }}
            maxLength={200}
            placeholder="Tulis pesan promo…"
          />
          <p className="break-all text-[10px] text-muted-foreground">Tautan: {link}</p>
        </div>

        <div className="flex items-center gap-4">
          <div
            className={cn(
              "flex h-40 w-40 shrink-0 items-center justify-center rounded-xl border border-border bg-white"
            )}
            aria-label="QR Code promosi"
            aria-busy={loading}
          >
            {loading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
            ) : qr ? (
              <img src={qr} alt="QR Code promosi wa.me" className="h-full w-full rounded-xl object-contain p-1.5" />
            ) : (
              <span className="px-3 text-center text-[10px] text-muted-foreground">
                {failed ? "Gagal memuat QR. Ubah pesan lalu coba lagi." : "QR akan tampil di sini"}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-xs text-muted-foreground">
              Saat dipindai, pelanggan membuka WhatsApp dengan pesan promo yang sudah terisi otomatis.
            </p>
            <Button asChild variant="outline" size="sm" disabled={!qr}>
              <a
                href={qr ?? undefined}
                download={`qr-promosi-${waDigits}.png`}
                onClick={() => toast({ title: "QR Code berhasil diunduh", description: "Siap dicetak untuk promosi toko Anda." })}
                aria-disabled={!qr}
              >
                <Download className="h-4 w-4" />
                Unduh QR
              </a>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
