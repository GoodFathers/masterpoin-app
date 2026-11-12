"use client";

import { useState } from "react";
import {
  BellOff,
  BellRing,
  ChevronRight,
  CircleSlash,
  CircleUserRound,
  Download,
  Eraser,
  Flag,
  Heart,
  MoreVertical,
  Palette,
  Pin,
  Search,
  SquareCheckBig,
  Timer,
  Trash2,
  Users,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { cn, getInitials } from "@/lib/wa-utils";
import { CHAT_UI_EVENTS, useChatUi } from "@/store/chat-ui";
import ChatAvatar from "@/components/chat/ChatAvatar";

/**
 * Isi menu titik-tiga obrolan (Gambar 1) sebagai HOOK yang dapat dipakai ulang:
 * - menuItems : daftar DropdownMenuItem (tanpa pemicu) — tempel di dalam
 *               DropdownMenuContent / DropdownMenuSubContent mana pun.
 * - dialogs   : semua dialog (Info kontak, Pesan sementara, Tema obrolan,
 *               konfirmasi) — render di LUAR menu agar tetap terpasang
 *               ketika dropdown tertutup.
 * - resetInline : menciutkan kembali bagian yang dibuka pada mode inline.
 *
 * Opsi `inlineSubs: true` (dipakai TopBar untuk mobile/tablet): sub-menu
 * MELAYANG diganti bagian yang bisa dibuka-tutup DI DALAM menu yang sama —
 * pada layar sempit sub-menu melayang pernah terposisi keluar layar sehingga
 * isinya tidak terbaca. Desktop (≥lg) tetap memakai sub-menu melayang.
 *
 * Dipakai oleh ObrolanMenu (menu mandiri, desktop ≥lg) dan TopBar
 * (bagian "Menu Obrolan" pada titik-3 kanan untuk mobile/tablet).
 */
const FAV_KEY = "indigoo:fav-chats";
const WALLPAPER_KEY = "indigoo:wallpaper";
const ephemeralKey = (chatId: string) => `indigoo:ephemeral:${chatId}`;

const EPHEMERAL_OPTIONS = [
  { id: "off", label: "Matikan" },
  { id: "24h", label: "24 jam" },
  { id: "7d", label: "7 hari" },
  { id: "90d", label: "90 hari" },
];

const WALLPAPERS = [
  { id: "", label: "Bawaan", color: "" },
  { id: "#fbecee", label: "Maroon Lembut", color: "#fbecee" },
  { id: "#fbf3e2", label: "Krem Hangat", color: "#fbf3e2" },
  { id: "#fcecea", label: "Rose Lembut", color: "#fcecea" },
  { id: "#f3e6e8", label: "Maroon Abu", color: "#f3e6e8" },
  { id: "#2a1a1e", label: "Maroon Gelap", color: "#2a1a1e" },
];

type ConfirmKind = "report" | "block" | "clear" | "delete";

function readFavs(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(FAV_KEY) ?? "[]");
    return Array.isArray(raw) ? (raw as string[]) : [];
  } catch {
    return [];
  }
}

function readEphemeral(chatId: string): string {
  return localStorage.getItem(ephemeralKey(chatId)) ?? "off";
}

