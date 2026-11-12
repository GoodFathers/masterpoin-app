/**
 * Chat Realtime Service — push event chat via socket.io (Batch 2 — Task 26).
 *
 * PORT TETAP 3004 (diteruskan gateway Caddy via query ?XTransformPort=3004).
 * Path socket.io standar "/socket.io/" — routing tetap oleh gateway Caddy
 * via QUERY ?XTransformPort=3004 (bukan via path).
 *
 * ARSITEKTUR:
 *  - API Next.js terhubung SEBAGAI socket.io client ke ws://127.0.0.1:3004,
 *    melakukan handshake "server:auth" { secret } (env CHAT_REALTIME_SECRET,
 *    sama dengan .env proyek utama), lalu memancarkan "chat:broadcast"
 *    { event, payload } untuk menyiarkan event ke semua klien browser.
 *  - Klien browser wajib mengirim event "auth" { token } setelah connect;
 *    token diverifikasi ke GET http://127.0.0.1:3000/api/auth/me (Bearer).
 *    Socket yang belum terautentikasi dalam 15 detik diputus.
 *    Broadcast HANYA dikirim ke socket browser terautentikasi.
 *
 * EVENT KELUAR (ke klien browser):
 *  - chat:message         { chatId, chatName, chatType, chatMuted, message }
 *  - chat:status          { chatId, status }            (DELIVERED / READ)
 *  - chat:message-deleted { chatId, messageId }
 *  - chat:update          { chatId }                    (sinkron daftar chat)
 *  - chat:deleted         { chatId }
 */

import { createServer } from "http";
import { Server, type Socket } from "socket.io";

const PORT = 3004; // TETAP — jangan pakai env PORT
const NEXT_BASE = process.env.NEXT_BASE_URL ?? "http://127.0.0.1:3000";
const EMIT_SECRET =
  process.env.CHAT_REALTIME_SECRET ?? "indigoo-chat-rt-dev-secret";
const AUTH_TIMEOUT_MS = 15_000;

/** socket.id → true untuk klien browser yang lolos verifikasi token sesi. */
const authorized = new Set<string>();
/** socket.id → true untuk koneksi server (API Next.js) yang lolos secret. */
const trustedEmitters = new Set<string>();

// FIX Task 68: Gateway Caddy merutekan berdasarkan QUERY (?XTransformPort=3004),
// bukan path — path socket.io memakai standar "/socket.io/"; request non-socket.io
// diarahkan 302 ke "/" app utama (mencegah "Pretty Print" JSON).
const httpServer = createServer((req, res) => {
  res.writeHead(302, { Location: "/" });
  res.end();
});

const io = new Server(httpServer, {
  path: "/socket.io/", // standar — Caddy forward via ?XTransformPort=3004
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

/** Verifikasi token sesi ke aplikasi utama (sumber kebenaran auth). */
async function verifySessionToken(token: string): Promise<boolean> {
  try {
    const res = await fetch(`${NEXT_BASE}/api/auth/me`, {
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Siarkan event hanya ke klien browser terautentikasi. */
function broadcast(event: string, payload: unknown) {
  for (const s of io.sockets.sockets.values()) {
    if (!authorized.has(s.id)) continue;
    s.emit(event, payload);
  }
}

io.on("connection", (socket: Socket) => {
  console.log(`[chat-rt] connected: ${socket.id}`);

  // Timeout autentikasi — socket tanpa auth valid diputus
  const authTimer = setTimeout(() => {
    if (!authorized.has(socket.id) && !trustedEmitters.has(socket.id)) {
      socket.disconnect(true);
      console.log(`[chat-rt] auth timeout, diputus: ${socket.id}`);
    }
  }, AUTH_TIMEOUT_MS);

  // ---------- Handshake koneksi server (API Next.js) ----------
  socket.on("server:auth", (data: { secret?: string }) => {
    if (data && typeof data.secret === "string" && data.secret === EMIT_SECRET) {
      trustedEmitters.add(socket.id);
      clearTimeout(authTimer);
      socket.emit("server:ok");
      console.log(`[chat-rt] server emitter terdaftar: ${socket.id}`);
    } else {
      socket.emit("server:rejected", { reason: "secret salah" });
      socket.disconnect(true);
    }
  });

  // ---------- Broadcast dari API Next.js ----------
  socket.on("chat:broadcast", (data: { event?: string; payload?: unknown }) => {
    if (!trustedEmitters.has(socket.id)) return; // hanya emitter tepercaya
    const event = typeof data?.event === "string" ? data.event : "";
    if (!/^chat:[a-z-]+$/.test(event)) return;
    broadcast(event, data?.payload ?? null);
  });

  // ---------- Handshake klien browser ----------
  socket.on("auth", async (data: { token?: string }) => {
    const token = typeof data?.token === "string" ? data.token : "";
    if (!token) {
      socket.emit("auth:rejected", { reason: "token kosong" });
      return;
    }
    const ok = await verifySessionToken(token);
    if (ok) {
      authorized.add(socket.id);
      clearTimeout(authTimer);
      socket.emit("auth:ok");
      console.log(`[chat-rt] authorized: ${socket.id}`);
    } else {
      socket.emit("auth:rejected", { reason: "token tidak valid" });
      socket.disconnect(true);
    }
  });

  socket.on("disconnect", () => {
    clearTimeout(authTimer);
    authorized.delete(socket.id);
    trustedEmitters.delete(socket.id);
    console.log(`[chat-rt] disconnected: ${socket.id}`);
  });

  socket.on("error", (error) => {
    console.error(`[chat-rt] socket error (${socket.id}):`, error);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Chat realtime server running on port ${PORT}`);
});

process.on("SIGTERM", () => {
  console.log("Chat realtime server shutting down (SIGTERM)…");
  httpServer.close(() => process.exit(0));
});

process.on("SIGINT", () => {
  console.log("Chat realtime server shutting down (SIGINT)…");
  httpServer.close(() => process.exit(0));
});
