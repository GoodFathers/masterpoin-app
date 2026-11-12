"use client";

import { ArrowLeft, Database, FileLock2, Handshake, Mail, ShieldCheck, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const SECTIONS: { icon: typeof Database; title: string; body: string }[] = [
  {
    icon: Database,
    title: "Data yang kami simpan",
    body: "IndiGoo menyimpan: ID Akses, username, hash kata sandi (tidak pernah disimpan sebagai teks biasa), serta aktivitas mP Anda seperti bonus, progres timer, dan appointment yang dibuat.",
  },
  {
    icon: FileLock2,
    title: "Cookie & sesi",
    body: "Login Anda dijaga oleh cookie sesi httpOnly bernama indigoo_session yang berlaku hingga 30 hari. Cookie ini tidak dapat dibaca oleh skrip di peramban maupun pihak ketiga.",
  },
  {
    icon: Handshake,
    title: "Tidak dibagikan ke pihak ketiga",
    body: "Data akun Anda tidak dijual, disewakan, atau dibagikan kepada pihak ketiga. Data hanya dipakai untuk menjalankan layanan IndiGoo dan meningkatkan kualitas aplikasi.",
  },
  {
    icon: ShieldCheck,
    title: "Keamanan",
    body: "Kata sandi di-hash menggunakan scrypt, sesi diverifikasi dengan token bertanda tangan, dan seluruh lalu lintas aplikasi dienkripsi melalui HTTPS.",
  },
  {
    icon: UserCheck,
    title: "Hak Anda",
    body: "Anda berhak meminta ringkasan data yang kami simpan, keluar dari perangkat kapan pun melalui menu Keluar, serta meminta penghapusan akun melalui dukungan resmi.",
  },
];

/** View statis: Kebijakan Privasi IndiGoo. */
export default function PrivacyView({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex h-full flex-col bg-background">
      <header className="flex shrink-0 items-center gap-1 border-b border-border bg-card px-2 py-2">
        <Button variant="ghost" size="sm" onClick={onBack} aria-label="Kembali ke tab sebelumnya" className="gap-1.5">
          <ArrowLeft className="h-4 w-4" />
          Kembali
        </Button>
        <div className="ml-1 flex min-w-0 items-center gap-2">
          <ShieldCheck className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold leading-tight">Kebijakan Privasi</h1>
            <p className="truncate text-[11px] text-muted-foreground">Bagaimana IndiGoo menangani data Anda</p>
          </div>
        </div>
      </header>

      <div className="wa-scrollbar flex-1 space-y-2 overflow-y-auto p-3 sm:p-4">
        {SECTIONS.map(({ icon: Icon, title, body }) => (
          <Card key={title}>
            <CardContent className="flex items-start gap-3 p-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-tight">{title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{body}</p>
              </div>
            </CardContent>
          </Card>
        ))}

        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex items-start gap-3 p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Mail className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-tight">Hubungi kami soal privasi</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Ada pertanyaan atau permintaan terkait data pribadi Anda? Kirim email ke{" "}
                <span className="font-mono font-medium text-foreground">support@indigoo.id</span>.
              </p>
            </div>
          </CardContent>
        </Card>

        <p className="py-3 text-center text-[11px] text-muted-foreground">
          Terakhir diperbarui: Januari 2025 · IndiGoo v1.0
        </p>
      </div>
    </div>
  );
}
