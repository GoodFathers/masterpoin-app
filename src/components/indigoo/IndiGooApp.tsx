"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";
import { ArrowLeft, LockKeyhole, LogOut } from "lucide-react";
import { cn } from "@/lib/wa-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useSession } from "@/hooks/use-session";
import { CHAT_UI_EVENTS } from "@/store/chat-ui";

import AuthScreen from "@/components/indigoo/AuthScreen";
import TimerView from "@/components/indigoo/TimerView";
import SaldoView from "@/components/indigoo/SaldoView";
import IdCardView from "@/components/indigoo/IdCardView";
import RoutinesTab from "@/components/indigoo/RoutinesTab";
import AppointmentsTab from "@/components/indigoo/AppointmentsTab";
import TaskAlarmCenter from "@/components/indigoo/TaskAlarmCenter";
import RealCallCenter from "@/components/indigoo/RealCallCenter";
import MapLayer from "@/components/indigoo/map/MapLayer";
import MpAwardToaster, { type MpAwardDetail } from "@/components/indigoo/MpAwardToaster";
import TopBar, { type TopMenuId } from "@/components/indigoo/TopBar";
import BottomNav, { type TabId } from "@/components/indigoo/BottomNav";
import CallsTab from "@/components/indigoo/CallsTab";
import UpdatesTab from "@/components/indigoo/UpdatesTab";
import ProfileView from "@/components/indigoo/ProfileView";
import TermsView from "@/components/indigoo/TermsView";
import PrivacyView from "@/components/indigoo/PrivacyView";
import HelpView from "@/components/indigoo/HelpView";
import AdminView from "@/components/indigoo/AdminView";

import ChatsView from "@/components/views/ChatsView";
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

/** Id view modul bisnis lama yang bisa dibuka dari halaman Profil. */
export type BizViewId =
  | "catalog"
  | "labels"
  | "broadcast"
  | "autoreplies"
  | "business-profile"
  | "link"
  | "promotions"
  | "verification"
  | "stats"
  | "devices"
  | "settings";

type ViewState =
  | { kind: "tab"; tab: TabId }
  | { kind: "menu"; view: TopMenuId }
  | { kind: "biz"; view: BizViewId };

const BIZ_VIEWS: Record<BizViewId, { label: string; Component: ComponentType }> = {
  catalog: { label: "Katalog Produk", Component: CatalogView },
  labels: { label: "Label Pelanggan", Component: LabelsView },
  broadcast: { label: "Siaran", Component: BroadcastView },
  autoreplies: { label: "Pesan Otomatis", Component: AutoRepliesView },
  "business-profile": { label: "Profil Bisnis", Component: BusinessProfileView },
  link: { label: "Link Bisnis", Component: LinkView },
  promotions: { label: "Promosi", Component: PromotionsView },
  verification: { label: "Verifikasi Bisnis", Component: VerificationView },
  stats: { label: "Statistik Pesan", Component: StatsView },
  devices: { label: "Perangkat Tertaut", Component: DevicesView },
  settings: { label: "Pengaturan", Component: SettingsView },
};

const APPLOCK_KEY = "indigoo:applock";
const UNLOCK_KEY = "indigoo:unlocked";

/** Splash layar penuh saat sesi diperiksa. */
function SplashScreen() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-background"
    >
      <img
        src="/images/logo.png"
        alt="Logo IndiGoo"
        className="h-20 w-20 animate-pulse rounded-2xl object-cover shadow-lg shadow-primary/20"
      />
      <div className="text-center">
        <p className="text-2xl font-bold tracking-tight">IndiGoo</p>
        <p className="mt-1 animate-pulse text-xs text-muted-foreground">Memuat…</p>
      </div>
    </div>
  );
}

