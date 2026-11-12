"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  BellOff,
  Bookmark,
  CheckCheck,
  ClipboardList,
  LayoutGrid,
  Lock,
  LogOut,
  Mail,
  Megaphone,
  MessageSquarePlus,
  MoreVertical,
  Pin,
  PinOff,
  RadioTower,
  Search,
  SquareCheckBig,
  Star,
  Store,
  Trash2,
  Users,
  UsersRound,
  X,
  Zap,
} from "lucide-react";
import { cn, messagePreview, waListTime } from "@/lib/wa-utils";
import { useToast } from "@/hooks/use-toast";
import { useBusinessProfile } from "@/lib/useBusinessProfile";
import { performLogout } from "@/components/extras/LogoutFlow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import type { ViewId } from "@/components/AppShell";
import ChatAvatar from "./ChatAvatar";
import { StarredMessagesDialog, ConfirmDialog } from "./ChatMenus";
import type { ChatSummary } from "./types";

export type ChatFilter = "all" | "unread" | "favorites" | "groups" | "archived";

const FILTERS: { id: ChatFilter; label: string }[] = [
  { id: "all", label: "Semua" },
  { id: "unread", label: "Belum dibaca" },
  { id: "favorites", label: "Favorit" },
  { id: "groups", label: "Grup" },
  { id: "archived", label: "Arsip" },
];

export function previewOf(chat: ChatSummary): string {
  const lm = chat.lastMessage;
  if (!lm) return "Belum ada pesan";
  if (lm.type === "SYSTEM" || lm.sender === "system") return lm.body;
  let prefix = "";
  if (lm.sender === "me") prefix = "Anda: ";
  else if (chat.type === "GROUP" && lm.senderName) prefix = `${lm.senderName}: `;
  return prefix + messagePreview(lm);
}

interface ChatListPanelProps {
  chats: ChatSummary[];
  loading: boolean;
  activeId: string | null;
  filter: ChatFilter;
  onFilterChange: (f: ChatFilter) => void;
  search: string;
  onSearchChange: (v: string) => void;
  onOpenChat: (chat: ChatSummary) => void;
  onPatchChat: (id: string, patch: Record<string, unknown>) => void;
  onDeleteChat: (id: string) => void;
  onNewChat: () => void;
  onNewGroup: () => void;
  onNavigate: (view: ViewId) => void;
  onClearAll: () => void;
}

