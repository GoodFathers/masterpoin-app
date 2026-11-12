"use client";

import { useState } from "react";
import {
  CheckCheck,
  ChevronRight,
  ClipboardList,
  Info,
  LayoutGrid,
  List,
  Loader2,
  LockKeyhole,
  LogOut,
  Megaphone,
  MessageSquarePlus,
  MessagesSquare,
  MoreVertical,
  Radio,
  Settings2,
  ShieldCheck,
  SquareCheckBig,
  Star,
  Store,
  UsersRound,
  Video,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useBusinessProfile } from "@/lib/useBusinessProfile";
import { cn, getInitials } from "@/lib/wa-utils";
import { formatMp, roleLabelId, type MeUser } from "@/lib/indigoo";
import { realcall } from "@/lib/realcall";
import { useRealcallStore, type PeerInfo } from "@/store/realcall";
import ObrolanMenu, { useObrolanMenu } from "@/components/indigoo/ObrolanMenu";
import type { BizViewId } from "@/components/indigoo/IndiGooApp";

export type TopMenuId = "profil" | "idcard" | "saldo" | "timer" | "terms" | "privacy" | "help" | "admin";

const APPLOCK_KEY = "indigoo:applock";
const UNLOCK_KEY = "indigoo:unlocked";

interface TopBarProps {
  user: MeUser;
  onSelect: (id: TopMenuId) => void;
  onLogout: () => void;
  onOpenBiz: (v: BizViewId) => void;
  onNewChat: () => void;
  onNewGroup: () => void;
  onGoChatsHint: (hint: string) => void;
  onMarkAllRead: () => void;
}

/**
 * Bar atas IndiGoo.
 * - Kiri  : logo (→ Profil) dan identitas pengguna.
 * - Desktop (≥lg): tombol chat baru + TITIK-3 menu Obrolan mandiri di tepi
 *   panel daftar chat (Gambar 1).
 * - Kanan : chip saldo mP dan SATU-SATUNYA titik-3. Pada mobile/tablet
 *   titik-3 ini berisi MENU GABUNGAN (bagian "Menu Obrolan" terbuka di
 *   dalam menu yang sama + menu Bisnis — Gambar 2); pada desktop hanya
 *   menu Bisnis karena menu Obrolan sudah tersedia di kiri.
 *
 * Catatan mobile/tablet: tombol chat baru TIDAK dipasang di bar atas
 * (dihapus sesuai masukan) — pembuatan chat tetap bisa dari tombol di
 * header panel daftar chat.
 */
