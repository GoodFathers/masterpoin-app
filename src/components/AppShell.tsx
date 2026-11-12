"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  MessageCircle,
  CircleDashed,
  Radio,
  Users,
  ShoppingBag,
  Tags,
  Megaphone,
  Bot,
  Store,
  Link2,
  TrendingUp,
  BadgeCheck,
  BarChart3,
  MonitorSmartphone,
  Settings,
  Menu,
  ShieldCheck,
  Info,
  Lock,
  MessageSquarePlus,
  UsersRound,
  Home,
  Phone,
  Building2,
  MoreVertical,
  Plus,
  CircleUserRound,
  RadioTower,
  LayoutGrid,
  ClipboardList,
  Zap,
  Star,
  SquareCheckBig,
  Bookmark,
  Check,
  CheckCheck,
  Leaf,
  LogOut,
  Loader2,
  Moon,
  RefreshCw,
  BookUser,
  CalendarCheck,
  CalendarClock,
  Gift,
  Timer as TimerIcon,
  Wallet,
  Heart,
  Trash2,
  BellRing,
  BellOff,
  LayoutDashboard,
} from "lucide-react";
import { cn } from "@/lib/wa-utils";
import { roleLabel } from "@/lib/user";
import { useBusinessProfile, type BusinessInfo } from "@/lib/useBusinessProfile";
import { can, canUser, isValidDashboard, type Perm } from "@/lib/user";
import { isAlarmEnabled } from "@/lib/alarm";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { useTheme } from "next-themes";
import { useDisplayPrefs } from "@/lib/display-prefs";
import DisplayPrefsSync from "@/components/extras/DisplayPrefsSync";
import LockScreen from "@/components/extras/LockScreen";
import { LogoutButton, performLogout } from "@/components/extras/LogoutFlow";
import LoginScreen from "@/components/extras/LoginScreen";
import CreateSheet from "@/components/extras/CreateSheet";
import { ConfirmDialog } from "@/components/chat/ChatMenus";
import CartSheet from "@/components/business/CartSheet";
// Ekonomi mP IndiGoo: rutinitas (check-in 30 hari + jadwal ibadah), appointment,
// saldo, timer, referral + toaster hadiah & pusat alarm jadwal
import RoutinesTab from "@/components/indigoo/RoutinesTab";
import AppointmentsTab from "@/components/indigoo/AppointmentsTab";
import SaldoView from "@/components/indigoo/SaldoView";
import TimerView from "@/components/indigoo/TimerView";
import MpAwardToaster from "@/components/indigoo/MpAwardToaster";
import TaskAlarmCenter from "@/components/indigoo/TaskAlarmCenter";
import ReferralView from "@/components/views/ReferralView";
import ManagementView from "@/components/views/ManagementView";
import AdminView from "@/components/indigoo/AdminView";

import ChatsView from "@/components/views/ChatsView";
import NotificationCenter from "@/components/chat/NotificationCenter";
import IncomingCallCenter from "@/components/chat/IncomingCallCenter";
import BerandaView from "@/components/views/BerandaView";
import MarketplaceView from "@/components/views/MarketplaceView";
import CallsView from "@/components/views/CallsView";
import UsersView from "@/components/views/UsersView";
import StatusView from "@/components/views/StatusView";
import ChannelsView from "@/components/views/ChannelsView";
import CommunityView from "@/components/views/CommunityView";
import CatalogView from "@/components/views/CatalogView";
import LabelsView from "@/components/views/LabelsView";
import BroadcastView from "@/components/views/BroadcastView";
import AutoRepliesView from "@/components/views/AutoRepliesView";
import BusinessProfileView from "@/components/views/BusinessProfileView";
import LinkView from "@/components/views/LinkView";
import PromotionsView from "@/components/views/PromotionsView";
import VerificationView from "@/components/views/VerificationView";
import StatsView from "@/components/views/StatsView";
import DevicesView from "@/components/views/DevicesView";
import SettingsView from "@/components/views/SettingsView";
import ContactsView from "@/components/views/ContactsView";
import { UserCog, UserPlus } from "lucide-react";

export type ViewId =
  | "beranda"
  | "chats"
  | "calls"
  | "contacts"
  | "status"
  | "channels"
  | "community"
  | "catalog"
  | "marketplace"
  | "labels"
  | "broadcast"
  | "autoreplies"
  | "business-profile"
  | "link"
  | "promotions"
  | "verification"
  | "stats"
  | "devices"
  | "settings"
  | "users"
  | "manajemen"
  | "rutinitas"
  | "appointment"
  | "saldo"
  | "timer"
  | "referral"
  | "adminpanel";

