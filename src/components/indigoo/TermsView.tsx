"use client";

import { ArrowLeft, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const TERMS: { title: string; body: string }[] = [
  {
    title: "Layanan demo",
    body: "IndiGoo adalah aplikasi demo untuk kebutuhan pembelajaran dan uji coba. Fitur, data, dan aturan dapat berubah atau dihentikan sewaktu-waktu tanpa pemberitahuan sebelumnya.",
  },
  {
    title: "Akun & ID Akses bersifat pribadi",
    body: "Setiap akun terikat pada satu ID Akses unik beserta kata sandinya. Jaga kerahasiaan kredensial Anda; seluruh aktivitas yang terjadi melalui akun Anda dianggap dilakukan oleh Anda sendiri.",
  },
  {
    title: "mP adalah poin digital, bukan mata uang",
    body: "mP (milenial Poin) adalah poin digital hasil timer, bonus, aktivitas, dan appointment di dalam aplikasi. mP BUKAN mata uang, saham, ataupun aset keuangan apa pun, tidak memiliki nilai jual-beli, dan tidak dapat ditukar atau dikonversi menjadi Rupiah maupun mata uang lainnya.",
  },
  {
    title: "Timer berjalan setelah aktivasi",
    body: "Pengumpulan mP melalui timer dimulai otomatis setelah akun Anda diaktifkan dan berjalan terus hingga mencapai batas maksimum 365 hari. Timer tidak dapat dijeda atau diulang atas permintaan pengguna.",
  },
  {
    title: "Satu akun untuk satu pengguna",
    body: "Dilarang mendaftarkan, mengelola, atau mengendalikan lebih dari satu akun untuk menumpuk mP. Akun ganda yang terdeteksi dapat dibekukan atau dinonaktifkan.",
  },
  {
    title: "Perubahan layanan",
    body: "Kami dapat memperbarui fitur, aturan perhitungan mP, atau batas timer kapan pun. Perubahan material akan diumumkan melalui halaman pengumuman di dalam aplikasi.",
  },
  {
    title: "Penggunaan yang wajar",
    body: "Dilarang menyalahgunakan sistem, misalnya otomasi berlebihan, eksploitasi celah, atau upaya manipulasi saldo mP. Pelanggaran dapat mengakibatkan pembatasan atau penghapusan akun.",
  },
  {
    title: "Kepatuhan & kontak",
    body: "Gunakan layanan sesuai hukum dan peraturan yang berlaku. Pertanyaan mengenai ketentuan ini dapat disampaikan ke support@indigoo.id.",
  },
];

/** View statis: Syarat & Ketentuan IndiGoo. */
export default function TermsView({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex h-full flex-col bg-background">
      <header className="flex shrink-0 items-center gap-1 border-b border-border bg-card px-2 py-2">
        <Button variant="ghost" size="sm" onClick={onBack} aria-label="Kembali ke tab sebelumnya" className="gap-1.5">
          <ArrowLeft className="h-4 w-4" />
          Kembali
        </Button>
        <div className="ml-1 flex min-w-0 items-center gap-2">
          <FileText className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold leading-tight">Syarat &amp; Ketentuan</h1>
            <p className="truncate text-[11px] text-muted-foreground">Ketentuan penggunaan aplikasi IndiGoo</p>
          </div>
        </div>
      </header>

      <div className="wa-scrollbar flex-1 overflow-y-auto p-3 sm:p-4">
        <ol className="space-y-2">
          {TERMS.map((t, i) => (
            <li key={t.title}>
              <Card>
                <CardContent className="flex items-start gap-3 p-4">
                  <span
                    aria-hidden="true"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary"
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold leading-tight">{t.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t.body}</p>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
        <p className="py-4 text-center text-[11px] text-muted-foreground">
          Terakhir diperbarui: Januari 2025 · IndiGoo v1.0
        </p>
      </div>
    </div>
  );
}
