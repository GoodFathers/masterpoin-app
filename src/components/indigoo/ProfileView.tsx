"use client";

import {
  ArrowLeft,
  BadgeCheck,
  BarChart3,
  Bot,
  CircleHelp,
  Clipboard,
  FileText,
  IdCard,
  Link2,
  LogOut,
  Megaphone,
  MonitorSmartphone,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Store,
  Tags,
  Timer,
  TrendingUp,
  UserRound,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useSession } from "@/hooks/use-session";
import { formatMp } from "@/lib/indigoo";
import { cn, getInitials } from "@/lib/wa-utils";
import type { BizViewId } from "@/components/indigoo/IndiGooApp";
import type { TopMenuId } from "@/components/indigoo/TopBar";

interface ProfileViewProps {
  onBack: () => void;
  onOpenBiz: (v: BizViewId) => void;
  onLogout: () => void;
  onOpenMenu?: (id: TopMenuId) => void;
}

const BIZ_MENU: { id: BizViewId; label: string; icon: typeof ShoppingBag }[] = [
  { id: "catalog", label: "Katalog Produk", icon: ShoppingBag },
  { id: "labels", label: "Label Pelanggan", icon: Tags },
  { id: "broadcast", label: "Siaran", icon: Megaphone },
  { id: "autoreplies", label: "Pesan Otomatis", icon: Bot },
  { id: "business-profile", label: "Profil Bisnis", icon: Store },
  { id: "link", label: "Link Bisnis", icon: Link2 },
  { id: "promotions", label: "Promosi", icon: TrendingUp },
  { id: "verification", label: "Verifikasi Bisnis", icon: BadgeCheck },
  { id: "stats", label: "Statistik Pesan", icon: BarChart3 },
  { id: "devices", label: "Perangkat Tertaut", icon: MonitorSmartphone },
  { id: "settings", label: "Pengaturan", icon: Settings },
];

const ACCOUNT_MENU: { id: TopMenuId; label: string; icon: typeof IdCard }[] = [
  { id: "idcard", label: "ID Card", icon: IdCard },
  { id: "saldo", label: "Saldo mP", icon: Wallet },
  { id: "timer", label: "Timer", icon: Timer },
  { id: "terms", label: "Syarat & Ketentuan", icon: FileText },
  { id: "privacy", label: "Privasi", icon: ShieldCheck },
  { id: "help", label: "Bantuan", icon: CircleHelp },
];

function roleBadgeClass(role: string): string {
  if (role === "SUPER_ADMIN") return "bg-maroon-100 text-maroon-700 border-maroon-200";
  if (role === "ADMIN") return "bg-amber-100 text-amber-700 border-amber-200";
  return "bg-secondary text-secondary-foreground";
}

function timerStatus(user: NonNullable<ReturnType<typeof useSession>["user"]>): {
  label: string;
  dot: string;
} {
  if (!user.timer.activated) return { label: "Belum diaktifkan", dot: "bg-muted-foreground/40" };
  if (user.timer.completed) return { label: "Selesai", dot: "bg-amber-500" };
  return { label: "Aktif", dot: "bg-maroon-500" };
}

