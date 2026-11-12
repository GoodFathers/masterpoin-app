// ===================== EMIT REALTIME CHAT (SERVER) =====================
// Jembatan API Next.js → chat-realtime-service (port 3004).
// Koneksi socket.io-client tunggal (singleton tahan HMR dev) dengan
// handshake secret "server:auth". Event yang dipancarkan sebelum koneksi
// siap dibuffer lalu dikirim begitu service mengonfirmasi handshake.
// Semua panggilan fire-and-forget: kegagalan push TIDAK boleh menggagalkan
// operasi utama API — polling 15 detik di klien tetap menjadi fallback.

import { io, type Socket } from "socket.io-client";

const RT_URL = process.env.CHAT_REALTIME_URL ?? "ws://127.0.0.1:3004";
const EMIT_SECRET =
  process.env.CHAT_REALTIME_SECRET ?? "indigoo-chat-rt-dev-secret";
const MAX_BUFFER = 200;

interface BroadcastMsg {
  event: string;
  payload: unknown;
}

// Cache di globalThis agar koneksi bertahan antar reload modul (HMR dev).
const globalStore = globalThis as unknown as {
  __chatRtSocket?: Socket;
  __chatRtBuffer?: BroadcastMsg[];
  __chatRtReady?: boolean;
};

function getEmitterSocket(): Socket | null {
  if (globalStore.__chatRtSocket) return globalStore.__chatRtSocket;
  try {
    const buffer: BroadcastMsg[] = (globalStore.__chatRtBuffer ??= []);
    const socket: Socket = io(RT_URL, {
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      timeout: 5000,
      autoConnect: true,
    });

    socket.on("connect", () => {
      socket.emit("server:auth", { secret: EMIT_SECRET });
    });
    socket.on("server:ok", () => {
      globalStore.__chatRtReady = true;
      console.info("[realtime-emit] terhubung ke chat-realtime-service");
      // Kirim event yang sempat dibuffer saat service belum siap
      while (buffer.length > 0) {
        const msg = buffer.shift()!;
        socket.emit("chat:broadcast", msg);
      }
    });
    socket.on("disconnect", () => {
      globalStore.__chatRtReady = false;
    });
    socket.on("server:rejected", (reason: unknown) => {
      console.error("[realtime-emit] ditolak service:", reason);
    });
    socket.on("connect_error", (err: Error) => {
      // Service belum jalan / sedang restart — fallback polling tetap hidup
      console.warn("[realtime-emit] connect_error:", err.message);
    });

    globalStore.__chatRtSocket = socket;
    return socket;
  } catch (err) {
    console.error("[realtime-emit] gagal membuat koneksi:", err);
    return null;
  }
}

/**
 * Siarkan event chat ke semua klien browser terautentikasi.
 * Aman dipanggil dari route handler mana pun; tidak pernah melempar error.
 */
export function emitRealtime(event: string, payload: unknown): void {
  try {
    const socket = getEmitterSocket();
    if (!socket) return;
    const msg: BroadcastMsg = { event, payload };
    if (globalStore.__chatRtReady && socket.connected) {
      socket.emit("chat:broadcast", msg);
    } else if ((globalStore.__chatRtBuffer ??= []).length < MAX_BUFFER) {
      globalStore.__chatRtBuffer!.push(msg);
    }
  } catch {
    // tidak pernah melempar
  }
}