export function useObrolanMenu(onGoToChats: () => void, opts?: { inlineSubs?: boolean }) {
  const inlineSubs = opts?.inlineSubs ?? false;
  const { toast } = useToast();
  const chat = useChatUi((s) => s.activeChat);
  const setActiveChat = useChatUi((s) => s.setActiveChat);

  const [infoOpen, setInfoOpen] = useState(false);
  const [muteOpen, setMuteOpen] = useState(false);
  const [ephOpen, setEphOpen] = useState(false);
  const [ephValue, setEphValue] = useState("off");
  const [themeOpen, setThemeOpen] = useState(false);
  const [wallpaper, setWallpaper] = useState("");
  const [confirmKind, setConfirmKind] = useState<ConfirmKind | null>(null);
  const [busy, setBusy] = useState(false);
  const [, setFavTick] = useState(0);

  const isGroup = chat?.type === "GROUP";
  const isFav = typeof window !== "undefined" && chat ? readFavs().includes(chat.id) : false;

  const needChat = () =>
    toast({
      title: "Belum ada obrolan aktif",
      description: "Buka salah satu chat terlebih dahulu untuk memakai menu ini.",
    });

  /** PATCH properti chat + sinkronkan store & daftar chat. */
  const patchChat = async (patch: Record<string, unknown>, successTitle: string) => {
    if (!chat) return;
    try {
      const res = await fetch(`/api/chats/${chat.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error();
      const data = (await res.json().catch(() => null)) as { chat?: typeof chat } | null;
      if (data?.chat) setActiveChat(data.chat);
      window.dispatchEvent(new CustomEvent(CHAT_UI_EVENTS.chatsRefresh));
      toast({ title: successTitle });
    } catch {
      toast({ title: "Gagal memperbarui obrolan", variant: "destructive" });
    }
  };

  const toggleFavorite = () => {
    if (!chat) return needChat();
    const favs = readFavs();
    const next = favs.includes(chat.id) ? favs.filter((id) => id !== chat.id) : [...favs, chat.id];
    localStorage.setItem(FAV_KEY, JSON.stringify(next));
    setFavTick((t) => t + 1);
    toast({
      title: favs.includes(chat.id) ? "Dihapus dari favorit" : "Ditambahkan ke favorit",
      description: chat.name,
    });
  };

  const focusSearch = () => {
    onGoToChats();
    // Tunggu Radix selesai mengembalikan fokus ke trigger, baru fokuskan kolom pencarian
    window.setTimeout(() => window.dispatchEvent(new CustomEvent(CHAT_UI_EVENTS.focusSearch)), 350);
  };

  const closeChat = () => {
    if (!chat) return needChat();
    setActiveChat(null);
    window.dispatchEvent(new CustomEvent(CHAT_UI_EVENTS.closeActiveChat));
    onGoToChats();
    toast({ title: "Obrolan ditutup", description: chat.name });
  };

  const exportChat = async () => {
    if (!chat) return needChat();
    try {
      const res = await fetch(`/api/chats/${chat.id}/messages?all=1`, { cache: "no-store" });
      const data = (await res.json()) as {
        messages?: { createdAt: string; sender: string; senderName?: string; type: string; body: string }[];
      };
      const msgs = data.messages ?? [];
      const lines = [
        `Ekspor Obrolan IndiGoo — ${chat.name}`,
        `Diekspor: ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB`,
        `Jumlah pesan: ${msgs.length}`,
        "",
      ];
      for (const m of msgs) {
        const who = m.sender === "me" ? "Anda" : m.sender === "system" ? "Sistem" : m.senderName || chat.name;
        lines.push(`[${new Date(m.createdAt).toLocaleString("id-ID")}] ${who}: ${m.body || `[${m.type}]`}`);
      }
      const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `IndiGoo-Obrolan-${chat.name.replace(/[^\w-]+/g, "_")}.txt`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast({ title: "Obrolan diekspor", description: "Berkas .txt berhasil diunduh." });
    } catch {
      toast({ title: "Gagal mengekspor obrolan", variant: "destructive" });
    }
  };

  const applyWallpaper = (id: string) => {
    setWallpaper(id);
    localStorage.setItem(WALLPAPER_KEY, id);
    window.dispatchEvent(new CustomEvent(CHAT_UI_EVENTS.wallpaperChanged, { detail: { id } }));
  };

  const saveEphemeral = () => {
    if (!chat) return;
    localStorage.setItem(ephemeralKey(chat.id), ephValue);
    const label = EPHEMERAL_OPTIONS.find((o) => o.id === ephValue)?.label ?? ephValue;
    toast({ title: "Pesan sementara", description: `Timer: ${label}` });
    setEphOpen(false);
  };

  const toggleBlock = async () => {
    if (!chat?.contact) return;
    const blocked = !chat.contact.blocked;
    setBusy(true);
    try {
      const res = await fetch(`/api/contacts/${chat.contact.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocked }),
      });
      if (!res.ok) throw new Error();
      setActiveChat({ ...chat, contact: { ...chat.contact, blocked } });
      window.dispatchEvent(new CustomEvent(CHAT_UI_EVENTS.chatsRefresh));
      toast({
        title: blocked ? "Kontak diblokir" : "Blokir dibuka",
        description: chat.contact.name,
      });
    } catch {
      toast({ title: "Gagal memperbarui blokir", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const clearChat = async () => {
    if (!chat) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/chats/${chat.id}/messages`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      window.dispatchEvent(new CustomEvent(CHAT_UI_EVENTS.chatCleared, { detail: { chatId: chat.id } }));
      window.dispatchEvent(new CustomEvent(CHAT_UI_EVENTS.chatsRefresh));
      toast({ title: "Obrolan dibersihkan", description: "Semua pesan telah dihapus." });
    } catch {
      toast({ title: "Gagal membersihkan obrolan", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const deleteChat = async () => {
    if (!chat) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/chats/${chat.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setActiveChat(null);
      window.dispatchEvent(new CustomEvent(CHAT_UI_EVENTS.closeActiveChat));
      window.dispatchEvent(new CustomEvent(CHAT_UI_EVENTS.chatsRefresh));
      toast({ title: "Obrolan dihapus", description: chat.name });
    } catch {
      toast({ title: "Gagal menghapus obrolan", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const memberCount = (() => {
    if (!chat || chat.type !== "GROUP") return 0;
    try {
      const members = JSON.parse(chat.members) as unknown[];
      return Array.isArray(members) ? members.length : 0;
    } catch {
      return 0;
    }
  })();

  const confirmCopy: Record<ConfirmKind, { title: string; desc: string; action: string }> = {
    report: {
      title: "Laporkan kontak ini?",
      desc: `Laporan tentang ${chat?.name ?? "kontak ini"} akan dikirim ke IndiGoo. Pesan terbaru akan diteruskan untuk ditinjau.`,
      action: "Laporkan",
    },
    block: {
      title: chat?.contact?.blocked ? "Buka blokir kontak?" : "Blokir kontak ini?",
      desc: chat?.contact?.blocked
        ? `${chat?.name ?? "Kontak"} akan dapat mengirim pesan dan panggilan lagi.`
        : `${chat?.name ?? "Kontak"} tidak akan bisa mengirim pesan ke Anda lagi.`,
      action: chat?.contact?.blocked ? "Buka blokir" : "Blokir",
    },
    clear: {
      title: "Bersihkan obrolan ini?",
      desc: `Semua pesan dengan ${chat?.name ?? "kontak ini"} akan dihapus permanen, namun obrolannya tetap ada di daftar chat.`,
      action: "Bersihkan",
    },
    delete: {
      title: "Hapus obrolan ini?",
      desc: `Obrolan dengan ${chat?.name ?? "kontak ini"} beserta seluruh pesan di dalamnya akan dihapus permanen. Tindakan ini tidak bisa dibatalkan.`,
      action: "Hapus",
    },
  };

  const runConfirm = async () => {
    if (!confirmKind) return;
    if (confirmKind === "report") {
      toast({ title: "Laporan terkirim", description: "Terima kasih, laporan Anda akan ditinjau." });
    } else if (confirmKind === "block") {
      await toggleBlock();
    } else if (confirmKind === "clear") {
      await clearChat();
    } else {
      await deleteChat();
    }
    setConfirmKind(null);
  };

  // ---------- Bagian "Bisukan notifikasi" ----------
  // Pilihan bisukan dipisah agar bisa tampil sebagai sub-menu melayang
  // (desktop) ATAU bagian inline yang bisa dibuka (mobile/tablet).
  const muteOptions = (
    <>
      {chat?.muted && (
        <DropdownMenuItem onSelect={() => patchChat({ muted: false }, "Notifikasi dinyalakan")} className="gap-2">
          <BellRing className="h-4 w-4 text-muted-foreground" /> Bunyikan notifikasi
        </DropdownMenuItem>
      )}
      <DropdownMenuItem onSelect={() => (chat ? patchChat({ muted: true }, "Notifikasi dibisukan (8 jam)") : needChat())}>
        8 jam
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={() => (chat ? patchChat({ muted: true }, "Notifikasi dibisukan (1 minggu)") : needChat())}>
        1 minggu
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={() => (chat ? patchChat({ muted: true }, "Notifikasi dibisukan (selalu)") : needChat())}>
        Selalu
      </DropdownMenuItem>
    </>
  );

  const muteSection = inlineSubs ? (
    <>
      <DropdownMenuItem
        onSelect={(e) => {
          e.preventDefault();
          setMuteOpen((v) => !v);
        }}
        aria-expanded={muteOpen}
        className="gap-2.5"
      >
        <BellOff className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        Bisukan notifikasi
        <ChevronRight
          className={cn("ml-auto h-4 w-4 text-muted-foreground transition-transform", muteOpen && "rotate-90")}
          aria-hidden="true"
        />
      </DropdownMenuItem>
      {muteOpen && <div className="pl-6">{muteOptions}</div>}
    </>
  ) : (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="gap-2.5">
        <BellOff className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        Bisukan notifikasi
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-48">{muteOptions}</DropdownMenuSubContent>
    </DropdownMenuSub>
  );

  const menuItems = (
    <>
          <DropdownMenuItem onSelect={() => (chat ? setTimeout(() => setInfoOpen(true), 0) : needChat())} className="gap-2.5">
            <CircleUserRound className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            Info kontak
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={focusSearch} className="gap-2.5">
            <Search className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            Cari
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              if (!chat) return needChat();
              onGoToChats();
              toast({ title: "Pilih pesan", description: "Arahkan kursor ke pesan lalu klik ikon hapus untuk memilihnya." });
            }}
            className="gap-2.5"
          >
            <SquareCheckBig className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            Pilih pesan
          </DropdownMenuItem>

          {muteSection}

          <DropdownMenuItem
            onSelect={() => {
              if (!chat) return needChat();
              setEphValue(readEphemeral(chat.id));
              setTimeout(() => setEphOpen(true), 0);
            }}
            className="gap-2.5"
          >
            <Timer className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            Pesan sementara
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              setWallpaper(localStorage.getItem(WALLPAPER_KEY) ?? "");
              setTimeout(() => setThemeOpen(true), 0);
            }}
            className="gap-2.5"
          >
            <Palette className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            Tema obrolan
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={toggleFavorite} className="gap-2.5">
            <Heart className={cn("h-4 w-4", isFav ? "fill-red-500 text-red-500" : "text-muted-foreground")} aria-hidden="true" />
            {isFav ? "Hapus dari favorit" : "Tambah ke favorit"}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => (chat ? patchChat({ pinned: !chat.pinned }, chat.pinned ? "Lepas dari daftar" : "Ditambat ke daftar") : needChat())}
            className="gap-2.5"
          >
            <Pin className={cn("h-4 w-4", chat?.pinned ? "text-primary" : "text-muted-foreground")} aria-hidden="true" />
            {chat?.pinned ? "Lepas dari daftar" : "Tambat ke daftar"}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={exportChat} className="gap-2.5">
            <Download className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            Ekspor obrolan
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={closeChat} className="gap-2.5">
            <XCircle className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            Tutup obrolan
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem onSelect={() => (chat ? setTimeout(() => setConfirmKind("report"), 0) : needChat())} className="gap-2.5">
            <Flag className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            Laporkan
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              if (!chat) return needChat();
              if (isGroup) {
                toast({ title: "Blokir hanya untuk chat pribadi" });
                return;
              }
              setTimeout(() => setConfirmKind("block"), 0);
            }}
            className="gap-2.5"
          >
            <CircleSlash className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            {chat?.contact?.blocked ? "Buka blokir" : "Blokir"}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => (chat ? setTimeout(() => setConfirmKind("clear"), 0) : needChat())} className="gap-2.5">
            <Eraser className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            Bersihkan obrolan
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => (chat ? setTimeout(() => setConfirmKind("delete"), 0) : needChat())}
            className="gap-2.5 text-red-600 focus:text-red-600"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Hapus obrolan
          </DropdownMenuItem>
    </>
  );

  const dialogs = (
    <>
      {/* Dialog: Info kontak */}
      <Dialog open={infoOpen} onOpenChange={setInfoOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{isGroup ? "Info grup" : "Info kontak"}</DialogTitle>
            <DialogDescription>Data obrolan yang sedang aktif.</DialogDescription>
          </DialogHeader>
          {chat && (
            <div className="flex flex-col items-center gap-3 py-2 text-center">
              <ChatAvatar name={chat.name} colorKey={chat.colorKey} avatarUrl={chat.avatarUrl} className="h-20 w-20 text-xl" />
              <div>
                <p className="text-lg font-bold leading-tight">{chat.name}</p>
                {chat.isBusinessChat && (
                  <span className="mt-1 inline-block rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                    Bisnis
                  </span>
                )}
              </div>
              {isGroup ? (
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" aria-hidden="true" />
                  {memberCount} anggota
                </p>
              ) : (
                <div className="w-full space-y-1.5 rounded-lg bg-secondary/60 p-3 text-left text-sm">
                  <p className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Nomor</span>
                    <span className="font-medium">{chat.contact?.phone ?? "—"}</span>
                  </p>
                  <p className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Tentang</span>
                    <span className="max-w-[60%] truncate font-medium">{chat.contact?.about || "—"}</span>
                  </p>
                  <p className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Status</span>
                    <span className={cn("font-medium", chat.contact?.blocked && "text-red-600")}>
                      {chat.contact?.blocked ? "Diblokir" : "Aktif"}
                    </span>
                  </p>
                </div>
              )}
              {!isGroup && chat.contact && (
                <p className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  {getInitials(chat.contact.name)}
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: Pesan sementara */}
      <Dialog open={ephOpen} onOpenChange={setEphOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Pesan sementara</DialogTitle>
            <DialogDescription>
              Aktifkan timer agar pesan baru di obrolan ini terhapus otomatis setelah jangka waktu tertentu.
            </DialogDescription>
          </DialogHeader>
          <RadioGroup value={ephValue} onValueChange={setEphValue} className="gap-2">
            {EPHEMERAL_OPTIONS.map((opt) => (
              <Label
                key={opt.id}
                htmlFor={`eph-${opt.id}`}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 text-sm font-normal hover:bg-secondary/60"
              >
                <RadioGroupItem value={opt.id} id={`eph-${opt.id}`} />
                {opt.label}
              </Label>
            ))}
          </RadioGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEphOpen(false)}>
              Batal
            </Button>
            <Button onClick={saveEphemeral}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Tema obrolan */}
      <Dialog open={themeOpen} onOpenChange={setThemeOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Tema obrolan</DialogTitle>
            <DialogDescription>Pilih warna latar area percakapan.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-2">
            {WALLPAPERS.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => applyWallpaper(w.id)}
                aria-label={`Tema ${w.label}`}
                aria-pressed={wallpaper === w.id}
                className={cn(
                  "flex h-20 flex-col items-center justify-end gap-1 rounded-xl border-2 p-1.5 text-[10px] font-medium transition-all",
                  wallpaper === w.id ? "border-primary ring-2 ring-primary/25" : "border-border hover:border-primary/40"
                )}
                style={{ backgroundColor: w.color || undefined }}
              >
                {!w.color && <span className="wa-chat-bg h-full w-full rounded-lg" aria-hidden="true" />}
                <span className={cn("rounded bg-black/5 px-1", w.color === "#2a1a1e" && "bg-white/20 text-white")}>{w.label}</span>
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={() => setThemeOpen(false)}>Selesai</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog konfirmasi: Laporkan / Blokir / Bersihkan / Hapus */}
      <AlertDialog open={confirmKind !== null} onOpenChange={(open) => !open && setConfirmKind(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmKind ? confirmCopy[confirmKind].title : ""}</AlertDialogTitle>
            <AlertDialogDescription>{confirmKind ? confirmCopy[confirmKind].desc : ""}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Batal</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                void runConfirm();
              }}
              className={cn(
                confirmKind === "delete" || confirmKind === "clear"
                  ? "bg-destructive text-white hover:bg-destructive/90"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              )}
            >
              {confirmKind ? confirmCopy[confirmKind].action : "OK"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );

  return { menuItems, dialogs, resetInline: () => setMuteOpen(false) };
}

/**
 * Menu titik-tiga obrolan MANDIRI (trigger + isi + dialog).
 * Dipasang di tepi panel daftar chat pada desktop (≥lg) — Gambar 1.
 * Desktop selalu memakai sub-menu melayang (ruang layar cukup).
 */
export default function ObrolanMenu({ onGoToChats }: { onGoToChats: () => void }) {
  const { menuItems, dialogs } = useObrolanMenu(onGoToChats);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Menu obrolan" className="h-9 w-9 shrink-0">
            <MoreVertical className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={6} className="w-64 max-h-[75vh] overflow-y-auto wa-scrollbar">
          {menuItems}
        </DropdownMenuContent>
      </DropdownMenu>
      {dialogs}
    </>
  );
}
