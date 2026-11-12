"use client";

import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/wa-utils";
import { useBusinessProfile } from "@/lib/useBusinessProfile";
import { clearSessionToken } from "@/lib/session-token";

/** Kunci localStorage demo milik aplikasi yang dibersihkan saat keluar. */
const DEMO_LS_KEYS = ["bj_promo_ads", "bj_social_fb", "bj_social_ig"];

/**
 * Jalankan keluar sesi NYATA: hapus token Bearer lokal, panggil
 * POST /api/auth/logout (hapus cookie) — DITUNGGU agar tidak terpotong
 * navigasi — lalu muat ulang halaman → pengguna disambut layar Masuk.
 */
export function performLogout() {
  clearSessionToken();
  try {
    DEMO_LS_KEYS.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    // abaikan: storage diblokir — tetap lanjut keluar
  }
  void fetch("/api/auth/logout", { method: "POST" })
    .catch(() => {})
    .finally(() => window.location.reload());
}

/**
 * Tombol "Keluar" dengan dialog konfirmasi.
 * appearance:
 *  - "icon": ikon kecil untuk rail navigasi desktop (dengan tooltip)
 *  - "row":  baris penuh untuk drawer menu mobile
 *  - "block": tombol blok untuk halaman Pengaturan
 */
export function LogoutButton({ appearance, className }: { appearance: "icon" | "row" | "block"; className?: string }) {
  const { businessName } = useBusinessProfile();
  return (
    <AlertDialog>
      {appearance === "icon" && (
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <AlertDialogTrigger asChild>
                <button
                  aria-label="Keluar"
                  className={cn(
                    "h-9 w-9 rounded-full flex items-center justify-center text-muted-foreground/70",
                    "hover:bg-red-500/10 hover:text-red-600 transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    className
                  )}
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </AlertDialogTrigger>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">
              Keluar
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      {appearance === "row" && (
        <AlertDialogTrigger asChild>
          <button
            aria-label="Keluar"
            className={cn(
              "w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors",
              "text-red-600 hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary",
              className
            )}
          >
            <LogOut className="h-[18px] w-[18px] shrink-0" />
            <span className="truncate font-medium">Keluar</span>
          </button>
        </AlertDialogTrigger>
      )}
      {appearance === "block" && (
        <AlertDialogTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full min-h-11 border-red-200 text-red-600 hover:bg-red-500/10 hover:text-red-600",
              className
            )}
            aria-label={`Keluar dari ${businessName}`}
          >
            <LogOut className="h-4 w-4" /> Keluar
          </Button>
        </AlertDialogTrigger>
      )}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Keluar dari {businessName}?</AlertDialogTitle>
          <AlertDialogDescription>
            Sesi Anda akan ditutup dan perlu masuk kembali dengan username &amp; password untuk mengakses chat serta
            data bisnis. (Semua data tetap tersimpan aman.)
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Batal</AlertDialogCancel>
          <AlertDialogAction
            onClick={performLogout}
            className="bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600"
          >
            <LogOut className="h-4 w-4" /> Keluar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
