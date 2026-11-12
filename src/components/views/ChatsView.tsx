"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/wa-utils";
import { useToast } from "@/hooks/use-toast";
import { useBusinessProfile } from "@/lib/useBusinessProfile";
import type { ViewId } from "@/components/AppShell";
import ChatListPanel, { type ChatFilter } from "@/components/chat/ChatListPanel";
import ConversationPanel from "@/components/chat/ConversationPanel";
import { NewChatDialog, NewGroupDialog } from "@/components/chat/NewChatDialogs";
import type { ChatSummary } from "@/components/chat/types";
import {
  getRealtimeSocket,
  setActiveChatId,
  type ChatMessagePush,
  type ChatUpdatePush,
  type ChatDeletedPush,
} from "@/lib/realtime";

export default function ChatsView({ onNavigate }: { onNavigate?: (view: ViewId) => void }) {
  const { toast } = useToast();
  const business = useBusinessProfile();

  // Batch 5: klik kartu produk di chat → fokuskan produk di katalog.
  // Dikirim lewat flag sessionStorage (pola sama dgn NEW_PRODUCT_FLAG) karena
  // CatalogView baru ter-mount SETELAH pindah view — event window akan terlewat.
  const handleOpenProduct = useCallback(
    (productId?: string) => {
      if (productId) {
        try {
          window.sessionStorage.setItem("wa-catalog-focus", productId);
        } catch {
          // abaikan
        }
        window.dispatchEvent(new CustomEvent("wa:catalog:focus", { detail: { productId } }));
      }
      onNavigate?.("catalog");
    },
    [onNavigate]
  );

  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [filter, setFilter] = useState<ChatFilter>("all");
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRef = useRef(search);
  searchRef.current = search;

  const activeChat = useMemo(() => chats.find((c) => c.id === activeId) ?? null, [chats, activeId]);

  // ---------- Muat daftar chat ----------
  const refreshChats = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoadingChats(true);
      try {
        const q = searchRef.current.trim();
        const url = `/api/chats?filter=${filter}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
        const res = await fetch(url, { cache: "no-store" });
        const data = (await res.json()) as { chats?: ChatSummary[] };
        if (res.ok) setChats(data.chats ?? []);
      } catch {
        if (!opts?.silent) toast({ title: "Gagal memuat daftar chat", variant: "destructive" });
      } finally {
        if (!opts?.silent) setLoadingChats(false);
      }
    },
    [filter, toast]
  );

  useEffect(() => {
    void refreshChats();
  }, [refreshChats]);

  // ---------- Realtime (Batch 2): sinkron daftar chat & badge unread ----------
  // Event chat:* dari service menandai "ada perubahan" — daftar di-refresh
  // (debounce 250 ms agar lemparan event beruntun hanya memicu 1 fetch).
  const rtTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queueRtRefresh = useCallback(() => {
    if (rtTimerRef.current) clearTimeout(rtTimerRef.current);
    rtTimerRef.current = setTimeout(() => void refreshChats({ silent: true }), 250);
  }, [refreshChats]);

  useEffect(() => {
    const s = getRealtimeSocket();
    const onMessage = (p: ChatMessagePush) => {
      if (p?.chatId) queueRtRefresh();
    };
    const onUpdate = (p: ChatUpdatePush) => {
      if (p?.chatId) queueRtRefresh();
    };
    const onDeleted = (p: ChatDeletedPush) => {
      if (!p?.chatId) return;
      // Tutup panel jika chat yang aktif dihapus dari tab/perangkat lain
      setActiveId((cur) => (cur === p.chatId ? null : cur));
      queueRtRefresh();
    };
    s.on("chat:message", onMessage);
    s.on("chat:update", onUpdate);
    s.on("chat:deleted", onDeleted);
    return () => {
      s.off("chat:message", onMessage);
      s.off("chat:update", onUpdate);
      s.off("chat:deleted", onDeleted);
      if (rtTimerRef.current) clearTimeout(rtTimerRef.current);
    };
  }, [queueRtRefresh]);

  // Daftarkan chat aktif global untuk keputusan notifikasi (NotificationCenter)
  useEffect(() => {
    setActiveChatId(activeId);
    return () => setActiveChatId(null);
  }, [activeId]);

  // Tombol "chat/grup baru" di top bar AppShell (mobile) memicu dialog via event global
  // "wa:new-chat" (detail.kind = "chat" | "group") — jembatan antara AppShell & view ini.
  useEffect(() => {
    const handler = (e: Event) => {
      const kind = (e as CustomEvent<{ kind?: string }>).detail?.kind;
      if (kind === "group") setNewGroupOpen(true);
      else setNewChatOpen(true);
    };
    window.addEventListener("wa:new-chat", handler);
    return () => window.removeEventListener("wa:new-chat", handler);
  }, []);

  // Debounce pencarian → refetch dengan q (server-side)
  const handleSearchChange = useCallback(
    (v: string) => {
      setSearch(v);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => void refreshChats({ silent: true }), 350);
    },
    [refreshChats]
  );

  // ---------- Aksi daftar chat ----------
  const patchChat = useCallback(
    async (id: string, patch: Record<string, unknown>) => {
      // update optimis di state lokal
      setChats((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
      try {
        const res = await fetch(`/api/chats/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (!res.ok) throw new Error();
        void refreshChats({ silent: true });
      } catch {
        toast({ title: "Gagal memperbarui chat", variant: "destructive" });
        void refreshChats({ silent: true });
      }
    },
    [refreshChats, toast]
  );

  const deleteChat = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/chats/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error();
        if (activeId === id) setActiveId(null);
        toast({ title: "Chat dihapus" });
        void refreshChats({ silent: true });
      } catch {
        toast({ title: "Gagal menghapus chat", variant: "destructive" });
      }
    },
    [activeId, refreshChats, toast]
  );

  const openChat = useCallback((chat: ChatSummary) => {
    setActiveId(chat.id);
    if (chat.unread > 0) {
      // Optimis di UI + persist ke server (ConversationPanel tidak perlu patch lagi)
      setChats((prev) => prev.map((c) => (c.id === chat.id ? { ...c, unread: 0 } : c)));
      void fetch(`/api/chats/${chat.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unread: 0 }),
      }).catch(() => {});
    }
  }, []);

  const chatCreated = useCallback(
    (chat: ChatSummary) => {
      setActiveId(chat.id);
      void refreshChats({ silent: true });
    },
    [refreshChats]
  );

  return (
    <div className="h-full flex bg-white dark:bg-[#0b141a]">
      {/* Panel daftar chat */}
      <div
        className={cn(
          "w-full md:w-[380px] lg:w-[400px] md:border-r border-border flex flex-col min-h-0 shrink-0 bg-white dark:bg-[#111b21]",
          activeId ? "hidden md:flex" : "flex"
        )}
      >
        <ChatListPanel
          chats={chats}
          loading={loadingChats}
          activeId={activeId}
          filter={filter}
          onFilterChange={setFilter}
          search={search}
          onSearchChange={handleSearchChange}
          onOpenChat={openChat}
          onPatchChat={patchChat}
          onDeleteChat={deleteChat}
          onNewChat={() => setNewChatOpen(true)}
          onNewGroup={() => setNewGroupOpen(true)}
          onNavigate={(v) => onNavigate?.(v)}
          onClearAll={() => {
            setActiveId(null);
            void refreshChats({ silent: true });
          }}
        />
      </div>

      {/* Panel percakapan */}
      <div className={cn("flex-1 min-w-0 min-h-0", activeId ? "flex" : "hidden md:flex")}>
        {activeChat ? (
          <ConversationPanel
            key={activeChat.id}
            chat={activeChat}
            onBack={() => setActiveId(null)}
            onChatUpdated={() => void refreshChats({ silent: true })}
            onOpenProduct={handleOpenProduct}
          />
        ) : (
          <div className="flex-1 hidden md:flex flex-col items-center justify-center bg-[#f0f2f5] dark:bg-[#0b141a] border-l border-border text-center px-8">
            <img
              src={business.logoUrl}
              alt={`Logo ${business.businessName}`}
              className="h-24 w-24 rounded-full object-cover shadow-md ring-4 ring-primary/10 mb-6"
            />
            <h2 className="text-2xl font-bold text-foreground/85">{business.businessName}</h2>
            <p className="text-sm text-muted-foreground mt-2 max-w-sm leading-relaxed">
              Kelola percakapan pelanggan {business.businessName} dari satu tempat. Pilih chat di panel kiri untuk mulai
              membalas pesan, atau buat chat dan grup baru.
            </p>
            <p className="text-xs text-muted-foreground/70 mt-6 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-primary inline-block" aria-hidden="true" />
              Terenkripsi ujung-ke-ujung • Demo UMKM Yogyakarta
            </p>
          </div>
        )}
      </div>

      {/* Dialog chat & grup baru */}
      <NewChatDialog open={newChatOpen} onOpenChange={setNewChatOpen} onCreated={chatCreated} />
      <NewGroupDialog open={newGroupOpen} onOpenChange={setNewGroupOpen} onCreated={chatCreated} />
    </div>
  );
}