/** Halaman Profil — identitas akun, ringkasan mP, dan pintu ke semua modul bisnis lama. */
export default function ProfileView({ onBack, onOpenBiz, onLogout, onOpenMenu }: ProfileViewProps) {
  const { user } = useSession();
  const { toast } = useToast();

  const copyAccessId = async () => {
    if (!user) return;
    try {
      await navigator.clipboard.writeText(user.accessId);
      toast({ title: "ID Akses disalin", description: user.accessId });
    } catch {
      toast({
        title: "Gagal menyalin",
        description: `Salin manual: ${user.accessId}`,
        variant: "destructive",
      });
    }
  };

  const memberSince = user
    ? new Date(user.createdAt).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Asia/Jakarta",
      })
    : "";
  const status = user ? timerStatus(user) : null;

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <header className="flex shrink-0 items-center gap-1 border-b border-border bg-card px-2 py-2">
        <Button variant="ghost" size="sm" onClick={onBack} aria-label="Kembali ke tab sebelumnya" className="gap-1.5">
          <ArrowLeft className="h-4 w-4" />
          Kembali
        </Button>
        <h1 className="ml-1 text-base font-semibold leading-tight">Profil</h1>
      </header>

      <div className="wa-scrollbar flex-1 space-y-3 overflow-y-auto p-3 sm:p-4">
        {!user ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Sesi tidak ditemukan.</p>
        ) : (
          <>
            {/* Kartu akun */}
            <Card>
              <CardContent className="flex items-start gap-4 p-4">
                <div
                  aria-hidden="true"
                  className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-maroon-400 to-maroon-600 text-xl font-bold text-white shadow-md shadow-maroon-500/25"
                >
                  {getInitials(user.username)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-lg font-bold leading-tight">{user.username}</p>
                    <Badge variant="outline" className={cn("text-[11px]", roleBadgeClass(user.role))}>
                      <UserRound className="mr-1 h-3 w-3" aria-hidden="true" />
                      {user.role === "SUPER_ADMIN" ? "Super Admin" : user.role === "ADMIN" ? "Admin" : "Pengguna"}
                    </Badge>
                  </div>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                      {user.accessId}
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      aria-label="Salin ID Akses"
                      onClick={copyAccessId}
                    >
                      <Clipboard className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">Anggota sejak {memberSince}</p>
                </div>
              </CardContent>
            </Card>

            {/* Kartu ringkas: mP + timer */}
            <Card>
              <CardContent className="grid grid-cols-2 gap-3 p-4">
                <div>
                  <p className="text-xs text-muted-foreground">Total mP</p>
                  <p className="mt-0.5 text-lg font-bold tabular-nums text-primary">
                    {formatMp(user.totalMp)} <span className="text-xs font-semibold">mP</span>
                  </p>
                </div>
                <div className="sm:border-l sm:border-border sm:pl-3">
                  <p className="text-xs text-muted-foreground">Status Timer</p>
                  <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold">
                    <span aria-hidden="true" className={cn("h-2 w-2 rounded-full", status?.dot)} />
                    {status?.label}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Menu Bisnis */}
            <section aria-labelledby="menu-bisnis-heading">
              <h2 id="menu-bisnis-heading" className="px-1 pb-2 text-sm font-semibold text-foreground">
                Menu Bisnis
              </h2>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {BIZ_MENU.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onOpenBiz(id)}
                    aria-label={`Buka ${label}`}
                    className="flex min-h-[44px] flex-col items-center gap-2 rounded-xl border border-border bg-card p-3 text-center transition-colors hover:border-primary/40 hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="text-xs leading-tight text-foreground">{label}</span>
                  </button>
                ))}
              </div>
            </section>

            {/* Akses cepat akun */}
            {onOpenMenu && (
              <section aria-labelledby="akun-heading">
                <h2 id="akun-heading" className="px-1 pb-2 text-sm font-semibold text-foreground">
                  Akun Saya
                </h2>
                <div className="grid grid-cols-3 gap-2">
                  {ACCOUNT_MENU.map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => onOpenMenu(id)}
                      aria-label={`Buka ${label}`}
                      className="flex min-h-[44px] flex-col items-center gap-2 rounded-xl border border-border bg-card p-3 text-center transition-colors hover:border-primary/40 hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-foreground/70">
                        <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                      </span>
                      <span className="text-xs leading-tight text-foreground">{label}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Lainnya */}
            <section aria-labelledby="lainnya-heading">
              <h2 id="lainnya-heading" className="px-1 pb-2 text-sm font-semibold text-foreground">
                Lainnya
              </h2>
              <Button
                variant="outline"
                onClick={onLogout}
                aria-label="Keluar dari akun"
                className="w-full gap-2 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Keluar
              </Button>
              <Separator className="my-4" />
              <p className="text-center text-[11px] text-muted-foreground">
                IndiGoo v1.0 · Ditenagai poin mP
              </p>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