/** Gerbang PIN saat "Kunci aplikasi" aktif (fitur menu titik-3 kanan). */
function AppLockGate({ onUnlocked, onLogout }: { onUnlocked: () => void; onLogout: () => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);

  const submit = () => {
    const saved = localStorage.getItem(APPLOCK_KEY) ?? "";
    if (saved && pin === saved) {
      sessionStorage.setItem(UNLOCK_KEY, "1");
      setError(false);
      onUnlocked();
    } else {
      setError(true);
      setPin("");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-background px-6">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
        <LockKeyhole className="h-8 w-8 text-primary" aria-hidden="true" />
      </span>
      <div className="text-center">
        <p className="text-lg font-bold">IndiGoo Terkunci</p>
        <p className="mt-1 text-xs text-muted-foreground">Masukkan PIN untuk melanjutkan.</p>
      </div>
      <div className="w-full max-w-[240px] space-y-2">
        <Input
          type="password"
          inputMode="numeric"
          maxLength={6}
          placeholder="••••"
          value={pin}
          aria-label="PIN kunci aplikasi"
          aria-invalid={error}
          onChange={(e) => {
            setPin(e.target.value.replace(/\D/g, ""));
            setError(false);
          }}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          className="h-11 text-center text-lg tracking-[0.4em]"
        />
        {error && <p className="text-center text-xs text-red-600">PIN salah, coba lagi.</p>}
        <Button className="w-full" onClick={submit}>
          Buka
        </Button>
        <Button variant="ghost" className="w-full gap-1.5 text-muted-foreground" onClick={onLogout}>
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Keluar dari akun
        </Button>
      </div>
    </div>
  );
}

/**
 * Membungkus view modul bisnis lama dengan strip kembali tipis di atas,
 * agar pengguna selalu punya jalan keluar kembali ke tab utama.
 */
function BizViewShell({ id, onBack }: { id: BizViewId; onBack: () => void }) {
  const { label, Component } = BIZ_VIEWS[id];
  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex h-12 shrink-0 items-center gap-1 border-b border-border bg-card px-2">
        <Button variant="ghost" size="sm" onClick={onBack} aria-label="Kembali ke tab sebelumnya" className="gap-1.5">
          <ArrowLeft className="h-4 w-4" />
          Kembali
        </Button>
        <span className="ml-1 truncate text-sm font-semibold text-muted-foreground">{label}</span>
      </div>
      <div className="min-h-0 flex-1">
        <Component />
      </div>
    </div>
  );
}

/**
 * Root aplikasi IndiGoo: splash → auth → layout mobile
 * (TopBar di atas, konten di tengah, BottomNav di bawah).
 */
