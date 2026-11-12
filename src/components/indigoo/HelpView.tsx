"use client";

import { ArrowLeft, CircleHelp, Clock, Mail, MessageSquareText } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const FAQ: { q: string; a: string }[] = [
  {
    q: "Lupa password?",
    a: "Kirim permintaan reset ke support@indigoo.id dengan menyertakan ID Akses Anda. Tim admin akan memverifikasi identitas dan membantu mengatur ulang kata sandi Anda.",
  },
  {
    q: "Bagaimana timer bekerja?",
    a: "Setelah akun diaktifkan, timer berjalan otomatis setiap detik hingga batas maksimum 365 hari. Progres timer disimpan (checkpoint) setiap kali Anda membuka aplikasi, sehingga mP terus bertambah meski Anda tidak aktif mengetik.",
  },
  {
    q: "Apa itu mP?",
    a: "mP (milenial Poin) adalah poin digital di IndiGoo yang diperoleh dari timer, bonus aktivasi, aktivitas harian, dan pembuatan appointment. mP adalah poin dalam aplikasi — bukan mata uang, saham, atau aset keuangan, dan tidak dapat ditukar dengan Rupiah.",
  },
  {
    q: "Bagaimana cara aktivasi akun?",
    a: "Aktivasi dilakukan oleh admin dari panel IndiGoo. Setelah status akun Anda aktif, timer langsung mulai berjalan dan kartu ID Anda menampilkan tanda terverifikasi. Hubungi dukungan bila akun Anda belum aktif.",
  },
  {
    q: "Apakah data saya aman?",
    a: "Ya. Kata sandi disimpan sebagai hash scrypt, sesi login dijaga cookie httpOnly, dan data Anda tidak pernah dibagikan ke pihak ketiga. Lihat halaman Kebijakan Privasi untuk detail lengkapnya.",
  },
  {
    q: "Bagaimana cara menghubungi dukungan?",
    a: "Kirim email ke support@indigoo.id dan sertakan ID Akses Anda agar penanganan lebih cepat. Tim dukungan merespons dalam 1×24 jam pada hari kerja.",
  },
];

/** View statis: Bantuan / FAQ IndiGoo. */
export default function HelpView({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex h-full flex-col bg-background">
      <header className="flex shrink-0 items-center gap-1 border-b border-border bg-card px-2 py-2">
        <Button variant="ghost" size="sm" onClick={onBack} aria-label="Kembali ke tab sebelumnya" className="gap-1.5">
          <ArrowLeft className="h-4 w-4" />
          Kembali
        </Button>
        <div className="ml-1 flex min-w-0 items-center gap-2">
          <CircleHelp className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold leading-tight">Bantuan</h1>
            <p className="truncate text-[11px] text-muted-foreground">Pertanyaan yang sering diajukan</p>
          </div>
        </div>
      </header>

      <div className="wa-scrollbar flex-1 space-y-3 overflow-y-auto p-3 sm:p-4">
        <Accordion type="single" collapsible className="rounded-xl border border-border bg-card px-4">
          {FAQ.map((f, i) => (
            <AccordionItem key={f.q} value={`faq-${i}`} className={i === FAQ.length - 1 ? "border-b-0" : undefined}>
              <AccordionTrigger className="text-left text-sm font-medium">{f.q}</AccordionTrigger>
              <AccordionContent className="text-xs leading-relaxed text-muted-foreground">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        {/* Kartu kontak dukungan */}
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <MessageSquareText className="h-4 w-4 text-primary" aria-hidden="true" />
              Masih butuh bantuan?
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Tim dukungan IndiGoo siap membantu Anda.
            </p>
            <div className="mt-3 flex flex-col gap-1.5 text-xs">
              <p className="flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                <span className="font-mono font-medium">support@indigoo.id</span>
              </p>
              <p className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                Respons dalam 1×24 jam pada hari kerja
              </p>
            </div>
          </CardContent>
        </Card>

        <p className="py-2 text-center text-[11px] text-muted-foreground">
          Pusat Bantuan IndiGoo v1.0
        </p>
      </div>
    </div>
  );
}
