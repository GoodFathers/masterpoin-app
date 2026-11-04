"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CalendarCheck2,
  Gift,
  LayoutDashboard,
  LogOut,
  Menu,
  QrCode,
  ReceiptText,
  ShieldCheck,
  Sunrise,
  UserRound,
  Wallet,
  X,
} from "lucide-react";
import { BrandWordmark } from "@/components/brand";
import { LiveBalance } from "@/components/live-points";
import { StatusBadge } from "@/components/ui";
import { ACCESS_STATUS_LABEL } from "@/lib/constants";
import { cn, initials } from "@/lib/utils";

export type ShellUser = {
  name: string;
  email: string;
  role: string;
  accessStatus: string;
  religion: string;
  avatarUrl?: string | null;
  canEditPoints?: boolean;
};

const NAV = [
  { href: "/app", label: "Beranda", icon: LayoutDashboard, exact: true },
  { href: "/app/akses", label: "Permohonan Akses", icon: QrCode },
  { href: "/app/profil", label: "Profil", icon: UserRound },
];

const BOTTOM_NAV = [
  { href: "/app/check-in", label: "Check-In", icon: CalendarCheck2 },
  { href: "/app/rutinitas", label: "Rutinitas", icon: Sunrise },
  { href: "/app", label: "Beranda", icon: LayoutDashboard, exact: true },
  { href: "/app/tukar", label: "Tukar Poin", icon: Gift },
  { href: "/app/riwayat", label: "Riwayat", icon: ReceiptText },
];

export function AppShell({
  user,
  ledgerPoints,
  timerStartedAt,
  hasPending,
  children,
}: {
  user: ShellUser;
  ledgerPoints: number;
  timerStartedAt: string | null;
  hasPending: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  const logout = async () => {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  const canAccessAdmin = user.role === "super_admin" || user.role === "admin" || Boolean(user.canEditPoints);
  const navItems = [
    ...NAV,
    ...(canAccessAdmin
      ? [
          {
            href: "/app/admin",
            label:
              user.role === "super_admin"
                ? "Super Admin & Matrix"
                : user.role === "admin"
                  ? "Admin & Matrix"
                  : "Kelola Nilai Poin",
            icon: ShieldCheck,
          },
        ]
      : []),
  ];

  const sidebar = (
    <div className="flex h-full flex-col bg-gradient-to-b from-master-800 via-master-900 to-master-950 text-white">
      <div className="flex items-center justify-between px-5 pb-4 pt-5">
        <Link href="/app" onClick={() => setOpen(false)}>
          <BrandWordmark light />
        </Link>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="grid h-8 w-8 place-items-center rounded-full text-rose-100/70 hover:bg-white/10 lg:hidden"
          aria-label="Tutup menu"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mx-4 rounded-2xl border border-white/10 bg-white/10 p-3.5 backdrop-blur">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-rose-100/70">Saldo Poin</p>
          <Wallet className="h-3.5 w-3.5 text-rose-200/80" />
        </div>
        <LiveBalance
          ledgerPoints={ledgerPoints}
          timerStartedAt={timerStartedAt}
          className="timer-digits mt-1 text-xl font-bold text-white"
        />
      </div>

      <nav className="mt-5 flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-rose-200/50">
          Menu Utama
        </p>
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href, "exact" in item ? Boolean(item.exact) : false);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={cn(
                "group flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-medium transition",
                active
                  ? "bg-white text-master-900 shadow-lg shadow-master-950/30"
                  : "text-rose-100/80 hover:bg-white/10 hover:text-white",
              )}
            >
              <Icon className={cn("h-4 w-4", active ? "text-master-600" : "text-rose-200/80")} />
              <span className="flex-1">{item.label}</span>
              {item.href === "/app/akses" && hasPending ? (
                <span className="grid h-4 min-w-4 place-items-center rounded-full bg-amber-400 px-1 text-[9px] font-bold text-amber-950">
                  !
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-2.5 rounded-xl px-2 py-2">
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatarUrl}
              alt={user.name}
              className="h-9 w-9 shrink-0 rounded-full border border-white/20 object-cover"
            />
          ) : (
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-rose-200 to-rose-400 text-[12px] font-bold text-master-950">
              {initials(user.name)}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12.5px] font-semibold text-white">{user.name}</p>
            <p className="truncate text-[10px] text-rose-100/60">{user.email}</p>
          </div>
          <button
            type="button"
            onClick={logout}
            disabled={loggingOut}
            className="grid h-8 w-8 place-items-center rounded-lg text-rose-100/70 transition hover:bg-white/10 hover:text-white"
            aria-label="Keluar"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#fffaf9]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[268px] lg:block">{sidebar}</aside>

      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Tutup menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-master-950/50 backdrop-blur-sm"
          />
          <div className="animate-rise absolute inset-y-0 left-0 w-[280px] shadow-2xl">{sidebar}</div>
        </div>
      ) : null}

      <div className="lg:pl-[268px]">
        <header className="sticky top-0 z-20 border-b border-rose-100/80 bg-white/85 backdrop-blur-lg">
          <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="grid h-9 w-9 place-items-center rounded-xl border border-rose-200 text-master-800 lg:hidden"
              aria-label="Buka menu"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-master-500">
                Master
              </p>
              <p className="truncate text-[13px] font-bold text-master-950">Poin Digital</p>
            </div>
            <StatusBadge status={user.accessStatus} label={ACCESS_STATUS_LABEL[user.accessStatus]} />
            <Link
              href="/app/profil"
              className="hidden h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full border border-rose-200 bg-gradient-to-br from-master-500 to-master-800 text-[11px] font-bold text-white sm:grid"
              aria-label="Profil"
            >
              {user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.avatarUrl} alt={user.name} className="h-full w-full object-cover" />
              ) : (
                initials(user.name)
              )}
            </Link>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1220px] px-4 pb-28 pt-5 sm:px-6 sm:pb-28 lg:pb-16 sm:pt-6">
          {children}
        </main>

        {/* Panel Bottom Navigation */}
        <nav
          className="fixed inset-x-0 bottom-0 z-40 border-t border-rose-100/90 bg-white/95 backdrop-blur-lg shadow-[0_-6px_25px_-10px_rgba(122,18,32,0.12)] pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 lg:hidden"
          aria-label="Panel Bottom Navigasi"
        >
          <div className="mx-auto grid max-w-md grid-cols-5 gap-1 px-1">
            {BOTTOM_NAV.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href, item.exact);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex flex-col items-center justify-center gap-0.5 rounded-2xl py-1 transition active:scale-95",
                    active
                      ? "text-master-600 font-bold"
                      : "text-slate-400 hover:text-master-700 font-medium",
                  )}
                >
                  <span
                    className={cn(
                      "grid h-8 w-11 place-items-center rounded-xl transition",
                      active
                        ? "bg-master-50 text-master-600 shadow-sm"
                        : "text-slate-400",
                    )}
                  >
                    <Icon className="h-4.5 w-4.5" />
                  </span>
                  <span className="text-[10px] tracking-tight leading-tight truncate max-w-full px-0.5">
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