export default function IndiGooApp() {
  const { user, loading, refresh, logout } = useSession();
  const { toast } = useToast();
  const [tab, setTab] = useState<TabId>("chat");
  const [view, setView] = useState<ViewState>({ kind: "tab", tab: "chat" });
  const [appUnlocked, setAppUnlocked] = useState(true);
  // Mode fokus peta: cangkang aplikasi memudar, lapisan peta tampil penuh.
  const [mapFocus, setMapFocus] = useState(false);

  // Tab yang dimatikan Panel Super Admin (flag fitur_* = false).
  const hiddenTabs = useMemo<TabId[]>(() => {
    const map: Record<TabId, string> = {
      chat: "fitur_chat",
      panggilan: "fitur_panggilan",
      pembaruan: "fitur_pembaruan",
      rutinitas: "fitur_rutinitas",
      appointment: "fitur_appointment",
    };
    return (Object.keys(map) as TabId[]).filter((t) => user?.flags?.[map[t]] === false);
  }, [user?.flags]);

  // Turunan saat render: tab/view efektif — bila tab aktif dimatikan admin,
  // tampilan otomatis jatuh ke tab pertama yang masih tersedia.
  const ALL_TABS: TabId[] = ["chat", "panggilan", "pembaruan", "rutinitas", "appointment"];
  const activeTab: TabId = hiddenTabs.includes(tab)
    ? ALL_TABS.find((t) => !hiddenTabs.includes(t)) ?? tab
    : tab;
  const effectiveView: ViewState =
    view.kind === "tab" && hiddenTabs.includes(view.tab)
      ? { kind: "tab", tab: activeTab }
      : view;

  const backToTab = useCallback(() => setView({ kind: "tab", tab: activeTab }), [activeTab]);

  const selectTab = useCallback((t: TabId) => {
    setTab(t);
    setView({ kind: "tab", tab: t });
  }, []);

  const openMenuView = useCallback((id: TopMenuId) => setView({ kind: "menu", view: id }), []);
  const openBizView = useCallback((v: BizViewId) => setView({ kind: "biz", view: v }), []);

  const handleLogout = useCallback(async () => {
    await logout();
    sessionStorage.removeItem(UNLOCK_KEY);
    setTab("chat");
    setView({ kind: "tab", tab: "chat" });
    toast({ title: "Berhasil keluar", description: "Sampai jumpa kembali di IndiGoo." });
  }, [logout, toast]);

  // ---------- Handler TopBar (menu titik-3 kanan — Gambar 2) ----------
  const gotoChatsWithEvent = useCallback(
    (eventName: string, delay = 180) => {
      selectTab("chat");
      window.setTimeout(() => window.dispatchEvent(new CustomEvent(eventName)), delay);
    },
    [selectTab],
  );

  const handleNewChat = useCallback(() => gotoChatsWithEvent(CHAT_UI_EVENTS.newChat), [gotoChatsWithEvent]);
  const handleNewGroup = useCallback(() => gotoChatsWithEvent(CHAT_UI_EVENTS.newGroup), [gotoChatsWithEvent]);

  const handleGoChatsHint = useCallback(
    (hint: string) => {
      selectTab("chat");
      toast({ title: hint });
    },
    [selectTab, toast],
  );

  const handleMarkAllRead = useCallback(async () => {
    try {
      const res = await fetch("/api/chats?filter=unread", { cache: "no-store" });
      const data = (await res.json()) as { chats?: { id: string; unread: number }[] };
      const unread = (data.chats ?? []).filter((c) => c.unread > 0);
      await Promise.all(
        unread.map((c) =>
          fetch(`/api/chats/${c.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ unread: 0 }),
          }),
        ),
      );
      toast({
        title: unread.length > 0 ? "Semua chat ditandai sudah dibaca" : "Tidak ada chat yang belum dibaca",
      });
      window.dispatchEvent(new CustomEvent(CHAT_UI_EVENTS.chatsRefresh));
    } catch {
      toast({ title: "Gagal menandai chat", variant: "destructive" });
    }
  }, [toast]);

  // Perpindahan ke tab Chat dari menu obrolan (titik-3 kiri)
  useEffect(() => {
    const onGoToChats = () => selectTab("chat");
    window.addEventListener("indigoo:goto-chats", onGoToChats);
    return () => window.removeEventListener("indigoo:goto-chats", onGoToChats);
  }, [selectTab]);

  // Tombol "Buka" pada toast alarm tugas → lompat ke tab Rutinitas.
  useEffect(() => {
    const onGoToRutinitas = () => selectTab("rutinitas");
    window.addEventListener("indigoo:goto-rutinitas", onGoToRutinitas);
    return () => window.removeEventListener("indigoo:goto-rutinitas", onGoToRutinitas);
  }, [selectTab]);

  // Saldo mP berubah dari tab lain (rutinitas/appointment) → segarkan chip TopBar.
  useEffect(() => {
    const onMpChanged = () => void refresh();
    window.addEventListener("indigoo:mp-changed", onMpChanged);
    return () => window.removeEventListener("indigoo:mp-changed", onMpChanged);
  }, [refresh]);

  // ---------- Kunci aplikasi ----------
  useEffect(() => {
    if (!user) return;
    const check = () => {
      const hasPin = Boolean(localStorage.getItem(APPLOCK_KEY));
      setAppUnlocked(!hasPin || sessionStorage.getItem(UNLOCK_KEY) === "1");
    };
    check();
    const onLockNow = () => {
      sessionStorage.removeItem(UNLOCK_KEY);
      setAppUnlocked(false);
    };
    window.addEventListener("indigoo:lock-now", onLockNow);
    return () => window.removeEventListener("indigoo:lock-now", onLockNow);
  }, [user]);

  // Saat aktivitas menghasilkan mP: segarkan saldo di TopBar (maks 1x / 4 detik).
  const lastMpRefreshRef = useRef(0);
  const handleMpAwarded = useCallback(
    (_award: MpAwardDetail) => {
      const now = Date.now();
      if (now - lastMpRefreshRef.current < 4000) return;
      lastMpRefreshRef.current = now;
      void refresh();
    },
    [refresh],
  );

  // Sinkronkan saldo/timer: refresh saat berpindah tampilan + tiap 30 detik selama berada di tab utama.
  const viewKey = JSON.stringify(effectiveView);
  useEffect(() => {
    if (!user) return;
    void refresh();
    // refresh stabil dari useCallback; pemicu utama adalah perpindahan view
  }, [viewKey, user?.id]);

  useEffect(() => {
    if (!user || view.kind !== "tab") return;
    const id = setInterval(() => {
      void refresh();
    }, 30_000);
    return () => clearInterval(id);
  }, [user, view.kind, refresh]);

  if (loading) return <SplashScreen />;
  if (!user) return <AuthScreen onAuthed={() => void refresh()} />;

  let content: ReactNode;
  if (effectiveView.kind === "tab") {
    content =
      effectiveView.tab === "chat" ? (
        <ChatsView />
      ) : effectiveView.tab === "panggilan" ? (
        <CallsTab />
      ) : effectiveView.tab === "pembaruan" ? (
        <UpdatesTab />
      ) : effectiveView.tab === "rutinitas" ? (
        <RoutinesTab />
      ) : (
        <AppointmentsTab />
      );
  } else if (effectiveView.kind === "menu") {
    content =
      effectiveView.view === "profil" ? (
        <ProfileView onBack={backToTab} onOpenBiz={openBizView} onLogout={handleLogout} onOpenMenu={openMenuView} />
      ) : effectiveView.view === "idcard" ? (
        <IdCardView onBack={backToTab} />
      ) : effectiveView.view === "saldo" ? (
        <SaldoView onBack={backToTab} />
      ) : effectiveView.view === "timer" ? (
        <TimerView onBack={backToTab} />
      ) : effectiveView.view === "terms" ? (
        <TermsView onBack={backToTab} />
      ) : effectiveView.view === "privacy" ? (
        <PrivacyView onBack={backToTab} />
      ) : effectiveView.view === "admin" ? (
        <AdminView onBack={backToTab} />
      ) : (
        <HelpView onBack={backToTab} />
      );
  } else {
    content = <BizViewShell id={effectiveView.view} onBack={backToTab} />;
  }

  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-background">
      <MpAwardToaster onAwarded={handleMpAwarded} />
      <TaskAlarmCenter />
      <RealCallCenter />

      {/* ===== MAPS DI BELAKANG LAYAR =====
          Lapisan peta (z-0) berisi pin titik lokasi setiap pengguna.
          Pada layar lebar cangkang aplikasi diberi tepi transparan sehingga
          peta tampak DI BELAKANG layar; tombol bulat "Peta" membuka mode
          fokus (cangkang memudar, peta penuh). */}
      <MapLayer meId={user.id} focus={mapFocus} onFocusChange={setMapFocus} />

      {/* Cangkang aplikasi (z-10) — di atas peta. Saat mode fokus peta:
          memudar + tidak bisa diklik sehingga peta terlihat penuh. */}
      <div
        data-testid="app-shell"
        className={cn(
          "relative z-10 m-auto flex h-full w-full flex-col overflow-hidden bg-background transition-[opacity,transform] duration-300",
          "lg:h-[calc(100%-1.5rem)] lg:w-[calc(100%-1.5rem)] lg:rounded-2xl lg:border lg:shadow-2xl",
          mapFocus && "pointer-events-none scale-[0.985] opacity-0 select-none",
        )}
      >
        <div className="shrink-0 border-b border-border bg-card">
          <TopBar
            user={user}
            onSelect={openMenuView}
            onLogout={handleLogout}
            onOpenBiz={openBizView}
            onNewChat={handleNewChat}
            onNewGroup={handleNewGroup}
            onGoChatsHint={handleGoChatsHint}
            onMarkAllRead={() => void handleMarkAllRead()}
          />
        </div>

        <main className="min-h-0 min-w-0 flex-1">{content}</main>

        <div className="shrink-0 border-t border-border pb-[env(safe-area-inset-bottom)] bg-white dark:bg-background">
          <BottomNav active={activeTab} onSelect={selectTab} hiddenTabs={hiddenTabs} />
        </div>
      </div>

      {!appUnlocked && <AppLockGate onUnlocked={() => setAppUnlocked(true)} onLogout={() => void handleLogout()} />}
    </div>
  );
}
