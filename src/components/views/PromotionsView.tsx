"use client";

import { Megaphone } from "lucide-react";
import AdCampaignCard from "@/components/social/AdCampaignCard";
import SocialConnectCard from "@/components/social/SocialConnectCard";
import ChatButtonCard from "@/components/social/ChatButtonCard";
import QrPromoCard from "@/components/social/QrPromoCard";
import PromoTemplatesCard from "@/components/social/PromoTemplatesCard";

/** View "Promosi": kumpulan kartu alat promosi interaktif untuk UMKM. */
export default function PromotionsView() {
  return (
    <div className="flex h-full flex-col">
      {/* Header — hanya desktop; di mobile judul sudah ditampilkan top bar AppShell */}
      <header className="hidden h-14 shrink-0 items-center gap-2.5 border-b border-border bg-sidebar px-4 md:flex md:px-6">
        <Megaphone className="h-5 w-5 text-primary" aria-hidden />
        <h1 className="text-base font-semibold">Promosi</h1>
      </header>

      <div className="flex-1 overflow-y-auto wa-scrollbar">
        <div className="mx-auto w-full max-w-4xl p-4 md:p-6">
          <p className="mb-4 text-sm text-muted-foreground">
            Perbanyak penjualan dengan iklan, tombol chat, QR promosi, dan template pesan siap kirim.
          </p>
          {/* grid-cols-1 WAJIB: tanpa template kolom eksplisit, track implisit di mobile
              mengikuti min-content blok <pre> cuplikan kode → kartu meluber (grid blowout). */}
          <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
            <AdCampaignCard />
            <SocialConnectCard />
            <ChatButtonCard />
            <QrPromoCard />
            <div className="md:col-span-2">
              <PromoTemplatesCard />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