export default function TopBar({
  user,
  onSelect,
  onLogout,
  onOpenBiz,
  onNewChat,
  onNewGroup,
  onGoChatsHint,
  onMarkAllRead,
}: TopBarProps) {
  const { profile } = useBusinessProfile();
  const { toast } = useToast();
  const isSuperAdmin = user.role === "SUPER_ADMIN";
  // Panel Admin & Matriks dapat dibuka SUPER_ADMIN dan ADMIN (Task 82).
  const isAdmin = isSuperAdmin || user.role === "ADMIN";
  const bisnisOff = user.flags?.fitur_bisnis === false;

  // ---------- Kamera: video call nyata (WebRTC) ----------
  const [camOpen, setCamOpen] = useState(false);
  const callConn = useRealcallStore((s) => s.conn);
  const callPeers = useRealcallStore((s) => s.peers);
  const callBusy = useRealcallStore((s) => Boolean(s.call || s.incoming || s.confActive));

  /** Mulai panggilan video NYATA ke pengguna daring dari dialog kamera. */
  const startVideo = (p: PeerInfo) => {
    const res = realcall.invite(p, "VIDEO");
    if (!res.ok && res.error) {
      toast({ title: "Tidak dapat menelepon", description: res.error, variant: "destructive" });
      return;
    }
    setCamOpen(false);
    toast({ title: `Memanggil ${p.username}…`, description: "Panggilan video dimulai — menunggu dijawab." });
  };

  const openCamera = () => {
    realcall.ensureConnected(); // pastikan presence & daftar daring aktif
    setCamOpen(true);
  };

  // ---------- Kunci aplikasi ----------
  const [lockOpen, setLockOpen] = useState(false);
  const [lockEnabled, setLockEnabled] = useState(false);
  const [pin, setPin] = useState("");

  /** Buka dialog kunci: mulai dari kondisi tersimpan di perangkat. */
  const openLockDialog = () => {
    const saved = localStorage.getItem(APPLOCK_KEY) ?? "";
    setLockEnabled(Boolean(saved));
    setPin("");
    setLockOpen(true);
  };

  const saveLock = () => {
    if (lockEnabled) {
      if (!/^\d{4,6}$/.test(pin)) {
        toast({ title: "PIN tidak valid", description: "Gunakan 4–6 digit angka.", variant: "destructive" });
        return;
      }
      localStorage.setItem(APPLOCK_KEY, pin);
      toast({ title: "Kunci aplikasi aktif", description: "PIN akan diminta saat membuka IndiGoo." });
    } else {
      localStorage.removeItem(APPLOCK_KEY);
      toast({ title: "Kunci aplikasi dimatikan" });
    }
    setLockOpen(false);
  };

  const lockNow = () => {
    if (!localStorage.getItem(APPLOCK_KEY)) {
      toast({ title: "Aktifkan kunci & simpan PIN terlebih dahulu" });
      return;
    }
    sessionStorage.removeItem(UNLOCK_KEY);
    window.dispatchEvent(new Event("indigoo:lock-now"));
    setLockOpen(false);
    toast({ title: "Aplikasi terkunci", description: "Masukkan PIN untuk membuka." });
  };

  // ---------- Menu Obrolan tergabung (mobile/tablet <lg) ----------
  // Isi menu & dialog dibagikan dari hook yang sama dengan menu mandiri.
  // Dialog dirender di luar dropdown agar tetap terpasang saat menu tertutup.
  // inlineSubs: sub-menu melayang diganti bagian terbuka di dalam menu —
  // pada layar sempit sub-menu melayang pernah terpotong keluar layar.
  const { menuItems: obrolanItems, dialogs: obrolanDialogs, resetInline: resetObrolanInline } = useObrolanMenu(
    () => {
      window.dispatchEvent(new CustomEvent("indigoo:goto-chats"));
    },
    { inlineSubs: true },
  );
  const [obrolanOpen, setObrolanOpen] = useState(false);

  // Tombol chat baru — hanya dipasang pada kluster desktop (≥lg) di tepi
  // panel daftar chat (di bawah tidak dipakai lagi sesuai masukan pengguna).
  const newChatButton = (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Buat chat baru"
      className="h-9 w-9"
      onClick={onNewChat}
    >
      <MessageSquarePlus className="h-5 w-5 text-primary" />
    </Button>
  );

  return (
    <header className="relative flex h-14 w-full shrink-0 items-center gap-1.5 px-3 sm:gap-2.5 sm:px-4">
      {/* Logo → Profil */}
      <button
        type="button"
        onClick={() => onSelect("profil")}
        className="flex min-w-0 items-center gap-2.5 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        aria-label="Buka Profil"
      >
        <img
          src={profile.logoUrl}
          alt={`Logo ${profile.businessName}`}
          className="h-9 w-9 shrink-0 rounded-full object-cover ring-2 ring-primary/25"
        />
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-[15px] font-bold tracking-tight">IndiGoo</span>
          <span className="block truncate text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground/80">{user.username}</span>
            {" · "}
            {roleLabelId(user.role)}
          </span>
        </span>
      </button>

      {/* Mobile & tablet (<lg): TIDAK ada tombol lagi di sini — desain
          header bersih; titik-3 kanan adalah satu-satunya menu. */}

      {/* Desktop (≥lg): chat baru + titik-3 menu Obrolan mandiri DIGESER KE
          KANAN — tepi kanannya rata dengan tepi kanan panel daftar chat
          (lg:400px), persis di atas ikon pada header panel (Gambar 1).
          pointer-events-none agar area kosong tidak menghalangi klik logo. */}
      <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-[380px] items-center justify-end pr-4 lg:flex lg:w-[400px]">
        <div className="pointer-events-auto flex items-center gap-0.5">
          {newChatButton}
          <ObrolanMenu
            onGoToChats={() => {
              window.dispatchEvent(new CustomEvent("indigoo:goto-chats"));
            }}
          />
        </div>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        <span
          className="hidden items-center rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary sm:flex"
          title="Total saldo mP Anda"
        >
          {formatMp(user.totalMp)} mP
        </span>

        {/* Kamera — video call NYATA (WebRTC) ke pengguna daring.
            Ditempatkan TEPAT SEBELUM titik-3 sesuai permintaan. */}
        <Button
          variant="ghost"
          size="icon"
          aria-label="Kamera — video call"
          title="Kamera — video call"
          className="h-9 w-9"
          onClick={openCamera}
        >
          <Video className="h-5 w-5 text-primary" />
        </Button>

        {/* Titik-3 #2 — menu Bisnis (Gambar 2) */}
        <DropdownMenu
          onOpenChange={(open) => {
            // Menu ditutup → ciutkan kembali bagian Menu Obrolan & isinya.
            if (!open) {
              setObrolanOpen(false);
              resetObrolanInline();
            }
          }}
        >
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Menu lainnya" className="h-9 w-9">
              <MoreVertical className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={6} className="w-64 max-h-[75vh] overflow-y-auto wa-scrollbar">
            {isAdmin && (
              <>
                <DropdownMenuItem onSelect={() => onSelect("admin")} className="gap-2.5 font-semibold text-maroon-700 focus:text-maroon-700 dark:text-maroon-300">
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  {isSuperAdmin ? "Panel Super Admin" : "Panel Admin"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}

            {/* Mobile/tablet (<lg): bagian "Menu Obrolan" TERBUKA DI DALAM
                menu ini (bukan sub-menu melayang) sehingga seluruh isinya
                selalu terbaca di layar sempit. */}
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                setObrolanOpen((v) => !v);
              }}
              aria-expanded={obrolanOpen}
              className="gap-2.5 lg:hidden"
            >
              <MessagesSquare className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              Menu Obrolan
              <ChevronRight
                className={cn("ml-auto h-4 w-4 text-muted-foreground transition-transform", obrolanOpen && "rotate-90")}
                aria-hidden="true"
              />
            </DropdownMenuItem>
            {obrolanOpen && (
              <div className="ml-4 border-l border-border/70 pl-1 lg:hidden" data-obrolan-section>
                {obrolanItems}
              </div>
            )}
            <DropdownMenuSeparator className="lg:hidden" />
            {!bisnisOff && (
              <>
                <DropdownMenuItem onSelect={() => onOpenBiz("business-profile")} className="gap-2.5">
                  <Store className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  Fitur bisnis
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuItem onSelect={onNewGroup} className="gap-2.5">
              <UsersRound className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              Grup baru
            </DropdownMenuItem>
            {!bisnisOff && (
              <>
                <DropdownMenuItem onSelect={() => onOpenBiz("promotions")} className="gap-2.5">
                  <Megaphone className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  Iklankan
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onOpenBiz("broadcast")} className="gap-2.5">
                  <Radio className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  Siaran bisnis
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onOpenBiz("catalog")} className="gap-2.5">
                  <LayoutGrid className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  Katalog
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onOpenBiz("labels")} className="gap-2.5">
                  <ClipboardList className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  Order
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onOpenBiz("autoreplies")} className="gap-2.5">
                  <Zap className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  Balasan cepat
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuItem
              onSelect={() => onGoChatsHint("Belum ada pesan berbintang. Buka percakapan untuk menemukan pesan penting.")}
              className="gap-2.5"
            >
              <Star className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              Pesan berbintang
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => onGoChatsHint("Buka sebuah obrolan, lalu gunakan Menu Obrolan → Pilih pesan.")}
              className="gap-2.5"
            >
              <SquareCheckBig className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              Pilih obrolan
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => onGoChatsHint("Susun daftar chat dengan filter: Semua, Belum dibaca, Grup, Arsip.")}
              className="gap-2.5"
            >
              <List className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              Daftar
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onMarkAllRead} className="gap-2.5">
              <CheckCheck className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              Tandai Semua Sudah Dibaca
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem onSelect={() => setTimeout(openLockDialog, 0)} className="gap-2.5">
              <LockKeyhole className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              Kunci aplikasi
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onLogout} className="gap-2.5 text-red-600 focus:text-red-600">
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Dialog milik sub-menu Obrolan (mobile/tablet) — sengaja di LUAR
          dropdown agar tetap terpasang ketika menu tertutup. */}
      {obrolanDialogs}

      {/* Dialog: Kamera — pilih pengguna daring untuk video call nyata */}
      <Dialog open={camOpen} onOpenChange={setCamOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Video className="h-4 w-4 text-primary" aria-hidden="true" />
              Video Call
            </DialogTitle>
            <DialogDescription>
              Panggilan video sungguhan (WebRTC) ke pengguna IndiGoo yang sedang daring.
            </DialogDescription>
          </DialogHeader>

          <div className="wa-scrollbar max-h-72 space-y-1 overflow-y-auto" data-testid="camera-peer-list">
            {callConn !== "connected" ? (
              <p className="flex items-center gap-2 rounded-lg bg-secondary/60 px-3 py-4 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" aria-hidden="true" />
                Menyambungkan ke layanan realtime…
              </p>
            ) : callPeers.length === 0 ? (
              <p className="rounded-lg bg-secondary/60 px-3 py-4 text-xs leading-relaxed text-muted-foreground">
                Belum ada pengguna lain yang daring. Masuk dengan akun lain di perangkat/tab lain, lalu pengguna itu
                akan muncul di sini dan bisa dipanggil lewat kamera.
              </p>
            ) : (
              callPeers.map((p) => (
                <div
                  key={p.userId}
                  className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-secondary/50"
                >
                  <span className="relative shrink-0">
                    <span
                      aria-hidden="true"
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-maroon-500/15 text-xs font-bold text-maroon-700 dark:text-maroon-300"
                    >
                      {getInitials(p.username)}
                    </span>
                    <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-maroon-500" aria-label="daring" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{p.username}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {p.accessId} · {roleLabelId(p.role)}
                    </span>
                  </span>
                  <Button
                    size="sm"
                    className="h-8 shrink-0 gap-1.5 rounded-full"
                    disabled={callBusy}
                    onClick={() => startVideo(p)}
                  >
                    <Video className="h-3.5 w-3.5" aria-hidden="true" />
                    Panggil
                  </Button>
                </div>
              ))
            )}
          </div>

          <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Butuh izin kamera &amp; mikrofon browser. Di panel preview (iframe), uji paling baik lewat
            "Open in New Tab".
          </p>
        </DialogContent>
      </Dialog>

      {/* Dialog: Kunci aplikasi */}
      <Dialog open={lockOpen} onOpenChange={setLockOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LockKeyhole className="h-4 w-4" aria-hidden="true" />
              Kunci aplikasi
            </DialogTitle>
            <DialogDescription>
              Amankan IndiGoo dengan PIN. Saat aktif, PIN diminta setiap aplikasi dibuka di perangkat ini.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <Label htmlFor="kunci-switch" className="text-sm font-normal">
                Aktifkan kunci aplikasi
              </Label>
              <Switch id="kunci-switch" checked={lockEnabled} onCheckedChange={setLockEnabled} />
            </div>
            {lockEnabled && (
              <div className="space-y-1.5">
                <Label htmlFor="kunci-pin">PIN (4–6 digit)</Label>
                <Input
                  id="kunci-pin"
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="••••"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                />
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={lockNow} className="mr-auto gap-1.5">
              <Settings2 className="h-4 w-4" aria-hidden="true" />
              Kunci sekarang
            </Button>
            <Button variant="ghost" onClick={() => setLockOpen(false)}>
              Batal
            </Button>
            <Button onClick={saveLock}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
}