export default function ChatListPanel({
  chats,
  loading,
  activeId,
  filter,
  onFilterChange,
  search,
  onSearchChange,
  onOpenChat,
  onPatchChat,
  onDeleteChat,
  onNewChat,
  onNewGroup,
  onNavigate,
  onClearAll,
}: ChatListPanelProps) {
  const { toast } = useToast();
  const business = useBusinessProfile();
  const [starredOpen, setStarredOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const unreadCount = chats.filter((c) => c.unread > 0).length;

  // ---------- Tandai Semua Sudah Dibaca ----------
  const markAllRead = useCallback(async () => {
    const targets = chats.filter((c) => c.unread > 0);
    if (targets.length === 0) {
      toast({ title: "Semua chat sudah dibaca" });
      return;
    }
    targets.forEach((c) => onPatchChat(c.id, { unread: 0 }));
    toast({ title: `${targets.length} chat ditandai sudah dibaca` });
  }, [chats, onPatchChat, toast]);

  // ---------- Jembatan menu ⋮ di top bar AppShell (mobile) ----------
  // Logo/judul/tombol chat/menu ⋮ panel daftar kini pindah ke top bar aplikasi;
  // aksi yang state-nya di panel ini dipicu lewat event global.
  useEffect(() => {
    const openStarred = () => setStarredOpen(true);
    const selectChats = () => {
      setSelectMode(true);
      setSelectedIds(new Set());
    };
    const markAll = () => void markAllRead();
    window.addEventListener("wa:open-starred", openStarred);
    window.addEventListener("wa:select-chats", selectChats);
    window.addEventListener("wa:mark-all-read", markAll);
    return () => {
      window.removeEventListener("wa:open-starred", openStarred);
      window.removeEventListener("wa:select-chats", selectChats);
      window.removeEventListener("wa:mark-all-read", markAll);
    };
  }, [markAllRead]);

  // ---------- Kunci aplikasi ----------
  const lockApp = () => {
    try {
      window.sessionStorage.setItem("wa_locked", "1");
    } catch {
      // abaikan
    }
    window.location.reload();
  };

  // ---------- Pilih obrolan ----------
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const bulkArchive = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    await Promise.all(
      ids.map((id) =>
        fetch(`/api/chats/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ archived: true }),
        }).catch(() => null)
      )
    );
    toast({ title: `${ids.length} chat diarsipkan` });
    exitSelectMode();
    onClearAll();
  };

  const bulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    await Promise.all(
      ids.map((id) =>
        fetch(`/api/chats/${id}`, { method: "DELETE" }).catch(() => null)
      )
    );
    toast({ title: `${ids.length} chat dihapus` });
    exitSelectMode();
    onClearAll();
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#111b21]">
      {/* Header — gaya WhatsApp Web. Mobile: logo/judul/tombol chat/menu ⋮ pindah ke top bar
          AppShell, jadi header ini hanya tampil saat mode Pilih obrolan aktif. */}
      <header className={cn("flex items-center justify-between gap-1 px-3 pt-3 pb-2 shrink-0", !selectMode && "hidden md:flex")}>
        {selectMode ? (
          <>
            <p className="text-sm font-semibold px-1" aria-live="polite">
              {selectedIds.size} dipilih
            </p>
            <div className="flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Arsipkan yang dipilih"
                onClick={() => void bulkArchive()}
                disabled={selectedIds.size === 0}
              >
                <Archive className="h-[18px] w-[18px] text-muted-foreground" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Hapus yang dipilih"
                onClick={() => void bulkDelete()}
                disabled={selectedIds.size === 0}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-[18px] w-[18px]" />
              </Button>
              <Button variant="ghost" size="icon" aria-label="Batal pilih" onClick={exitSelectMode}>
                <X className="h-[18px] w-[18px] text-muted-foreground" />
              </Button>
            </div>
          </>
        ) : (
          <>
            {/* Logo bisnis dihapus (permintaan pengguna) — judul saja, seperti WhatsApp Web */}
            <div className="hidden md:flex items-center min-w-0 pl-0.5">
              <h1 className="text-lg font-bold tracking-tight truncate">{business.businessName}</h1>
            </div>
            <div className="flex items-center gap-0.5 shrink-0 ml-auto">
              {/* Menu utama (⋮) — sesuai WhatsApp Web */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Menu utama">
                    <MoreVertical className="h-5 w-5 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  <DropdownMenuItem className="gap-2.5 cursor-pointer" onClick={() => onNavigate("business-profile")}>
                    <Store className="h-4 w-4" /> Fitur bisnis
                  </DropdownMenuItem>
                  <DropdownMenuItem className="gap-2.5 cursor-pointer" onClick={onNewGroup}>
                    <UsersRound className="h-4 w-4" /> Grup baru
                  </DropdownMenuItem>
                  <DropdownMenuItem className="gap-2.5 cursor-pointer" onClick={() => onNavigate("promotions")}>
                    <Megaphone className="h-4 w-4" /> Iklankan
                  </DropdownMenuItem>
                  <DropdownMenuItem className="gap-2.5 cursor-pointer" onClick={() => onNavigate("broadcast")}>
                    <RadioTower className="h-4 w-4" /> Siaran bisnis
                  </DropdownMenuItem>
                  <DropdownMenuItem className="gap-2.5 cursor-pointer" onClick={() => onNavigate("catalog")}>
                    <LayoutGrid className="h-4 w-4" /> Katalog
                  </DropdownMenuItem>
                  <DropdownMenuItem className="gap-2.5 cursor-pointer" onClick={() => onNavigate("catalog")}>
                    <ClipboardList className="h-4 w-4" /> Order
                  </DropdownMenuItem>
                  <DropdownMenuItem className="gap-2.5 cursor-pointer" onClick={() => onNavigate("autoreplies")}>
                    <Zap className="h-4 w-4" /> Balasan cepat
                  </DropdownMenuItem>
                  <DropdownMenuItem className="gap-2.5 cursor-pointer" onClick={() => setStarredOpen(true)}>
                    <Star className="h-4 w-4" /> Pesan berbintang
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="gap-2.5 cursor-pointer"
                    onClick={() => {
                      setSelectMode(true);
                      setSelectedIds(new Set());
                    }}
                  >
                    <SquareCheckBig className="h-4 w-4" /> Pilih obrolan
                  </DropdownMenuItem>
                  <DropdownMenuItem className="gap-2.5 cursor-pointer" onClick={() => onNavigate("labels")}>
                    <Bookmark className="h-4 w-4" /> Daftar
                  </DropdownMenuItem>
                  <DropdownMenuItem className="gap-2.5 cursor-pointer" onClick={() => void markAllRead()}>
                    <CheckCheck className="h-4 w-4" />
                    Tandai Semua Sudah Dibaca
                    {unreadCount > 0 && (
                      <span className="ml-auto text-[11px] font-semibold bg-primary text-primary-foreground rounded-full px-1.5 py-0.5">
                        {unreadCount}
                      </span>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="gap-2.5 cursor-pointer" onClick={lockApp}>
                    <Lock className="h-4 w-4" /> Kunci aplikasi
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="gap-2.5 cursor-pointer"
                    variant="destructive"
                    onClick={() => setLogoutOpen(true)}
                  >
                    <LogOut className="h-4 w-4" /> Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Chat / grup baru */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Buat chat baru" className="hidden md:inline-flex">
                    <MessageSquarePlus className="h-5 w-5 text-primary" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onClick={onNewChat} className="gap-2 cursor-pointer">
                    <UsersRound className="h-4 w-4" /> Chat Baru
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onNewGroup} className="gap-2 cursor-pointer">
                    <UsersRound className="h-4 w-4" /> Grup Baru
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </>
        )}
      </header>

      {/* Pencarian */}
      <div className="px-3 pb-2 shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Cari atau mulai obrolan baru"
            aria-label="Cari chat"
            className="pl-9 bg-secondary border-transparent h-9 rounded-lg"
          />
        </div>
      </div>

      {/* Filter chips */}
      <div className="px-3 pb-2 flex gap-1.5 overflow-x-auto wa-scrollbar shrink-0" role="tablist" aria-label="Filter daftar chat">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={filter === f.id}
            onClick={() => onFilterChange(f.id)}
            className={cn(
              "px-3 py-1 rounded-full text-[13px] whitespace-nowrap transition-colors",
              filter === f.id
                ? "bg-accent text-accent-foreground font-medium"
                : "bg-secondary text-muted-foreground hover:bg-secondary/70"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Daftar chat */}
      <div className="flex-1 overflow-y-auto wa-scrollbar min-h-0" role="list" aria-label="Daftar chat">
        {loading && (
          <div className="space-y-1 px-3 py-2" aria-hidden="true">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-2">
                <Skeleton className="h-11 w-11 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-2/3" />
                  <Skeleton className="h-3 w-4/5" />
                </div>
                <Skeleton className="h-3 w-10" />
              </div>
            ))}
          </div>
        )}

        {!loading && chats.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <Search className="h-10 w-10 text-muted-foreground/40 mb-3" aria-hidden="true" />
            <p className="text-sm font-medium">Tidak ada chat ditemukan</p>
            <p className="text-xs text-muted-foreground mt-1">
              Coba kata kunci lain atau mulai chat baru dari tombol di atas.
            </p>
          </div>
        )}

        {!loading &&
          chats.map((chat) => (
            <ChatRow
              key={chat.id}
              chat={chat}
              active={chat.id === activeId}
              selectMode={selectMode}
              selected={selectedIds.has(chat.id)}
              onToggleSelect={() => toggleSelect(chat.id)}
              onOpen={() => (selectMode ? toggleSelect(chat.id) : onOpenChat(chat))}
              onPatch={onPatchChat}
              onDelete={() => onDeleteChat(chat.id)}
            />
          ))}
      </div>

      {/* Dialog pesan berbintang */}
      <StarredMessagesDialog open={starredOpen} onOpenChange={setStarredOpen} />

      {/* Dialog logout — sama dengan alur rail/drawer */}
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

// ---------- Baris chat ----------
function ChatRow({
  chat,
  active,
  selectMode,
  selected,
  onToggleSelect,
  onOpen,
  onPatch,
  onDelete,
}: {
  chat: ChatSummary;
  active: boolean;
  selectMode: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onOpen: () => void;
  onPatch: (id: string, patch: Record<string, unknown>) => void;
  onDelete: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isSystem = chat.lastMessage?.type === "SYSTEM" || chat.lastMessage?.sender === "system";
  const preview = previewOf(chat);

  return (
    <div role="listitem" className="border-b border-border/60 last:border-b-0">
      <div
        className={cn(
          "group flex items-center gap-2 pl-3 pr-1.5 py-2.5 cursor-pointer transition-colors",
          active ? "bg-accent" : "hover:bg-secondary"
        )}
      >
        {selectMode && (
          <Checkbox
            checked={selected}
            onCheckedChange={onToggleSelect}
            aria-label={`Pilih chat ${chat.name}`}
            className="shrink-0"
          />
        )}
        <button
          type="button"
          onClick={onOpen}
          className="flex items-center gap-3 flex-1 min-w-0 text-left"
          aria-label={`Buka chat ${chat.name}`}
        >
          <div className="relative shrink-0">
            <ChatAvatar name={chat.name} colorKey={chat.colorKey} avatarUrl={chat.avatarUrl} className="h-11 w-11" />
            {chat.type === "GROUP" && (
              <span className="absolute -bottom-0.5 -right-0.5 h-[18px] w-[18px] rounded-full bg-white flex items-center justify-center shadow">
                <Users className="h-2.5 w-2.5 text-muted-foreground" aria-hidden="true" />
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-[15px] font-medium truncate">{chat.name}</p>
              {chat.isBusinessChat && (
                <span className="text-[9px] uppercase tracking-wide bg-primary/10 text-primary font-bold px-1.5 py-0.5 rounded shrink-0">
                  Bisnis
                </span>
              )}
              {chat.favorite && (
                <Star className="h-3 w-3 text-amber-500 fill-amber-500 shrink-0" aria-label="Favorit" />
              )}
            </div>
            <p className={cn("text-[13px] truncate", isSystem ? "italic text-muted-foreground" : "text-muted-foreground")}>
              {preview}
            </p>
          </div>
        </button>

        <div className="flex flex-col items-end gap-1 shrink-0 w-14">
          <span className="text-[11px] text-muted-foreground">
            {chat.lastMessage ? waListTime(chat.lastMessage.createdAt) : waListTime(chat.lastMessageAt)}
          </span>
          <div className="flex items-center gap-1">
            {chat.muted && <BellOff className="h-3.5 w-3.5 text-muted-foreground" aria-label="Dibisukan" />}
            {chat.pinned && <Pin className="h-3.5 w-3.5 text-muted-foreground" aria-label="Disematkan" />}
            {chat.unread > 0 && (
              <span
                className="min-w-[20px] h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold flex items-center justify-center"
                aria-label={`${chat.unread} pesan belum dibaca`}
              >
                {chat.unread}
              </span>
            )}
          </div>
        </div>

        {!selectMode && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={`Menu chat ${chat.name}`}
                className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-black/10 transition-all shrink-0"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => onPatch(chat.id, { pinned: !chat.pinned })} className="gap-2 cursor-pointer">
                {chat.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                {chat.pinned ? "Buka pin" : "Sematkan chat"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onPatch(chat.id, { archived: !chat.archived })} className="gap-2 cursor-pointer">
                {chat.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                {chat.archived ? "Keluarkan dari arsip" : "Arsipkan chat"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onPatch(chat.id, { muted: !chat.muted })} className="gap-2 cursor-pointer">
                <BellOff className="h-4 w-4" />
                {chat.muted ? "Bunyikan notifikasi" : "Bisukan notifikasi"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onPatch(chat.id, { favorite: !chat.favorite })} className="gap-2 cursor-pointer">
                <Star className={cn("h-4 w-4", chat.favorite && "text-amber-500 fill-amber-500")} />
                {chat.favorite ? "Hapus dari favorit" : "Tambah ke favorit"}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onPatch(chat.id, { unread: chat.unread > 0 ? 0 : 1 })}
                className="gap-2 cursor-pointer"
              >
                {chat.unread > 0 ? <CheckCheck className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
                {chat.unread > 0 ? "Tandai sudah dibaca" : "Tandai belum dibaca"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => setConfirmDelete(true)}
                className="gap-2 cursor-pointer"
              >
                <Trash2 className="h-4 w-4" /> Hapus chat
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus chat ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Chat dengan <span className="font-medium">{chat.name}</span> beserta seluruh pesan di dalamnya akan
              dihapus permanen. Tindakan ini tidak bisa dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmDelete(false);
                onDelete();
              }}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
