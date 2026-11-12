"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Ban,
  Bookmark,
  ChevronDown,
  CircleSlash,
  Download,
  Eraser,
  Heart,
  Info,
  ListChecks,
  Loader2,
  MessageSquareWarning,
  MessageSquareX,
  Palette,
  Phone,
  Search,
  ShieldCheck,
  SquareCheckBig,
  Timer,
  Trash2,
  UserRoundPlus,
  Video,
  X,
} from "lucide-react";
import { cn, timeAgo, waDayLabel, formatTime } from "@/lib/wa-utils";
import { useToast } from "@/hooks/use-toast";
import { useBusinessProfile } from "@/lib/useBusinessProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
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
import MessageBubble from "./MessageBubble";
import Composer from "./Composer";
import CallDialog from "./CallDialog";
import ChatInfoSheet from "./ChatInfoSheet";
import ChatAvatar from "./ChatAvatar";
import {
  ConfirmDialog,
  DisappearingDialog,
  LabelsPickDialog,
  ChatThemeDialog,
  themeBg,
} from "./ChatMenus";
import type { ChatMessage, ChatSummary, Participant, ProductRow } from "./types";
import {
  getRealtimeSocket,
  setActiveChatId,
  type ChatMessagePush,
  type ChatStatusPush,
  type ChatMessageDeletedPush,
  type ChatUpdatePush,
} from "@/lib/realtime";

interface ConversationPanelProps {
  chat: ChatSummary;
  onBack: () => void;
  onChatUpdated: () => void;
  /** Batch 5: klik kartu produk di bubble → fokuskan di marketplace. */
  onOpenProduct?: (productId?: string) => void;
}

const MEDIA_TYPES = ["IMAGE", "VIDEO", "AUDIO", "DOC"];

const PAGE_SIZE = 60; // pesan termuat per jendela (paginasi Batch 4)

const DISAPPEARING_LABEL: Record<string, string> = {
  off: "",
  "24h": "24 jam",
  "7d": "7 hari",
  "90d": "90 hari",
};

