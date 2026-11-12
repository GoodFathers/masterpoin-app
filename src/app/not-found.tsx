import Link from "next/link";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center gap-4 bg-maroon-50 px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-maroon-500/10">
        <Compass className="h-8 w-8 text-maroon-500" aria-hidden />
      </div>
      <h1 className="text-6xl font-bold text-maroon-500">404</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Halaman yang Anda cari tidak ditemukan atau sudah dipindahkan.
      </p>
      <Link
        href="/"
        className="mt-2 inline-flex items-center justify-center rounded-full bg-maroon-500 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-maroon-600"
      >
        Kembali ke Beranda
      </Link>
    </main>
  );
}
