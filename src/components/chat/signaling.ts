"use client";

import { io, type Socket } from "socket.io-client";

/**
 * Koneksi signaling WebRTC bersama (satu koneksi socket.io per tab).
 *
 * ATURAN GATEWAY SANDBOX: URL WAJIB relatif dengan query XTransformPort.
 * DILARANG menulis http://localhost:3003 atau :3003 di URL klien.
 * Path koneksi selalu "/" (socket.io client memakai path internal default-nya
 * dan server signaling menerima request di path mana pun).
 */

const SIGNALING_QUERY = "/?XTransformPort=3003";
const CLIENT_ID_KEY = "wa_call_client_id";

/** clientId unik per tab — disimpan di sessionStorage. */
export function getClientId(): string {
  if (typeof window === "undefined") return "ssr";
  try {
    let id = window.sessionStorage.getItem(CLIENT_ID_KEY);
    if (!id) {
      id = `tab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      window.sessionStorage.setItem(CLIENT_ID_KEY, id);
    }
    return id;
  } catch {
    return "no-storage";
  }
}

let socket: Socket | null = null;

/** Ambil (atau buat) koneksi signaling bersama. Emit sebelum "connect" dibuffer otomatis oleh socket.io. */
export function getSignalingSocket(): Socket {
  if (socket) return socket;

  socket = io(SIGNALING_QUERY, {
    path: "/socket.io/", // path standar socket.io — routing gateway tetap via QUERY
    transports: ["websocket", "polling"],
    forceNew: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    timeout: 10000,
  });

  socket.on("connect", () => {
    socket?.emit("register", { clientId: getClientId() });
  });

  socket.on("disconnect", (reason) => {
    console.info("[signaling] disconnect:", reason);
  });

  return socket;
}

// ---------- Tipe payload signaling ----------

/** Event ring:incoming dari server (ke semua tab lain saat panggilan dimulai). */
export interface RingIncomingPayload {
  callId: string;
  /** businessName pemanggil */
  callerName: string;
  /** nama kontak yang dipanggil */
  contactName: string;
  contactId: string | null;
  colorKey?: string | null;
  avatarUrl?: string | null;
  kind: "VOICE" | "VIDEO";
}

/** Offer yang direlay server ke callee setelah call:accept. */
export interface CallOfferRelayPayload {
  callId: string;
  offer: RTCSessionDescriptionInit;
}

/** Answer dari callee yang diterima caller. */
export interface CallAnswerPayload {
  callId: string;
  answer: RTCSessionDescriptionInit;
}

/** ICE candidate dua arah. */
export interface CallIcePayload {
  callId: string;
  candidate: RTCIceCandidateInit;
}

/** Perubahan status panggilan (declined / ended / timeout / busy / cancelled ring). */
export interface CallStatusPayload {
  callId: string;
  reason?: string;
}

/** Event ring:cancelled agar overlay dering tab lain menutup dengan rapi. */
export interface RingCancelledPayload {
  callId: string;
  reason: "answered" | "declined" | "ended" | "timeout";
}