const NAV: { group: string; items: { id: ViewId; label: string; icon: React.ElementType; perm?: Perm }[] }[] = [
  {
    group: "Komunikasi",
    items: [
      { id: "beranda", label: "Beranda", icon: Home },
      { id: "chats", label: "Chat", icon: MessageCircle },
      { id: "calls", label: "Panggilan", icon: Phone },
      { id: "contacts", label: "Kontak", icon: BookUser },
      { id: "status", label: "Status", icon: CircleDashed },
      { id: "channels", label: "Channel", icon: Radio },
      { id: "community", label: "Komunitas", icon: Users },
    ],
  },
  {
    group: "Poin & Aktivitas",
    items: [
      { id: "rutinitas", label: "Rutinitas", icon: CalendarCheck },
      { id: "appointment", label: "Appointment", icon: CalendarClock },
      { id: "saldo", label: "Saldo mP", icon: Wallet },
      { id: "timer", label: "Timer mP", icon: TimerIcon },
      { id: "referral", label: "Referral", icon: Gift },
    ],
  },
  {
    group: "Toko",
    items: [
      { id: "marketplace", label: "Marketplace", icon: Store },
      { id: "catalog", label: "Katalog Produk", icon: ShoppingBag },
      { id: "labels", label: "Label Pelanggan", icon: Tags },
      { id: "broadcast", label: "Siaran", icon: Megaphone },
      { id: "autoreplies", label: "Pesan Otomatis", icon: Bot },
    ],
  },
  {
    group: "Bisnis",
    items: [
      { id: "business-profile", label: "Profil Bisnis", icon: Building2 },
      { id: "link", label: "Link Bisnis", icon: Link2 },
      { id: "promotions", label: "Promosi", icon: TrendingUp },
      { id: "verification", label: "Verifikasi Bisnis", icon: BadgeCheck },
    ],
  },
  {
    group: "Lainnya",
    items: [
      { id: "stats", label: "Statistik Pesan", icon: BarChart3 },
      { id: "devices", label: "Perangkat Tertaut", icon: MonitorSmartphone },
      { id: "settings", label: "Pengaturan", icon: Settings },
      { id: "manajemen", label: "Manajemen", icon: ShieldCheck, perm: "management.access" },
      { id: "adminpanel", label: "Panel Admin", icon: LayoutDashboard, perm: "management.access" },
      { id: "users", label: "Manajemen Pengguna", icon: UserCog, perm: "users.manage" },
    ],
  },
];

const VIEWS: Record<ViewId, React.ComponentType> = {
  beranda: BerandaView,
  chats: ChatsView,
  calls: CallsView,
  contacts: ContactsView,
  status: StatusView,
  channels: ChannelsView,
  community: CommunityView,
  catalog: CatalogView,
  marketplace: MarketplaceView,
  labels: LabelsView,
  broadcast: BroadcastView,
  autoreplies: AutoRepliesView,
  "business-profile": BusinessProfileView,
  link: LinkView,
  promotions: PromotionsView,
  verification: VerificationView,
  stats: StatsView,
  devices: DevicesView,
  settings: SettingsView,
  users: UsersView,
  manajemen: ManagementView,
  rutinitas: RoutinesTab,
  appointment: AppointmentsTab,
  // saldo/timer/referral/adminpanel memakai onBack — dirender khusus di <main>
  saldo: () => null,
  timer: () => null,
  referral: () => null,
  adminpanel: () => null,
};

/** Saring item nav berdasar izin pengguna aktif (peran + izin tambahan pribadi). */
function visibleNav(user: { role?: string | null; perms?: Perm[] | string[] | null } | null | undefined) {
  return NAV.map((g) => ({ ...g, items: g.items.filter((i) => !i.perm || canUser(user, i.perm)) })).filter(
    (g) => g.items.length > 0
  );
}

/** Ambil profil bisnis dari DB + ikut pembaruan realtime via event "wa:profile-updated". */
// (implementasi di src/lib/useBusinessProfile.ts — dipakai bersama ChatsView)

/**
 * Header berlabel — hanya dipakai di drawer mobile (tidak memakan ruang permanen).
 * Menampilkan profil bisnis + akun yang sedang masuk beserta perannya.
 */
