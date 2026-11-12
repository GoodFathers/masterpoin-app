"use client";

import { Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useBusinessProfile } from "@/lib/useBusinessProfile";

const TEMPLATES: { id: string; title: string; emoji: string; text: string }[] = [
  {
    id: "diskon",
    title: "Promo Diskon",
    emoji: "🔥",
    text: "🔥 PROMO SPESIAL! Diskon 20% untuk semua produk kopi & keripik di IndiGoo. Berlaku sampai akhir bulan. Order sekarang, chat kami ya! 🛒",
  },
  {
    id: "produk",
    title: "Produk Baru",
    emoji: "✨",
    text: "✨ Produk baru datang! Batik Tulis Prameswari kini tersedia di IndiGoo. Stok sangat terbatas, chat kami sebelum kehabisan 🛍️",
  },
  {
    id: "event",
    title: "Event",
    emoji: "📢",
    text: "📢 Jangan lewatkan! IndiGoo hadir di Bazar UMKM Jogja minggu depan. Ada diskon khusus pengunjung & gratis ongkir area Jogja. Sampai jumpa! 🎪",
  },
];

/** Kartu "Template Promo Siap Pakai": 3 pesan jadi dengan tombol salin teks. Nama bisnis di template selalu mengikuti profil DB. */
export default function PromoTemplatesCard() {
  const { toast } = useToast();
  const { businessName } = useBusinessProfile();

  const renderText = (text: string) => text.replaceAll("IndiGoo", businessName);

  async function copy(text: string, title: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Template disalin", description: `Template "${title}" siap ditempel ke chat pelanggan.` });
    } catch {
      toast({
        title: "Gagal menyalin",
        description: "Browser Anda mungkin tidak mengizinkan akses clipboard.",
        variant: "destructive",
      });
    }
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4 md:p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10" aria-hidden>
            <span aria-hidden className="text-lg">💬</span>
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold">Template Promo Siap Pakai</h3>
            <p className="text-xs text-muted-foreground">
              Salin pesan jadi berikut, tempel ke chat/status, lalu sesuaikan detail promonya.
            </p>
          </div>
        </div>

        <div className="space-y-2.5">
          {TEMPLATES.map((t) => (
            <div key={t.id} className="rounded-xl border border-border p-3">
              <div className="mb-1 flex items-center gap-2">
                <Badge variant="secondary" className="shrink-0">
                  <span aria-hidden className="mr-1">{t.emoji}</span>
                  {t.title}
                </Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto h-7 gap-1 text-[11px]"
                  onClick={() => copy(renderText(t.text), t.title)}
                  aria-label={`Salin teks template ${t.title}`}
                >
                  <Copy className="h-3 w-3" />
                  Salin Teks
                </Button>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">{renderText(t.text)}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
