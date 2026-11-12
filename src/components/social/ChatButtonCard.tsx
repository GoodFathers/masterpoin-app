"use client";

import { Copy, MessageCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const SNIPPET = `<a href="https://wa.me/6281234567890?text=Halo">Chat WhatsApp</a>`;

/** Kartu "Tombol Chat WhatsApp": pratinjau tombol mengapung + cuplikan kode embed. */
export default function ChatButtonCard() {
  const { toast } = useToast();

  async function copySnippet() {
    try {
      await navigator.clipboard.writeText(SNIPPET);
      toast({ title: "Kode embed disalin", description: "Tempel di situs web Anda untuk memasang tombol chat." });
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
            <MessageCircle className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold">Tombol Chat WhatsApp</h3>
            <p className="text-xs text-muted-foreground">
              Pasang tombol chat mengapung di situs web agar pengunjung bisa langsung menghubungi Anda.
            </p>
          </div>
        </div>

        {/* Pratinjau */}
        <div>
          <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">Pratinjau:</p>
          <div className="wa-chat-bg relative h-40 overflow-hidden rounded-xl border border-border" aria-label="Pratinjau tombol chat mengapung">
            <div className="bubble-in absolute left-3 top-3 max-w-[70%] rounded-2xl rounded-tl-sm px-3 py-1.5 text-xs shadow-sm">
              Halo kak, kopi Gayonya ready? ☕
            </div>
            <div className="bubble-out absolute right-3 top-14 max-w-[70%] rounded-2xl rounded-tr-sm px-3 py-1.5 text-xs shadow-sm">
              Ready kak! Mau yang 250g? 😊
            </div>
            <div className="absolute bottom-3 right-3 flex items-center gap-2">
              <span className="rounded-full bg-white px-2 py-1 text-[10px] font-medium text-primary shadow">
                Butuh bantuan? Chat kami
              </span>
              <span className="wa-pulse flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
                <MessageCircle className="h-6 w-6" />
              </span>
            </div>
          </div>
        </div>

        {/* Snippet */}
        <div>
          <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">Cuplikan kode untuk situs Anda:</p>
          <div className="relative">
            <pre className="overflow-x-auto wa-scrollbar rounded-lg bg-muted p-3 pr-16 text-[11px] leading-relaxed">
              <code>{SNIPPET}</code>
            </pre>
            <Button
              size="sm"
              variant="outline"
              className="absolute right-2 top-2 h-7 gap-1 text-[11px]"
              onClick={copySnippet}
              aria-label="Salin cuplikan kode tombol chat"
            >
              <Copy className="h-3 w-3" />
              Salin
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
