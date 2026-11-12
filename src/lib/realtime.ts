"use client";

// ===================== REALTIME CHAT (KLIEN BROWSER) =====================
// Satu koneksi socket.io per tab ke chat-realtime-service (port 3004).
//
// ATURAN GATEWAY SANDBOX: URL WAJIB relatif dengan query XTransformPort.
// DILARANG menulis http://localhost:3004 atau :3004 di URL klien.
// Path koneksi selalu "/" — pola sama dengan signaling.ts (panggilan).
//
// Setelah connect, tab mengirim "auth" { token } (Bearer localStorage);
// service memverifikasi ke /api/auth/me. Socket tanpa auth valid diputus
// server dalam 15 detik.

import { io, type Socket } from "socket.io-client";
import type { ChatMessage } from "@/components/chat/types";

const RT_QUERY = "/?XTransformPort=3004";

let socket: Socket | null = null;

/** Ambil (atau buat) koneksi realtime bersama. Emit sebelum "connect" dibuffer socket.io. */
export function getRealtimeSocket(): Socket {
  if (socket) return socket;

  socket = io(RT_QUERY, {
    transports: ["websocket", "polling"],
    forceNew: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    timeout: 10000,
  });

  socket.on("connect", () => {
    let token: string | null = null;
    try {
      token = window.localStorage.getItem("indigoo:token");
    } catch {
      token = null;
    }
    socket?.emit("auth", { token });
  });

  socket.on("auth:ok", () => {
    console.info("[realtime] chat realtime aktif");
  });

  socket.on("disconnect", (reason) => {
    console.info("[realtime] disconnect:", reason);
  });

  return socket;
}

// ---------- Pelacak chat aktif (untuk keputusan notifikasi) ----------
// ConversationPanel/ChatsView mendaftarkan chat yang sedang terbuka;
// NotificationCenter melewatkan notifikasi untuk chat yang sedang dilihat.

let activeChatId: string | null = null;

export function setActiveChatId(id: string | null): void {
  activeChatId = id;
}

export function getActiveChatId(): string | null {
  return activeChatId;
}

// ---------- Tipe payload event dari server ----------

/** Event chat:message — pesan baru pada chat mana pun. */
export interface ChatMessagePush {
  chatId: string;
  chatName: string;
  chatType: string; // PRIVATE | GROUP
  chatMuted: boolean;
  message: ChatMessage;
}

/** Event chat:status — pembaruan centang (DELIVERED / READ). */
export interface ChatStatusPush {
  chatId: string;
  status: string;
}

/** Event chat:message-deleted — pesan dihapus (dari tab/perangkat lain). */
export interface ChatMessageDeletedPush {
  chatId: string;
  messageId: string;
}

/** Event chat:update — sesuatu berubah di chat (pin/mute/unread/nama/dll). */
export interface ChatUpdatePush {
  chatId: string;
}

/** Event chat:deleted — chat dihapus (dari tab/perangkat lain). */
export interface ChatDeletedPush {
  chatId: string;
}
