"use client";

import { create } from "zustand";
import type { ChatSummary } from "@/components/chat/types";

/**
 * State UI lintas-komponen untuk modul Chat.
 * Dipakai oleh ChatsView (penulis) dan TopBar/ObrolanMenu (pembaca)
 * agar menu titik-tiga di bar atas tahu obrolan mana yang sedang aktif.
 */
interface ChatUiState {
  activeChat: ChatSummary | null;
  setActiveChat: (chat: ChatSummary | null) => void;
}

export const useChatUi = create<ChatUiState>((set) => ({
  activeChat: null,
  setActiveChat: (chat) => set({ activeChat: chat }),
}));

/** Nama event lintas-komponen untuk aksi menu obrolan. */
export const CHAT_UI_EVENTS = {
  focusSearch: "indigoo:focus-chat-search",
  closeActiveChat: "indigoo:close-active-chat",
  chatCleared: "indigoo:chat-cleared",
  chatsRefresh: "indigoo:chats-refresh",
  newChat: "indigoo:new-chat",
  newGroup: "indigoo:new-group",
  wallpaperChanged: "indigoo:wallpaper-changed",
} as const;