function BusinessHeader({ onNavigate, info }: { onNavigate?: () => void; info: BusinessInfo }) {
  const { user } = useAuth();
  const initials = (user?.name || user?.username || "?").slice(0, 2).toUpperCase();
  return (
    <div>
      <Link
        href="#"
        onClick={(e) => {
          e.preventDefault();
          onNavigate?.();
        }}
        className="flex items-center gap-3 px-4 py-4 border-b border-border"
      >
        <img src={info.logoUrl} alt={`Logo ${info.businessName}`} className="h-11 w-11 rounded-full object-cover ring-2 ring-primary/30" />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="font-semibold text-[15px] leading-tight truncate">{info.businessName}</p>
            <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
          </div>
          <p className="text-xs text-muted-foreground truncate">Bisnis • Yogyakarta</p>
        </div>
      </Link>
      {/* Akun aktif + peran */}
      {user && (
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-secondary/40">
          <span
            className={`h-9 w-9 rounded-full flex items-center justify-center text-[12px] font-bold text-white shrink-0 ${
              user.role === "SUPER_ADMIN"
                ? "bg-gradient-to-br from-maroon-400 to-maroon-600"
                : user.role === "ADMIN"
                  ? "bg-gradient-to-br from-amber-400 to-orange-500"
                  : "bg-gradient-to-br from-slate-300 to-slate-400"
            }`}
            aria-hidden="true"
          >
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-tight truncate">{user.name || user.username}</p>
            <p className="text-[11px] text-muted-foreground leading-tight truncate">
              {user.accessId} · Masuk sebagai <span className="font-medium text-foreground/80">{roleLabel(user.role)}</span>
            </p>
          </div>
          {/* Saldo mP (ekonomi IndiGoo) — chip cepat, klik membuka Saldo */}
          {typeof user.totalMp === "number" && (
            <button
              type="button"
              onClick={() => {
                onNavigate?.();
                // arahkan ke Saldo mP via event nav (BusinessHeader tidak tahu setView)
                window.dispatchEvent(new CustomEvent("indigoo:goto-rutinitas", { detail: "saldo" }));
              }}
              aria-label={`Saldo ${Math.floor(user.totalMp)} mP — buka Saldo mP`}
              className="shrink-0 flex items-center gap-1 rounded-full bg-primary/10 border border-primary/25 px-2.5 py-1 text-[11px] font-bold text-primary hover:bg-primary/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Wallet className="h-3.5 w-3.5" aria-hidden="true" />
              {Math.floor(user.totalMp).toLocaleString("id-ID")} mP
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Nav berlabel — hanya dipakai di drawer mobile.
 */
function NavList({ active, onSelect }: { active: ViewId; onSelect: (id: ViewId) => void }) {
  const { businessName } = useBusinessProfile();
  const { user } = useAuth();
  const groups = visibleNav(user);
  return (
    <nav className="flex-1 overflow-y-auto wa-scrollbar py-2" aria-label="Menu utama">
      {groups.map((group) => (
        <div key={group.group} className="mb-1">
          <p className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{group.group}</p>
          {group.items.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelect(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left",
                  "hover:bg-secondary",
                  isActive ? "bg-accent text-accent-foreground font-medium" : "text-foreground/80"
                )}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon className={cn("h-[18px] w-[18px] shrink-0", isActive ? "text-primary" : "text-muted-foreground")} />
                <span className="truncate">{item.label}</span>
                {isActive && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />}
              </button>
            );
          })}
        </div>
      ))}
      {/* Keluar — selalu terlihat di dasar drawer mobile */}
      <DisplayToggles />
      <div className="px-0 pt-1 pb-0 border-t border-border">
        <LogoutButton appearance="row" />
      </div>
      <div className="px-4 pb-4 flex items-center gap-1 text-[11px] leading-relaxed text-muted-foreground">
        {businessName} v1.0 Dibuat Dengan
        <Heart className="h-3 w-3 shrink-0 fill-red-500 text-red-500" aria-hidden="true" />
      </div>
    </nav>
  );
}

/**
 * Toggle cepat tampilan (Mode Gelap & Mode Hemat) — dasar drawer mobile,
 * sehingga bisa diakses dari semua view tanpa membuka Pengaturan.
 */
function DisplayToggles() {
  const { theme, setTheme } = useTheme();
  const lite = useDisplayPrefs((s) => s.lite);
  const setLite = useDisplayPrefs((s) => s.setLite);
  const isDark = theme === "dark";

  return (
    <div className="px-0 py-2 border-t border-border">
      <p className="px-4 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Tampilan</p>
      <button
        type="button"
        onClick={() => setTheme(isDark ? "light" : "dark")}
        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors hover:bg-secondary"
        role="menuitemcheckbox"
        aria-checked={isDark}
      >
        <Moon className={cn("h-[18px] w-[18px] shrink-0", isDark ? "text-primary" : "text-muted-foreground")} />
        <span>Mode Gelap</span>
        {isDark && <Check className="ml-auto h-4 w-4 text-primary" aria-label="Aktif" />}
      </button>
      <button
        type="button"
        onClick={() => setLite(!lite)}
        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors hover:bg-secondary"
        role="menuitemcheckbox"
        aria-checked={lite}
      >
        <Leaf className={cn("h-[18px] w-[18px] shrink-0", lite ? "text-primary" : "text-muted-foreground")} />
        <span>Mode Hemat</span>
        {lite && <Check className="ml-auto h-4 w-4 text-primary" aria-label="Aktif" />}
      </button>
    </div>
  );
}

/**
 * Rail ikon (desktop) — hanya logo/icon tanpa teks agar hemat ruang.
 * Nama modul muncul sebagai tooltip saat hover.
 */
function NavRail({ active, onSelect, info }: { active: ViewId; onSelect: (id: ViewId) => void; info: BusinessInfo }) {
  const { user } = useAuth();
  const groups = visibleNav(user);
  return (
    <TooltipProvider delayDuration={150}>
      {/* Logo bisnis saja (tanpa teks) */}
      <div className="flex justify-center pt-3 pb-2.5 border-b border-border">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => onSelect("business-profile")}
              aria-label={`Profil Bisnis — ${info.businessName}`}
              className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              <img
                src={info.logoUrl}
                alt={`Logo ${info.businessName}`}
                className={cn(
                  "h-9 w-9 rounded-full object-cover transition-all",
                  active === "business-profile" ? "ring-2 ring-primary" : "ring-2 ring-primary/30 hover:ring-primary/60"
                )}
              />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs">
            <span className="font-semibold">{info.businessName}</span> — Profil Bisnis
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Ikon menu per grup, dipisah garis kecil (disaring izin peran) */}
      <nav className="flex-1 overflow-y-auto wa-scrollbar flex flex-col items-center py-2" aria-label="Menu utama">
        {groups.map((group, gi) => (
          <div key={group.group} className="flex flex-col items-center">
            {gi > 0 && <span className="h-px w-7 bg-border my-1.5" aria-hidden="true" />}
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = active === item.id;
              return (
                <Tooltip key={item.id}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => onSelect(item.id)}
                      aria-label={item.label}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "relative mt-0.5 h-10 w-10 rounded-xl flex items-center justify-center transition-colors",
                        "hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                        isActive ? "bg-accent text-primary" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Icon className="h-5 w-5 shrink-0" />
                      {isActive && <span className="absolute -left-[7px] h-5 w-[3px] rounded-full bg-primary" aria-hidden="true" />}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="text-xs">
                    {item.label}
                    <span className="sr-only"> — grup {group.group}</span>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Keluar + Info versi */}
      <div className="pb-3 pt-1 flex flex-col items-center gap-0.5">
        <LogoutButton appearance="icon" />
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              aria-label="Tentang aplikasi"
              className="h-9 w-9 rounded-full flex items-center justify-center text-muted-foreground/70 hover:bg-secondary hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Info className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs max-w-44">
            {info.businessName} v1.0 Dibuat Dengan ❤️
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}

/** Subscribe tidak-op: snapshot sesi keluar/kunci tidak pernah berubah tanpa reload halaman penuh. */
const noopSubscribe = () => () => {};

function isLockedNow(): boolean {
  try {
    return window.sessionStorage.getItem("wa_locked") === "1";
  } catch {
    return false;
  }
}

/** Cincin progres MINI utk pojok panel header Rutinitas (mobile) — pasangan ringkap dari ProgressRing di RoutinesTab. */
function MiniProgressRing({ value, max }: { value: number; max: number }) {
  const r = 15;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <div className="relative h-10 w-10 shrink-0" role="img" aria-label={`${value} dari ${max} kegiatan rutinitas selesai hari ini`}>
      <svg viewBox="0 0 36 36" className="h-10 w-10 -rotate-90" aria-hidden="true">
        <circle cx="18" cy="18" r={r} fill="none" strokeWidth="4" className="stroke-maroon-100 dark:stroke-maroon-950" />
        <circle
          cx="18"
          cy="18"
          r={r}
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          className="stroke-maroon-500 transition-all duration-500"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="text-[10px] font-bold">{value}</span>
        <span className="text-[7px] text-muted-foreground">/{max}</span>
      </div>
    </div>
  );
}

/** Tab navigasi bawah (mobile) */
function BottomTab({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      aria-label={label}
      className={cn(
        "flex-1 min-w-[52px] h-full flex flex-col items-center justify-center gap-0.5 transition-colors focus-visible:outline-none focus-visible:bg-secondary",
        active ? "text-primary" : "text-muted-foreground hover:text-foreground"
      )}
    >
      <Icon className="h-[22px] w-[22px]" aria-hidden="true" />
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}

/** Wrapper sesi: seluruh aplikasi hanya dirender bila sudah masuk. */
export default function AppShell() {
  return (
    <AuthProvider>
      <DisplayPrefsSync />
      <ShellInner />
    </AuthProvider>
  );
}

function ShellInner() {
  const { user, loading, refresh } = useAuth();
  const [view, setView] = useState<ViewId>("chats");
  const [menuOpen, setMenuOpen] = useState(false);
  // Sheet "+" (buat foto/video) & dialog logout dari menu ⋮ header atas
  const [createOpen, setCreateOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  // Total pesan belum dibaca untuk badge "Tandai Semua Sudah Dibaca" (dimuat saat ⋮ dibuka)
  const [unreadTotal, setUnreadTotal] = useState(0);
  // Kunci aplikasi (menu ⋮ → "Kunci aplikasi") — flag dibaca via useSyncExternalStore agar SSR/hydration aman.
  const locked = useSyncExternalStore(noopSubscribe, isLockedNow, () => false);
  // Mode tampilan — toggle cepat di menu ⋮ (isi dropdown hanya dirender saat terbuka → aman hydration)
  const { theme, setTheme } = useTheme();
  const lite = useDisplayPrefs((s) => s.lite);
  const setLite = useDisplayPrefs((s) => s.setLite);
  // Lencana progres Appointment di pojok panel header (mobile) — dikirim AppointmentsTab via event.
  const [appointmentBadge, setAppointmentBadge] = useState<{ count: number; cap: number } | null>(null);
  // Bel + cincin progres Rutinitas di pojok panel header (mobile) — dikirim RoutinesTab via event.
  const [rutinitasBadge, setRutinitasBadge] = useState<{ value: number; max: number; alarmOn: boolean } | null>(null);

  // Dengarkan progres Appointment & Rutinitas dari panel masing-masing (sinkron bel/cincin/lencana).
  useEffect(() => {
    const onAppointment = (e: Event) => {
      const d = (e as CustomEvent<{ count: number; cap: number }>).detail;
      if (d && typeof d.count === "number" && typeof d.cap === "number") setAppointmentBadge(d);
    };
    const onRutinitas = (e: Event) => {
      const d = (e as CustomEvent<{ value: number; max: number; alarmOn: boolean }>).detail;
      if (d && typeof d.value === "number" && typeof d.max === "number") setRutinitasBadge(d);
    };
    window.addEventListener("indigoo:appointment-progress", onAppointment);
    window.addEventListener("indigoo:rutinitas-progress", onRutinitas);
    return () => {
      window.removeEventListener("indigoo:appointment-progress", onAppointment);
      window.removeEventListener("indigoo:rutinitas-progress", onRutinitas);
    };
  }, []);

  // Dasbor pengguna (diatur Super Admin) — halaman awal setelah masuk, diterapkan sekali.
  // (deferred via setTimeout agar tidak memicu render berantai di dalam effect)
  const dashAppliedRef = useRef(false);
  useEffect(() => {
    if (!user || dashAppliedRef.current) return;
    dashAppliedRef.current = true;
    if (user.dashboard && isValidDashboard(user.dashboard)) {
      const target = user.dashboard as ViewId;
      const id = window.setTimeout(() => setView(target), 0);
      return () => window.clearTimeout(id);
    }
  }, [user]);

  const unlockApp = () => {
    try {
      window.sessionStorage.removeItem("wa_locked");
    } catch {
      // abaikan
    }
    window.location.reload();
  };

  // Kunci aplikasi (menu ⋮ header atas)
  const lockNow = () => {
    try {
      window.sessionStorage.setItem("wa_locked", "1");
    } catch {
      // abaikan
    }
    window.location.reload();
  };

  // Muat total pesan belum dibaca saat menu ⋮ header atas dibuka
  const refreshUnread = useCallback(async () => {
    try {
      const res = await fetch("/api/chats?filter=all", { cache: "no-store" });
      const data = (await res.json()) as { chats?: { unread?: number }[] };
      setUnreadTotal((data.chats ?? []).reduce((a, c) => a + (c.unread ?? 0), 0));
    } catch {
      // abaikan
    }
  }, []);

  // Alarm pusat tugas: toast "Waktunya <kegiatan>" → tombol Buka lompat ke Rutinitas.
  // detail "saldo" (dari chip mP drawer) → lompat ke Saldo mP.
  useEffect(() => {
    const onGoto = (e: Event) => {
      const target = (e as CustomEvent<string | undefined>).detail === "saldo" ? "saldo" : "rutinitas";
      setView(target);
      setMenuOpen(false);
    };
    window.addEventListener("indigoo:goto-rutinitas", onGoto);
    return () => window.removeEventListener("indigoo:goto-rutinitas", onGoto);
  }, []);

  // Status sesi keluar kini nyata via /api/auth/me (AuthProvider) — bukan sessionStorage lagi.
  const business = useBusinessProfile();

  // Layar pemuatan sesi singkat saat pertama membuka aplikasi.
  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background" role="status" aria-label="Memuat aplikasi">
        <div className="flex flex-col items-center gap-3">
          <img src={business.logoUrl} alt="" className="h-14 w-14 rounded-2xl object-cover ring-4 ring-primary/10 animate-pulse" />
          <Loader2 className="h-5 w-5 text-primary animate-spin" />
        </div>
      </div>
    );
  }

  // Belum masuk → layar login (Super Admin / Admin / Pengguna).
  if (!user) {
    return <LoginScreen />;
  }

  if (locked) {
    // Batch 1: buka kunci kini WAJIB verifikasi PIN/password ke server
    // (POST /api/auth/unlock) — bukan lagi sekadar satu klik.
    return <LockScreen businessName={business.businessName} onUnlock={unlockApp} />;
  }

  const handleNav = (id: ViewId) => {
    setView(id);
    setMenuOpen(false);
  };

  const ActiveView = VIEWS[view];
  const activeLabel = NAV.flatMap((g) => g.items).find((i) => i.id === view)?.label ?? "Chat";

  return (
    <div className="h-screen w-full flex overflow-hidden bg-background">
      {/* Realtime chat + notifikasi pesan baru (Batch 2) — render null */}
      <NotificationCenter />
      {/* Ekonomi mP: toast "+N mP" otomatis utk setiap aktivitas berhadiah —
          sekalian segarkan sesi agar chip saldo di drawer langsung berubah */}
      <MpAwardToaster onAwarded={() => void refresh()} />
      {/* Pos alarm jadwal rutinitas (bunyi + toast saat waktu kegiatan tiba) */}
      <TaskAlarmCenter />
      {/* Rail ikon desktop — hanya icon agar hemat ruang */}
      <aside className="hidden md:flex w-16 flex-col border-r border-border bg-sidebar shrink-0">
        <NavRail active={view} onSelect={handleNav} info={business} />
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar mobile */}
        <header className="md:hidden flex items-center gap-2 h-14 px-3 border-b border-border bg-sidebar shrink-0">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Buka menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72">
              <SheetTitle className="sr-only">Menu navigasi</SheetTitle>
              <BusinessHeader onNavigate={() => handleNav("business-profile")} info={business} />
              <NavList active={view} onSelect={handleNav} />
            </SheetContent>
          </Sheet>
          <img src={business.logoUrl} alt={`Logo ${business.businessName}`} className="h-8 w-8 rounded-full object-cover" />
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight truncate">{business.businessName}</p>
            <p className="text-[11px] text-muted-foreground leading-tight truncate">{activeLabel}</p>
          </div>
          {/* Menu utama (⋮) — dipindah dari panel daftar chat ke pojok header atas (mobile) */}
          {view === "chats" && (
            <DropdownMenu onOpenChange={(o) => { if (o) void refreshUnread(); }}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Menu utama" className="ml-auto shrink-0">
                  <MoreVertical className="h-5 w-5 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuItem className="gap-2.5 cursor-pointer" onClick={() => handleNav("business-profile")}>
                  <Store className="h-4 w-4" /> Fitur bisnis
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="gap-2.5 cursor-pointer"
                  onClick={() => window.dispatchEvent(new CustomEvent("wa:new-chat", { detail: { kind: "group" } }))}
                >
                  <UsersRound className="h-4 w-4" /> Grup baru
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2.5 cursor-pointer" onClick={() => handleNav("promotions")}>
                  <Megaphone className="h-4 w-4" /> Iklankan
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2.5 cursor-pointer" onClick={() => handleNav("broadcast")}>
                  <RadioTower className="h-4 w-4" /> Siaran bisnis
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2.5 cursor-pointer" onClick={() => handleNav("catalog")}>
                  <LayoutGrid className="h-4 w-4" /> Katalog
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2.5 cursor-pointer" onClick={() => handleNav("catalog")}>
                  <ClipboardList className="h-4 w-4" /> Order
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2.5 cursor-pointer" onClick={() => handleNav("autoreplies")}>
                  <Zap className="h-4 w-4" /> Balasan cepat
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2.5 cursor-pointer" onClick={() => window.dispatchEvent(new Event("wa:open-starred"))}>
                  <Star className="h-4 w-4" /> Pesan berbintang
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2.5 cursor-pointer" onClick={() => window.dispatchEvent(new Event("wa:select-chats"))}>
                  <SquareCheckBig className="h-4 w-4" /> Pilih obrolan
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2.5 cursor-pointer" onClick={() => handleNav("labels")}>
                  <Bookmark className="h-4 w-4" /> Daftar
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2.5 cursor-pointer" onClick={() => window.dispatchEvent(new Event("wa:mark-all-read"))}>
                  <CheckCheck className="h-4 w-4" />
                  Tandai Semua Sudah Dibaca
                  {unreadTotal > 0 && (
                    <span className="ml-auto text-[11px] font-semibold bg-primary text-primary-foreground rounded-full px-1.5 py-0.5">
                      {unreadTotal}
                    </span>
                  )}
                </DropdownMenuItem>
                {canUser(user, "users.manage") && (
                  <DropdownMenuItem className="gap-2.5 cursor-pointer" onClick={() => handleNav("users")}>
                    <UserCog className="h-4 w-4" /> Manajemen Pengguna
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="gap-2.5 cursor-pointer"
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                >
                  <Moon className="h-4 w-4" /> Mode Gelap
                  {theme === "dark" && <Check className="ml-auto h-4 w-4 text-primary" />}
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2.5 cursor-pointer" onClick={() => setLite(!lite)}>
                  <Leaf className="h-4 w-4" /> Mode Hemat
                  {lite && <Check className="ml-auto h-4 w-4 text-primary" />}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2.5 cursor-pointer" onClick={lockNow}>
                  <Lock className="h-4 w-4" /> Kunci aplikasi
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2.5 cursor-pointer" variant="destructive" onClick={() => setLogoutOpen(true)}>
                  <LogOut className="h-4 w-4" /> Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {/* Tombol chat/grup baru — dipindah dari header panel daftar chat ke pojok kanan atas
              (sesuai anotasi screenshot). Hanya tampil saat view Chat aktif. */}
          {view === "chats" && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Buat chat baru" className="shrink-0">
                  <MessageSquarePlus className="h-5 w-5 text-primary" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem
                  onClick={() => window.dispatchEvent(new CustomEvent("wa:new-chat", { detail: { kind: "chat" } }))}
                  className="gap-2 cursor-pointer"
                >
                  <UsersRound className="h-4 w-4" /> Chat Baru
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => window.dispatchEvent(new CustomEvent("wa:new-chat", { detail: { kind: "group" } }))}
                  className="gap-2 cursor-pointer"
                >
                  <UsersRound className="h-4 w-4" /> Grup Baru
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {/* Tombol ikon "+" — dipindah dari kepala Marketplace ke panel header atas
              (sesuai anotasi screenshot). Hanya tampil di view Marketplace & untuk peran
              berhak mengelola produk (Super Admin / Admin). Task 22: kini ikon murni
              tanpa teks agar seragam dengan pojok kanan view lain. */}
          {view === "marketplace" && canUser(user, "market.manage") && (
            <button
              type="button"
              aria-label="Tambah produk marketplace"
              className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 transition-colors hover:bg-primary/20 active:bg-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              onClick={() => window.dispatchEvent(new CustomEvent("wa:market:new-product"))}
            >
              <Plus className="h-5 w-5 text-primary" aria-hidden="true" />
            </button>
          )}
          {/* Logo/tombol pojok kanan top bar per view (mobile) — dipindah dari header internal
              view sesuai anotasi: Panggilan (logo telepon), Komunitas (logo ikon), Status
              (ikon plus), Channel (ikon plus), Katalog (logo ikon + keranjang),
              Label Pelanggan (ikon plus). Task 22: semua aksi kini ikon murni tanpa teks.
              Desktop tetap memakai header internal view. */}
          {view === "calls" && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Menu panggilan"
                  className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <Phone className="h-5 w-5 text-primary" aria-hidden="true" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem
                  className="gap-2.5 cursor-pointer text-red-600 focus:text-red-600"
                  onClick={() => window.dispatchEvent(new CustomEvent("wa:calls:clear"))}
                >
                  <Trash2 className="h-4 w-4" /> Bersihkan riwayat
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {view === "contacts" && (
            <button
              type="button"
              aria-label="Tambah kontak"
              className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 transition-colors hover:bg-primary/20 active:bg-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              onClick={() => window.dispatchEvent(new CustomEvent("wa:contacts:new"))}
            >
              <UserPlus className="h-5 w-5 text-primary" aria-hidden="true" />
            </button>
          )}
          {view === "community" && (
            <span
              className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10"
              aria-hidden="true"
            >
              <Users className="h-5 w-5 text-primary" />
            </span>
          )}
          {view === "status" && (
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <button
                type="button"
                aria-label="Muat ulang status"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 transition-colors hover:bg-primary/20 active:bg-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                onClick={() => window.dispatchEvent(new CustomEvent("wa:status:refresh"))}
              >
                <RefreshCw className="h-5 w-5 text-primary" aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="Tambah status"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 transition-colors hover:bg-primary/20 active:bg-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                onClick={() => window.dispatchEvent(new CustomEvent("wa:status:add"))}
              >
                <Plus className="h-5 w-5 text-primary" aria-hidden="true" />
              </button>
            </div>
          )}
          {view === "channels" && (
            <button
              type="button"
              aria-label="Buat channel"
              className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 transition-colors hover:bg-primary/20 active:bg-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              onClick={() => window.dispatchEvent(new CustomEvent("wa:channels:create"))}
            >
              <Plus className="h-5 w-5 text-primary" aria-hidden="true" />
            </button>
          )}
          {view === "catalog" && (
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <span
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10"
                aria-hidden="true"
              >
                <ShoppingBag className="h-5 w-5 text-primary" />
              </span>
              <CartSheet />
            </div>
          )}
          {view === "labels" && (
            <button
              type="button"
              aria-label="Tambah label baru"
              className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 transition-colors hover:bg-primary/20 active:bg-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              onClick={() => window.dispatchEvent(new CustomEvent("wa:labels:new"))}
            >
              <Plus className="h-5 w-5 text-primary" aria-hidden="true" />
            </button>
          )}
          {/* Logo/tombol pojok kanan top bar per view (mobile) — lanjutan anotasi:
              Siaran (logo megaphone), Pesan Otomatis (logo bot), Statistik Pesan
              (ikon refresh), Perangkat Tertaut (ikon plus), Pengaturan (logo gerigi),
              Manajemen Pengguna (logo akun). Task 22: semua ikon murni tanpa teks.
              Desktop tetap memakai header internal view masing-masing. */}
          {view === "broadcast" && (
            <span
              className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10"
              aria-hidden="true"
            >
              <Megaphone className="h-5 w-5 text-primary" />
            </span>
          )}
          {view === "autoreplies" && (
            <span
              className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10"
              aria-hidden="true"
            >
              <Bot className="h-5 w-5 text-primary" />
            </span>
          )}
          {view === "stats" && (
            <button
              type="button"
              aria-label="Muat ulang statistik"
              className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 transition-colors hover:bg-primary/20 active:bg-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              onClick={() => window.dispatchEvent(new CustomEvent("wa:stats:refresh"))}
            >
              <RefreshCw className="h-5 w-5 text-primary" aria-hidden="true" />
            </button>
          )}
          {view === "devices" && (
            <button
              type="button"
              aria-label="Tautkan perangkat"
              className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 transition-colors hover:bg-primary/20 active:bg-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              onClick={() => window.dispatchEvent(new CustomEvent("wa:devices:link"))}
            >
              <Plus className="h-5 w-5 text-primary" aria-hidden="true" />
            </button>
          )}
          {view === "settings" && (
            <span
              className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10"
              aria-hidden="true"
            >
              <Settings className="h-5 w-5 text-primary" />
            </span>
          )}
          {view === "users" && (
            <button
              type="button"
              aria-label="Tambah akun"
              className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 transition-colors hover:bg-primary/20 active:bg-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              onClick={() => window.dispatchEvent(new CustomEvent("wa:users:new"))}
            >
              <UserPlus className="h-5 w-5 text-primary" aria-hidden="true" />
            </button>
          )}
          {/* Pojok kanan panel header grup Poin & Aktivitas (Task 32): ikon/simbol dipindah
              dari kepala internal panel ke pojok panel header sesuai anotasi screenshot —
              Saldo mP (dompet), Timer mP (timer), Referral (hadiah), Appointment (lencana kuota),
              Rutinitas (bel alarm + cincin progres hari ini). Desktop tetap memakai header
              internal view masing-masing. */}
          {view === "saldo" && (
            <span
              className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10"
              aria-hidden="true"
            >
              <Wallet className="h-5 w-5 text-primary" />
            </span>
          )}
          {view === "timer" && (
            <span
              className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10"
              aria-hidden="true"
            >
              <TimerIcon className="h-5 w-5 text-primary" />
            </span>
          )}
          {view === "referral" && (
            <span
              className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10"
              aria-hidden="true"
            >
              <Gift className="h-5 w-5 text-primary" />
            </span>
          )}
          {view === "appointment" && appointmentBadge && (
            <Badge
              variant="outline"
              className="ml-auto shrink-0 gap-1.5 text-maroon-700 border-maroon-300 dark:text-maroon-400 dark:border-maroon-800"
            >
              <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
              {appointmentBadge.count}/{appointmentBadge.cap} hari ini
            </Badge>
          )}
          {view === "rutinitas" && (
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent("indigoo:rutinitas:toggle-alarm"))}
                aria-pressed={rutinitasBadge?.alarmOn ?? isAlarmEnabled()}
                aria-label={
                  (rutinitasBadge?.alarmOn ?? isAlarmEnabled())
                    ? "Matikan alarm tugas"
                    : "Aktifkan alarm tugas"
                }
                title={
                  (rutinitasBadge?.alarmOn ?? isAlarmEnabled())
                    ? "Alarm tugas aktif — ketuk untuk mematikan"
                    : "Alarm tugas mati — ketuk untuk mengaktifkan"
                }
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 transition-colors hover:bg-primary/20 active:bg-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {(rutinitasBadge?.alarmOn ?? isAlarmEnabled()) ? (
                  <BellRing className="h-5 w-5 text-primary" aria-hidden="true" />
                ) : (
                  <BellOff className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                )}
              </button>
              {rutinitasBadge && rutinitasBadge.max > 0 && (
                <MiniProgressRing value={rutinitasBadge.value} max={rutinitasBadge.max} />
              )}
            </div>
          )}
        </header>

        <main className="flex-1 min-h-0 min-w-0 overflow-hidden">
          {view === "chats" ? (
            <ChatsView onNavigate={setView} />
          ) : view === "beranda" ? (
            <BerandaView onNavigate={setView} />
          ) : view === "marketplace" ? (
            <MarketplaceView onNavigate={setView} />
          ) : view === "contacts" ? (
            <ContactsView onNavigate={setView} />
          ) : view === "saldo" ? (
            <SaldoView onBack={() => handleNav("beranda")} />
          ) : view === "timer" ? (
            <TimerView onBack={() => handleNav("beranda")} />
          ) : view === "referral" ? (
            <ReferralView onBack={() => handleNav("beranda")} />
          ) : view === "adminpanel" ? (
            <AdminView onBack={() => handleNav("beranda")} />
          ) : (
            <ActiveView />
          )}
        </main>

        {/* Navigasi bawah (mobile): Beranda · Marketplace · + · Chat · Profil.
            relative z-50 WAJIB: tombol "+" menonjol (-mt-4) ke area konten di atasnya;
            tanpa stacking context ini, konten view yang ber-z-index (overlay video Beranda
            z-10, dsb.) menutupi & memblokir klik tombol "+". */}
        <nav
          className="md:hidden relative z-50 shrink-0 border-t border-border bg-sidebar pb-[env(safe-area-inset-bottom)]"
          aria-label="Navigasi utama"
        >
          <div className="flex items-stretch h-16 max-w-lg mx-auto">
            <BottomTab icon={Home} label="Beranda" active={view === "beranda"} onClick={() => handleNav("beranda")} />
            <BottomTab icon={Store} label="Market" active={view === "marketplace"} onClick={() => handleNav("marketplace")} />
            <div className="flex-1 flex items-start justify-center">
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                aria-label="Buat konten baru"
                className="relative z-10 -mt-4 h-12 w-12 rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30 flex items-center justify-center hover:bg-primary/90 active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                <Plus className="h-6 w-6" aria-hidden="true" />
              </button>
            </div>
            <BottomTab icon={MessageCircle} label="Chat" active={view === "chats"} onClick={() => handleNav("chats")} />
            <BottomTab
              icon={CircleUserRound}
              label="Profil"
              active={view === "business-profile"}
              onClick={() => handleNav("business-profile")}
            />
          </div>
        </nav>
      </div>

      {/* Dering masuk panggilan WebRTC (global, satu overlay per tab) */}
      <IncomingCallCenter />

      {/* Sheet "+" — buat foto (→ Status) dan video (→ Beranda) */}
      <CreateSheet open={createOpen} onOpenChange={setCreateOpen} onNavigate={handleNav} />

      {/* Dialog logout dari menu ⋮ header atas */}
      <ConfirmDialog
        open={logoutOpen}
        onOpenChange={setLogoutOpen}
        title={`Keluar dari ${business.businessName}?`}
        description="Sesi akan ditutup di perangkat ini. Chat dan data bisnis Anda tetap aman."
        confirmLabel="Keluar"
        destructive
        onConfirm={performLogout}
      />
    </div>
  );
}