export default function ConversationPanel({ chat, onBack, onChatUpdated, onOpenProduct }: ConversationPanelProps) {
  const { toast } = useToast();
  const business = useBusinessProfile();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const loadingOlderRef = useRef(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [callKind, setCallKind] = useState<"VOICE" | "VIDEO" | null>(null);
  const [productsMap, setProductsMap] = useState<Map<string, ProductRow>>(new Map());

  // ---------- Fitur menu baru ----------
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectMode, setSelectMode] = useState(false);
  const [selectedMsgIds, setSelectedMsgIds] = useState<Set<string>>(new Set());
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [disappearingOpen, setDisappearingOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [themeCss, setThemeCss] = useState("");
  const [contactEditOpen, setContactEditOpen] = useState(false);
  const [contactName, setContactName] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [reportBlock, setReportBlock] = useState(true);
  const [blockOpen, setBlockOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const atBottomRef = useRef(true);
  // Ref pesan terkini untuk dipakai di dalam listener socket (tanpa re-subscribe)
  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;

  // ---------- Muat pesan (paginasi Batch 4) ----------
  // Muat jendela TERBARU (60 pesan). Riwayat lebih lama dimuat bertahap saat
  // gulir ke atas (loadOlder), sinkronisasi berkala hanya ambil pesan baru
  // (syncTail) — tidak lagi mengunduh seluruh isi obrolan tiap kali.
  const loadMessages = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const res = await fetch(`/api/chats/${chat.id}/messages?limit=${PAGE_SIZE}`, { cache: "no-store" });
        const data = (await res.json()) as {
          messages?: ChatMessage[];
          participants?: Participant[];
          hasMore?: boolean;
          error?: string;
        };
        if (res.ok) {
          setMessages(data.messages ?? []);
          setHasMore(!!data.hasMore);
          if (data.participants) setParticipants(data.participants);
        }
      } catch {
        if (!silent) toast({ title: "Gagal memuat pesan", variant: "destructive" });
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [chat.id, toast]
  );

  // ---------- Sinkron ekor: hanya pesan yang lebih baru dari yang sudah termuat ----------
  const syncTail = useCallback(async () => {
    const current = messagesRef.current;
    const lastReal = [...current].reverse().find((m) => !m.id.startsWith("tmp-"));
    if (!lastReal) {
      void loadMessages();
      return;
    }
    try {
      const res = await fetch(
        `/api/chats/${chat.id}/messages?after=${encodeURIComponent(lastReal.createdAt)}`,
        { cache: "no-store" }
      );
      const data = (await res.json()) as { messages?: ChatMessage[] };
      if (!res.ok || !data.messages?.length) return;
      setMessages((prev) => {
        const known = new Set(prev.map((m) => m.id));
        const fresh = data.messages!.filter((m) => !known.has(m.id));
        return fresh.length ? [...prev, ...fresh] : prev;
      });
    } catch {
      // fallback senyap — polling berikutnya mencoba lagi
    }
  }, [chat.id, loadMessages]);

  // ---------- Muat riwayat lebih lama saat gulir ke atas ----------
  const loadOlder = useCallback(async () => {
    if (loadingOlderRef.current) return;
    const oldest = messagesRef.current.find((m) => !m.id.startsWith("tmp-"));
    if (!oldest) return;
    loadingOlderRef.current = true;
    setLoadingOlder(true);
    const el = scrollRef.current;
    const prevHeight = el?.scrollHeight ?? 0;
    const prevTop = el?.scrollTop ?? 0;
    try {
      const res = await fetch(
        `/api/chats/${chat.id}/messages?before=${encodeURIComponent(oldest.createdAt)}&limit=${PAGE_SIZE}`,
        { cache: "no-store" }
      );
      const data = (await res.json()) as { messages?: ChatMessage[]; hasMore?: boolean };
      if (res.ok) {
        setHasMore(!!data.hasMore);
        if (data.messages?.length) {
          setMessages((prev) => {
            const known = new Set(prev.map((m) => m.id));
            const older = data.messages!.filter((m) => !known.has(m.id));
            if (!older.length) return prev;
            return [...older, ...prev];
          });
          // Pertahankan posisi gulir setelah riwayat lama disisipkan di atas
          requestAnimationFrame(() => {
            const el2 = scrollRef.current;
            if (el2) el2.scrollTop = el2.scrollHeight - prevHeight + prevTop;
          });
        }
      }
    } catch {
      // senyap — pengguna bisa mencoba gulir lagi
    } finally {
      loadingOlderRef.current = false;
      setLoadingOlder(false);
    }
  }, [chat.id]);

  useEffect(() => {
    atBottomRef.current = true;
    void loadMessages();
  }, [loadMessages]);

  // Tema latar tersimpan per chat
  useEffect(() => {
    setThemeCss(themeBg(chat.id));
    setSearchOpen(false);
    setSearchQuery("");
    exitSelect();
  }, [chat.id]);

  function exitSelect() {
    setSelectMode(false);
    setSelectedMsgIds(new Set());
  }

  // Tandai sudah dibaca saat chat dibuka & saat pesan baru masuk ke chat
  // yang sedang terbuka (unread dinaikkan server saat balasan kontak masuk)
  useEffect(() => {
    if (chat.unread > 0) {
      void fetch(`/api/chats/${chat.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unread: 0 }),
      }).then(() => onChatUpdated());
    }
  }, [chat.id, chat.unread]);

  // Daftarkan chat aktif global — NotificationCenter melewatkan notifikasi
  // untuk chat yang sedang terbuka di tab ini.
  useEffect(() => {
    setActiveChatId(chat.id);
    return () => setActiveChatId(null);
  }, [chat.id]);

  // Polling pesan setiap 15 detik (dilewati saat ada pesan optimist) —
  // fallback bila push realtime gagal/terputus. Hanya mengambil pesan BARU,
  // bukan seluruh obrolan (Batch 4).
  useEffect(() => {
    const t = setInterval(() => {
      const hasPending = messagesRef.current.some((m) => m.id.startsWith("tmp-"));
      if (!hasPending) void syncTail();
    }, 15_000);
    return () => clearInterval(t);
  }, [syncTail]);

  // ---------- Realtime (Batch 2): push socket.io ----------
  // Pesan masuk, status centang (DELIVERED/READ), hapus pesan, dan sinkron
  // isi obrolan dari tab/perangkat lain — tanpa menunggu polling.
  useEffect(() => {
    const s = getRealtimeSocket();

    const onMessage = (p: ChatMessagePush) => {
      if (!p || p.chatId !== chat.id || !p.message) return;
      setMessages((prev) =>
        prev.some((m) => m.id === p.message.id) ? prev : [...prev, p.message]
      );
      if (p.message.sender !== "me") atBottomRef.current = true;
    };

    const onStatus = (p: ChatStatusPush) => {
      if (!p || p.chatId !== chat.id) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.sender === "me" && !m.id.startsWith("tmp-") ? { ...m, status: p.status } : m
        )
      );
    };

    const onMessageDeleted = (p: ChatMessageDeletedPush) => {
      if (!p || p.chatId !== chat.id) return;
      setMessages((prev) => prev.filter((m) => m.id !== p.messageId));
    };

    const onUpdate = (p: ChatUpdatePush) => {
      if (!p || p.chatId !== chat.id) return;
      const hasPending = messagesRef.current.some((m) => m.id.startsWith("tmp-"));
      if (!hasPending) void syncTail();
    };

    s.on("chat:message", onMessage);
    s.on("chat:status", onStatus);
    s.on("chat:message-deleted", onMessageDeleted);
    s.on("chat:update", onUpdate);
    return () => {
      s.off("chat:message", onMessage);
      s.off("chat:status", onStatus);
      s.off("chat:message-deleted", onMessageDeleted);
      s.off("chat:update", onUpdate);
    };
  }, [chat.id, syncTail]);

  // Auto-scroll ke bawah
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const last = messages[messages.length - 1];
    if (atBottomRef.current || last?.sender === "me") {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  // Data produk untuk kartu PRODUCT
  useEffect(() => {
    if (productsMap.size > 0) return;
    if (!messages.some((m) => m.type === "PRODUCT")) return;
    fetch("/api/products", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { products?: ProductRow[] }) => {
        setProductsMap(new Map((d.products ?? []).map((p) => [p.id, p])));
      })
      .catch(() => setProductsMap(new Map()));
  }, [messages, productsMap.size]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    // Gulir mendekati atas → muat riwayat lebih lama (paginasi Batch 4)
    if (el.scrollTop < 80 && hasMore && !loadingOlder) void loadOlder();
  };

  // ---------- Kirim pesan (alur WA: PENDING → SENT → DELIVERED → balasan) ----------
  const sendMessage = useCallback(
    (payload: Partial<ChatMessage> & { type: string }) => {
      const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const optimistic: ChatMessage = {
        id: tempId,
        chatId: chat.id,
        sender: "me",
        senderName: "Anda",
        senderColorKey: "emerald",
        type: payload.type,
        body: payload.body ?? "",
        mediaUrl: payload.mediaUrl ?? null,
        mediaName: payload.mediaName ?? null,
        mediaMime: payload.mediaMime ?? null,
        mediaSize: payload.mediaSize ?? null,
        latitude: payload.latitude ?? null,
        longitude: payload.longitude ?? null,
        placeName: payload.placeName ?? null,
        cardName: payload.cardName ?? null,
        cardPhone: payload.cardPhone ?? null,
        productId: payload.productId ?? null,
        status: "PENDING",
        createdAt: new Date().toISOString(),
      };
      atBottomRef.current = true;
      setMessages((prev) => [...prev, optimistic]);

      void (async () => {
        try {
          const res = await fetch(`/api/chats/${chat.id}/messages`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const data = (await res.json()) as { message?: ChatMessage; error?: string };
          if (!res.ok || !data.message) throw new Error(data.error || "Gagal mengirim pesan");
          const serverMsg = data.message;
          setMessages((prev) => prev.map((m) => (m.id === tempId ? serverMsg : m)));
          onChatUpdated();

          // Simulasi pesan tersampaikan
          setTimeout(() => {
            void fetch("/api/simulate/progress", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chatId: chat.id }),
            })
              .then(() => {
                setMessages((prev) => prev.map((m) => (m.id === serverMsg.id ? { ...m, status: "DELIVERED" } : m)));
              })
              .catch(() => {});
          }, 900);

          // Simulasi balasan kontak
          setTimeout(() => {
            void fetch("/api/simulate/reply", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chatId: chat.id }),
            })
              .then((r) => r.json())
              .then((d: { message?: ChatMessage }) => {
                if (d.message) {
                  setMessages((prev) =>
                    prev.some((x) => x.id === d.message!.id) ? prev : [...prev, d.message!]
                  );
                  atBottomRef.current = true;
                  onChatUpdated();
                }
              })
              .catch(() => {});
          }, 2500 + Math.floor(Math.random() * 2500));
        } catch (err) {
          setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, status: "FAILED" } : m)));
          toast({
            title: "Pesan gagal dikirim",
            description: err instanceof Error ? err.message : "Periksa koneksi lalu coba lagi.",
            variant: "destructive",
          });
        }
      })();
    },
    [chat.id, onChatUpdated, toast]
  );

  // ---------- Hapus pesan ----------
  const deleteMessage = useCallback(
    (id: string) => {
      setMessages((prev) => prev.filter((m) => m.id !== id));
      if (id.startsWith("tmp-")) return;
      void fetch(`/api/messages/${id}`, { method: "DELETE" })
        .then(() => onChatUpdated())
        .catch(() => toast({ title: "Gagal menghapus pesan", variant: "destructive" }));
    },
    [onChatUpdated, toast]
  );

  // ---------- Buka blokir ----------
  const unblockContact = useCallback(() => {
    const contactId = chat.contact?.id;
    if (!contactId) return;
    void fetch(`/api/contacts/${contactId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocked: false }),
    })
      .then(() => {
        toast({ title: "Blokir dibuka", description: chat.contact?.name });
        onChatUpdated();
      })
      .catch(() => toast({ title: "Gagal membuka blokir", variant: "destructive" }));
  }, [chat.contact?.id, chat.contact?.name, onChatUpdated, toast]);

  // ---------- Aksi menu chat ----------
  const patchChat = useCallback(
    async (patch: Record<string, unknown>, okTitle: string) => {
      try {
        const res = await fetch(`/api/chats/${chat.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (!res.ok) throw new Error();
        onChatUpdated();
        toast({ title: okTitle });
      } catch {
        toast({ title: "Gagal memperbarui obrolan", variant: "destructive" });
      }
    },
    [chat.id, onChatUpdated, toast]
  );

  const muteChat = (durationLabel: string) => {
    void patchChat({ muted: true }, `Notifikasi dibisukan (${durationLabel})`);
  };

  const saveContactName = async () => {
    const contactId = chat.contact?.id;
    if (!contactId) return;
    const name = contactName.trim();
    if (!name) return;
    try {
      const res = await fetch(`/api/contacts/${contactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error();
      setContactEditOpen(false);
      toast({ title: "Kontak disimpan", description: name });
      onChatUpdated();
    } catch {
      toast({ title: "Gagal menyimpan kontak", variant: "destructive" });
    }
  };

  const exportChat = () => {
    const lines = messages.map((m) => {
      const who = m.sender === "me" ? "Anda" : m.sender === "system" ? "Sistem" : m.senderName ?? chat.name;
      const text = m.body || `[${m.type.toLowerCase()}]`;
      return `[${waDayLabel(m.createdAt)} ${formatTime(m.createdAt)}] ${who}: ${text}`;
    });
    const content =
      `Obrolan dengan ${chat.name}\n` +
      `Diekspor dari ${business.businessName} · ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB\n` +
      `${"-".repeat(40)}\n\n${lines.join("\n")}\n`;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Obrolan ${chat.name}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Obrolan diekspor", description: "Tersimpan sebagai berkas .txt" });
  };

  const clearMessages = async () => {
    try {
      const res = await fetch(`/api/chats/${chat.id}/messages`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setMessages([]);
      onChatUpdated();
      toast({ title: "Obrolan dibersihkan" });
    } catch {
      toast({ title: "Gagal membersihkan obrolan", variant: "destructive" });
    }
  };

  const deleteChat = async () => {
    try {
      const res = await fetch(`/api/chats/${chat.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast({ title: "Obrolan dihapus" });
      onBack();
      onChatUpdated();
    } catch {
      toast({ title: "Gagal menghapus obrolan", variant: "destructive" });
    }
  };

  const reportChat = async () => {
    if (reportBlock && chat.contact?.id) {
      try {
        await fetch(`/api/contacts/${chat.contact.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ blocked: true }),
        });
        onChatUpdated();
      } catch {
        // laporan tetap terkirim
      }
    }
    toast({ title: "Laporan terkirim", description: "Terima kasih. Tim kami akan meninjaunya." });
  };

  const blockContact = () => {
    const contactId = chat.contact?.id;
    if (!contactId) return;
    void fetch(`/api/contacts/${contactId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocked: true }),
    })
      .then(() => {
        toast({ title: "Kontak diblokir", description: chat.contact?.name });
        onChatUpdated();
      })
      .catch(() => toast({ title: "Gagal memblokir kontak", variant: "destructive" }));
  };

  const copyCallLink = () => {
    const link = `https://call.whatsapp.com/${Math.random().toString(36).slice(2, 12)}`;
    void navigator.clipboard
      ?.writeText(link)
      .then(() => toast({ title: "Tautan panggilan disalin", description: link }))
      .catch(() => toast({ title: "Tautan panggilan", description: link }));
  };

  // ---------- Info header ----------
  const presence = useMemo(() => {
    if (chat.type === "GROUP") {
      if (participants.length === 0) return "memuat anggota…";
      const shown = participants.slice(0, 3).map((p) => p.name).join(", ");
      const more = participants.length > 3 ? ` +${participants.length - 3} lainnya` : "";
      return `Anda, ${shown}${more}`;
    }
    const c = chat.contact;
    if (!c) return "";
    if (c.blocked) return "diblokir";
    if (c.lastSeen && Date.now() - new Date(c.lastSeen).getTime() < 2 * 60_000) return "online";
    if (c.lastSeen) return `terakhir dilihat ${timeAgo(c.lastSeen)}`;
    return "offline";
  }, [chat.type, chat.contact, participants]);

  const isOnline = presence === "online";
  const mediaCount = messages.filter((m) => MEDIA_TYPES.includes(m.type)).length;

  // ---------- Pencarian dalam chat ----------
  const q = searchQuery.trim().toLowerCase();
  const visibleMessages = useMemo(() => {
    if (!q) return messages;
    return messages.filter(
      (m) =>
        (m.body ?? "").toLowerCase().includes(q) ||
        (m.mediaName ?? "").toLowerCase().includes(q) ||
        (m.placeName ?? "").toLowerCase().includes(q)
    );
  }, [messages, q]);

  // ---------- Render pesan dengan pemisah hari ----------
  const rendered = useMemo(() => {
    const items: React.ReactNode[] = [];
    let lastDay = "";
    for (const m of visibleMessages) {
      const day = waDayLabel(m.createdAt);
      if (day !== lastDay) {
        items.push(
          <div key={`day-${m.id}`} className="flex justify-center my-3 px-4">
            <span className="bg-white/85 dark:bg-secondary text-muted-foreground text-xs px-3 py-1 rounded-lg shadow-sm">{day}</span>
          </div>
        );
        lastDay = day;
      }
      items.push(
        <MessageBubble
          key={m.id}
          message={m}
          isGroup={chat.type === "GROUP"}
          product={m.productId ? productsMap.get(m.productId) : undefined}
          onDelete={deleteMessage}
          onOpenProduct={onOpenProduct}
          selectMode={selectMode}
          selected={selectedMsgIds.has(m.id)}
          onToggleSelect={() =>
            setSelectedMsgIds((prev) => {
              const next = new Set(prev);
              if (next.has(m.id)) next.delete(m.id);
              else next.add(m.id);
              return next;
            })
          }
        />
      );
    }
    return items;
  }, [visibleMessages, chat.type, productsMap, deleteMessage, selectMode, selectedMsgIds]);

  const isPrivate = chat.type === "PRIVATE";
  const contactLabelIds: string[] = useMemo(() => {
    try {
      return JSON.parse(chat.contact?.labelIds ?? "[]") as string[];
    } catch {
      return [];
    }
  }, [chat.contact?.labelIds]);

  return (
    <div className="flex flex-col h-full flex-1 w-full min-w-0 bg-[#f0f2f5] dark:bg-[#0b141a]">
      {/* Header percakapan */}
      <header className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 h-14 border-b border-border bg-[#f0f2f5] dark:bg-[#111b21] shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden shrink-0"
          onClick={onBack}
          aria-label="Kembali ke daftar chat"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <button
          type="button"
          onClick={() => setInfoOpen(true)}
          className="flex items-center gap-3 flex-1 min-w-0 text-left rounded-lg px-1 py-1 hover:bg-black/5 transition-colors"
          aria-label={`Info ${chat.name}`}
        >
          <ChatAvatar name={chat.name} colorKey={chat.colorKey} avatarUrl={chat.avatarUrl} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="font-semibold text-[15px] truncate">{chat.name}</p>
              {chat.isBusinessChat && (
                <>
                  <ShieldCheck className="h-3.5 w-3.5 text-primary shrink-0" aria-label="Chat bisnis" />
                  <span className="text-[10px] text-primary font-medium shrink-0">Bisnis</span>
                </>
              )}
              {chat.disappearing !== "off" && (
                <span
                  className="flex items-center gap-0.5 text-[10px] text-muted-foreground shrink-0"
                  title={`Pesan sementara: ${DISAPPEARING_LABEL[chat.disappearing]}`}
                >
                  <Timer className="h-3 w-3" /> {DISAPPEARING_LABEL[chat.disappearing]}
                </span>
              )}
              {chat.favorite && <Heart className="h-3 w-3 text-rose-500 fill-rose-500 shrink-0" aria-label="Favorit" />}
            </div>
            <p className={cn("text-xs truncate", isOnline ? "text-primary font-medium" : "text-muted-foreground")}>
              {presence}
            </p>
          </div>
        </button>

        {/* Tambah ke daftar (dropdown) — sesuai WhatsApp Web */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="hidden lg:inline-flex items-center gap-1.5 h-9 px-2.5 shrink-0 text-[13px] text-muted-foreground hover:text-foreground"
              aria-label="Tambah ke daftar"
            >
              <Bookmark className="h-4 w-4" />
              <span className="hidden xl:inline">{contactLabelIds.length > 0 ? "Di daftar" : "Tambah ke daftar"}</span>
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {isPrivate && chat.contact ? (
              <>
                <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => setLabelsOpen(true)}>
                  <Bookmark className="h-4 w-4" /> Atur daftar…
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="gap-2 cursor-pointer"
                  onClick={() => void patchChat({ favorite: !chat.favorite }, chat.favorite ? "Dihapus dari favorit" : "Ditambahkan ke favorit")}
                >
                  <Heart className={cn("h-4 w-4", chat.favorite && "text-rose-500 fill-rose-500")} />
                  {chat.favorite ? "Hapus dari favorit" : "Tambah ke favorit"}
                </DropdownMenuItem>
              </>
            ) : (
              <DropdownMenuItem disabled className="gap-2">
                <Bookmark className="h-4 w-4" /> Hanya untuk chat pribadi
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Panggilan: video + dropdown */}
        {isPrivate && (
          <div className="flex items-center shrink-0">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Panggilan video"
              onClick={() => setCallKind("VIDEO")}
              className="rounded-r-none"
            >
              <Video className="h-[18px] w-[18px] text-muted-foreground" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Opsi panggilan" className="rounded-l-none px-0.5 -ml-1">
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => setCallKind("VIDEO")}>
                  <Video className="h-4 w-4" /> Panggilan video
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => setCallKind("VOICE")}>
                  <Phone className="h-4 w-4" /> Panggilan suara
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2 cursor-pointer" onClick={copyCallLink}>
                  <Download className="h-4 w-4" /> Buat tautan panggilan
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        <Button
          variant="ghost"
          size="icon"
          aria-label="Cari di obrolan"
          aria-pressed={searchOpen}
          onClick={() => {
            setSearchOpen((v) => !v);
            if (searchOpen) setSearchQuery("");
          }}
          className="shrink-0"
        >
          <Search className="h-[18px] w-[18px] text-muted-foreground" />
        </Button>

        {/* Menu opsi obrolan (⋮) — sesuai WhatsApp Web */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Menu obrolan" className="shrink-0">
              <svg viewBox="0 0 24 24" className="h-5 w-5 text-muted-foreground" fill="currentColor" aria-hidden="true">
                <circle cx="12" cy="5" r="1.8" />
                <circle cx="12" cy="12" r="1.8" />
                <circle cx="12" cy="19" r="1.8" />
              </svg>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuItem
              className="gap-2.5 cursor-pointer"
              disabled={!isPrivate || !chat.contact}
              onClick={() => {
                setContactName(chat.contact?.name ?? "");
                setContactEditOpen(true);
              }}
            >
              <UserRoundPlus className="h-4 w-4" /> Tambah ke kontak
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2.5 cursor-pointer" onClick={() => setInfoOpen(true)}>
              <Info className="h-4 w-4" /> Info {isPrivate ? "kontak" : "grup"}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="gap-2.5 cursor-pointer"
              onClick={() => {
                setSearchOpen(true);
                setTimeout(() => (document.getElementById("chat-search-input") as HTMLElement | null)?.focus(), 50);
              }}
            >
              <Search className="h-4 w-4" /> Cari
            </DropdownMenuItem>
            <DropdownMenuItem
              className="gap-2.5 cursor-pointer"
              onClick={() => {
                setSelectMode(true);
                setSelectedMsgIds(new Set());
              }}
            >
              <SquareCheckBig className="h-4 w-4" /> Pilih pesan
            </DropdownMenuItem>
            {chat.muted ? (
              <DropdownMenuItem
                className="gap-2.5 cursor-pointer"
                onClick={() => void patchChat({ muted: false }, "Notifikasi dinyalakan")}
              >
                <Ban className="h-4 w-4" /> Bunyikan notifikasi
              </DropdownMenuItem>
            ) : (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="gap-2.5">
                  <Ban className="h-4 w-4" /> Bisukan notifikasi
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-44">
                  <DropdownMenuItem onClick={() => muteChat("8 jam")}>8 jam</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => muteChat("1 minggu")}>1 minggu</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => muteChat("Selalu")}>Selalu</DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            )}
            <DropdownMenuItem className="gap-2.5 cursor-pointer" onClick={() => setDisappearingOpen(true)}>
              <Timer className="h-4 w-4" /> Pesan sementara
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2.5 cursor-pointer" onClick={() => setThemeOpen(true)}>
              <Palette className="h-4 w-4" /> Tema obrolan
            </DropdownMenuItem>
            <DropdownMenuItem
              className="gap-2.5 cursor-pointer"
              onClick={() => void patchChat({ favorite: !chat.favorite }, chat.favorite ? "Dihapus dari favorit" : "Ditambahkan ke favorit")}
            >
              <Heart className={cn("h-4 w-4", chat.favorite && "text-rose-500 fill-rose-500")} />
              {chat.favorite ? "Hapus dari favorit" : "Tambah ke favorit"}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="gap-2.5 cursor-pointer"
              disabled={!isPrivate || !chat.contact}
              onClick={() => setLabelsOpen(true)}
            >
              <Bookmark className="h-4 w-4" /> Tambah ke daftar
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2.5 cursor-pointer" onClick={exportChat}>
              <Download className="h-4 w-4" /> Ekspor obrolan
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2.5 cursor-pointer" onClick={onBack}>
              <MessageSquareX className="h-4 w-4" /> Tutup obrolan
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2.5 cursor-pointer"
              variant="destructive"
              disabled={!isPrivate || !chat.contact}
              onClick={() => {
                setReportBlock(true);
                setReportOpen(true);
              }}
            >
              <MessageSquareWarning className="h-4 w-4" /> Laporkan
            </DropdownMenuItem>
            {chat.contact?.blocked ? (
              <DropdownMenuItem className="gap-2.5 cursor-pointer" onClick={unblockContact}>
                <CircleSlash className="h-4 w-4" /> Buka blokir
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                className="gap-2.5 cursor-pointer"
                variant="destructive"
                disabled={!isPrivate || !chat.contact}
                onClick={() => setBlockOpen(true)}
              >
                <Ban className="h-4 w-4" /> Blokir
              </DropdownMenuItem>
            )}
            <DropdownMenuItem className="gap-2.5 cursor-pointer" onClick={() => setClearOpen(true)}>
              <Eraser className="h-4 w-4" /> Bersihkan obrolan
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2.5 cursor-pointer" variant="destructive" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-4 w-4" /> Hapus obrolan
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* Bar pencarian dalam chat */}
      {searchOpen && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-background shrink-0">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
          <Input
            id="chat-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari pesan dalam obrolan ini…"
            aria-label="Cari pesan dalam obrolan"
            className="h-8 bg-secondary border-transparent"
          />
          {q && (
            <span className="text-xs text-muted-foreground whitespace-nowrap tabular-nums">
              {visibleMessages.length} hasil
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            aria-label="Tutup pencarian"
            onClick={() => {
              setSearchOpen(false);
              setSearchQuery("");
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Bar pilih pesan */}
      {selectMode && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-background shrink-0" aria-live="polite">
          <ListChecks className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
          <p className="text-sm font-medium flex-1">{selectedMsgIds.size} pesan dipilih</p>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Hapus pesan terpilih"
            disabled={selectedMsgIds.size === 0}
            onClick={() => {
              const ids = Array.from(selectedMsgIds);
              ids.forEach((id) => deleteMessage(id));
              exitSelect();
              toast({ title: `${ids.length} pesan dihapus` });
            }}
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-[18px] w-[18px]" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Batal pilih pesan" onClick={exitSelect}>
            <X className="h-[18px] w-[18px] text-muted-foreground" />
          </Button>
        </div>
      )}

      {/* Area pesan */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-y-auto wa-scrollbar py-3 space-y-1"
        style={themeCss ? { background: themeCss } : undefined}
        role="log"
        aria-label={`Percakapan dengan ${chat.name}`}
        aria-live="polite"
      >
        {loading && (
          <div className="space-y-3 px-4 py-2" aria-hidden="true">
            <div className="flex justify-start">
              <Skeleton className="h-10 w-48 rounded-lg bg-white/60" />
            </div>
            <div className="flex justify-end">
              <Skeleton className="h-10 w-40 rounded-lg" />
            </div>
            <div className="flex justify-start">
              <Skeleton className="h-14 w-56 rounded-lg bg-white/60" />
            </div>
            <div className="flex justify-end">
              <Skeleton className="h-10 w-52 rounded-lg" />
            </div>
          </div>
        )}

        {!loading && visibleMessages.length === 0 && q && (
          <div className="h-40 flex flex-col items-center justify-center px-6 text-center">
            <Search className="h-8 w-8 text-muted-foreground/40 mb-2" aria-hidden="true" />
            <p className="text-sm font-medium text-foreground/80">Tidak ada hasil untuk “{searchQuery}”</p>
            <p className="text-xs text-muted-foreground mt-1">Coba kata kunci lain.</p>
          </div>
        )}

        {!loading && messages.length === 0 && !q && (
          <div className="h-full flex flex-col items-center justify-center px-6 text-center">
            <span className="h-16 w-16 rounded-full bg-white dark:bg-secondary shadow flex items-center justify-center mb-4">
              <span className="text-2xl" aria-hidden="true">👋</span>
            </span>
            <p className="text-sm font-medium text-foreground/80">Belum ada pesan di sini</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              Mulai percakapan dengan menyapa {chat.name} lewat kolom di bawah.
            </p>
          </div>
        )}

        {loadingOlder && (
          <div className="flex justify-center py-2" role="status" aria-live="polite">
            <span className="flex items-center gap-2 bg-white/85 dark:bg-secondary text-muted-foreground text-xs px-3 py-1 rounded-full shadow-sm">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> Memuat pesan lama…
            </span>
          </div>
        )}
        {!loading && hasMore && !loadingOlder && messages.length > 0 && (
          <div className="flex justify-center pb-1">
            <button
              type="button"
              onClick={() => void loadOlder()}
              className="text-[11px] text-primary hover:underline"
            >
              Muat pesan lama
            </button>
          </div>
        )}

        {rendered}
      </div>

      {/* Composer */}
      {!selectMode && (
        <Composer
          chatId={chat.id}
          blocked={chat.type === "PRIVATE" ? chat.contact?.blocked : false}
          onUnblock={unblockContact}
          sendMessage={sendMessage}
        />
      )}

      {/* Panggilan keluar WebRTC (mount-based agar state selalu segar) */}
      {callKind !== null && (
        <CallDialog
          mode="outgoing"
          contactId={chat.contact?.id ?? null}
          contactName={chat.name}
          colorKey={chat.colorKey}
          avatarUrl={chat.avatarUrl}
          kind={callKind}
          onEnd={() => setCallKind(null)}
        />
      )}

      {/* Info chat */}
      <ChatInfoSheet
        open={infoOpen}
        onOpenChange={setInfoOpen}
        chat={chat}
        participants={participants}
        mediaCount={mediaCount}
        onContactUpdated={onChatUpdated}
      />

      {/* ---------- Dialog menu ---------- */}
      <LabelsPickDialog
        open={labelsOpen}
        onOpenChange={setLabelsOpen}
        contactId={chat.contact?.id ?? null}
        initialLabelIds={contactLabelIds}
        onSaved={() => onChatUpdated()}
      />
      <DisappearingDialog
        open={disappearingOpen}
        onOpenChange={setDisappearingOpen}
        chatId={chat.id}
        current={chat.disappearing}
        onSaved={() => onChatUpdated()}
      />
      <ChatThemeDialog open={themeOpen} onOpenChange={setThemeOpen} chatId={chat.id} onApplied={setThemeCss} />

      <ConfirmDialog
        open={contactEditOpen}
        onOpenChange={setContactEditOpen}
        title="Simpan ke kontak"
        description={`Perbarui nama kontak untuk ${chat.contact?.phone ?? ""}.`}
        confirmLabel="Simpan"
        onConfirm={() => void saveContactName()}
      >
        <div className="py-1">
          <Label htmlFor="contact-name-input" className="text-xs text-muted-foreground">
            Nama kontak
          </Label>
          <Input
            id="contact-name-input"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            placeholder="Nama kontak"
            className="mt-1"
          />
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        title={`Laporkan ke ${business.businessName}?`}
        description="Pesan terakhir dari obrolan ini akan diteruskan untuk ditinjau."
        confirmLabel="Laporkan"
        destructive
        onConfirm={() => void reportChat()}
      >
        <Label className="flex items-center gap-2.5 rounded-lg border border-border px-3 py-2.5 cursor-pointer">
          <Checkbox checked={reportBlock} onCheckedChange={(v) => setReportBlock(v === true)} />
          <span className="text-sm">Blokir kontak</span>
        </Label>
      </ConfirmDialog>

      <ConfirmDialog
        open={blockOpen}
        onOpenChange={setBlockOpen}
        title={`Blokir ${chat.name}?`}
        description="Kontak yang diblokir tidak bisa mengirim pesan atau menelepon Anda lagi."
        confirmLabel="Blokir"
        destructive
        onConfirm={blockContact}
      />

      <ConfirmDialog
        open={clearOpen}
        onOpenChange={setClearOpen}
        title="Bersihkan obrolan ini?"
        description="Semua pesan akan dihapus dari obrolan ini, tetapi chat tetap ada."
        confirmLabel="Bersihkan"
        destructive
        onConfirm={() => void clearMessages()}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Hapus obrolan ini?"
        description="Obrolan beserta seluruh pesan akan dihapus permanen. Tindakan ini tidak bisa dibatalkan."
        confirmLabel="Hapus"
        destructive
        onConfirm={() => void deleteChat()}
      />
    </div>
  );
}
