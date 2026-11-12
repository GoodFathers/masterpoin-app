// ===================== CALL SERVICE INDIIGOO =====================
// Mini-service signaling REALTIME untuk panggilan nyata (suara/video) dan
// konferensi mesh kecil. Port tetap: 3003 (diakses client lewat gateway
// Caddy memakai query `XTransformPort=3003` — JANGAN menulis port di URL).
//
// Tanggung jawab:
//  1. AUTH    : validasi token sesi IndiGoo dengan bertanya ke app utama
//               (GET http://localhost:3000/api/auth/me, header Bearer).
//  2. PRESENCE: daftar pengguna daring (per userId; multi-tab didukung).
//  3. CALL    : relay sinyal WebRTC invite/accept/reject/offer/answer/ICE/end
//               antar dua pengguna + timeout "tak dijawab" → MISSED.
//  4. CONF    : ruang konferensi mesh kecil (relay offer/answer/ICE antar
//               semua peserta; peer yang SUDAH di ruang membuat offer ke
//               pendatang baru — konvensi deterministik).
//
// Server TIDAK menyentuh media (audio/video) — murni signaling.

import { createServer } from "http";
import { Server, Socket } from "socket.io";

const PORT = 3003;
const MAIN_APP = "http://localhost:3000";
const RING_TIMEOUT_MS = 35_000; // invite tak dijawab → call:missed

// FIX Task 68: Gateway Caddy merutekan berdasarkan QUERY (?XTransformPort=3003),
// bukan path — jadi path socket.io harus standar "/socket.io/". Request non-socket.io
// yang nyasar ke port ini diarahkan 302 ke "/" app utama (mencegah "Pretty Print" JSON).
const httpServer = createServer((req, res) => {
  res.writeHead(302, { Location: "/" });
  res.end();
});
const io = new Server(httpServer, {
  path: "/socket.io/", // standar — Caddy forward via ?XTransformPort=3003
  cors: { origin: "*", methods: ["GET", "POST"] },
  pingTimeout: 60_000,
  pingInterval: 25_000,
  maxHttpBufferSize: 1e6,
});

// ---------- Tipe ----------
interface PeerUser {
  userId: string;
  accessId: string;
  username: string;
  role: string;
}
interface PresenceEntry extends PeerUser {
  sockets: Set<string>;
  at: number;
}
interface PendingCall {
  callId: string;
  from: PeerUser;
  to: PeerUser;
  kind: "VOICE" | "VIDEO";
  ts: number;
  state: "ringing" | "active";
  timer?: NodeJS.Timeout;
}
interface ConfRoom {
  roomId: string;
  members: Map<string, { userId: string; username: string; accessId: string }>; // socketId -> user
  createdAt: number;
}

const presence = new Map<string, PresenceEntry>(); // userId -> entry
const calls = new Map<string, PendingCall>(); // callId -> call
const confs = new Map<string, ConfRoom>(); // roomId -> room

const log = (...a: unknown[]) => console.log(new Date().toISOString(), ...a);

// ---------- Validasi token ke app utama (cache 60 dtk per token) ----------
const tokenCache = new Map<string, { user: PeerUser; exp: number }>();
const TOKEN_TTL = 60_000;

async function validateToken(token: string): Promise<PeerUser | null> {
  const hit = tokenCache.get(token);
  if (hit && hit.exp > Date.now()) return hit.user;
  try {
    const res = await fetch(`${MAIN_APP}/api/auth/me`, {
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      user?: { id?: string; accessId?: string; username?: string; role?: string };
      token?: string;
    };
    const u = data.user;
    if (!u?.id || !u?.accessId || !u?.username) return null;
    const peer: PeerUser = {
      userId: u.id,
      accessId: u.accessId,
      username: u.username,
      role: u.role ?? "USER",
    };
    tokenCache.set(token, { user: peer, exp: Date.now() + TOKEN_TTL });
    return peer;
  } catch (err) {
    log("validateToken gagal:", (err as Error).message);
    return null;
  }
}

// ---------- Presence helpers ----------
function peersList(): Array<PeerUser & { at: number }> {
  return Array.from(presence.values()).map((p) => ({
    userId: p.userId,
    accessId: p.accessId,
    username: p.username,
    role: p.role,
    at: p.at,
  }));
}

function joinPresence(socket: Socket, user: PeerUser) {
  const entry = presence.get(user.userId);
  if (entry) {
    entry.sockets.add(socket.id);
  } else {
    presence.set(user.userId, { ...user, sockets: new Set([socket.id]), at: Date.now() });
    socket.broadcast.emit("presence:update", peersList());
  }
  socket.data.user = user;
  socket.join(`user:${user.userId}`);
}

function leavePresence(socket: Socket): PeerUser | null {
  const user = socket.data.user as PeerUser | undefined;
  if (!user) return null;
  const entry = presence.get(user.userId);
  if (entry) {
    entry.sockets.delete(socket.id);
    if (entry.sockets.size === 0) {
      presence.delete(user.userId);
      socket.broadcast.emit("presence:update", peersList());
    }
  }
  return user;
}

// ---------- Call helpers ----------
function otherParty(call: PendingCall, userId: string): PeerUser | null {
  if (call.from.userId === userId) return call.to;
  if (call.to.userId === userId) return call.from;
  return null;
}

function clearCallTimer(call: PendingCall) {
  if (call.timer) {
    clearTimeout(call.timer);
    call.timer = undefined;
  }
}

function finishCall(callId: string) {
  const call = calls.get(callId);
  if (call) clearCallTimer(call);
  calls.delete(callId);
}

// ---------- Conf helpers ----------
function getOrCreateRoom(roomId: string): ConfRoom {
  let room = confs.get(roomId);
  if (!room) {
    room = { roomId, members: new Map(), createdAt: Date.now() };
    confs.set(roomId, room);
  }
  return room;
}

function leaveConf(socket: Socket) {
  const roomId = socket.data.confRoomId as string | undefined;
  if (!roomId) return;
  const room = confs.get(roomId);
  socket.data.confRoomId = undefined;
  if (!room) return;
  const meta = room.members.get(socket.id);
  room.members.delete(socket.id);
  socket.leave(`conf:${roomId}`);
  socket.to(`conf:${roomId}`).emit("conf:peer-left", { roomId, peerSocketId: socket.id, user: meta ?? null });
  if (room.members.size === 0) confs.delete(roomId);
  log(`conf ${roomId}: ${meta?.username ?? socket.id} keluar (sisa ${room.members.size})`);
}

// ---------- Socket handlers ----------
io.on("connection", (socket) => {
  log("connect:", socket.id);

  // ---- AUTH wajib sebelum event lain ----
  socket.on("auth", async ({ token }: { token?: string }, ack?: (r: unknown) => void) => {
    if (!token) {
      ack?.({ ok: false, error: "token wajib" });
      return;
    }
    const user = await validateToken(token);
    if (!user) {
      ack?.({ ok: false, error: "sesi tidak valid" });
      return;
    }
    joinPresence(socket, user);
    ack?.({ ok: true, user, peers: peersList() });
    log(`auth: ${user.username} (${user.accessId}) via ${socket.id} — daring: ${presence.size}`);
  });

  // ================= PANGGILAN 1-ON-1 =================
  socket.on("call:invite", (p: { callId?: string; to?: string; kind?: string }, ack?: (r: unknown) => void) => {
    const me = socket.data.user as PeerUser | undefined;
    if (!me) return ack?.({ ok: false, error: "belum auth" });
    const callId = typeof p.callId === "string" ? p.callId : "";
    const toId = typeof p.to === "string" ? p.to : "";
    const kind = p.kind === "VIDEO" ? "VIDEO" : "VOICE";
    if (!callId || !toId) return ack?.({ ok: false, error: "callId & to wajib" });
    if (toId === me.userId) return ack?.({ ok: false, error: "tidak bisa menelepon diri sendiri" });
    const target = presence.get(toId);
    if (!target) return ack?.({ ok: false, error: "Pengguna tidak daring" });

    // Satu panggilan aktif per pengguna (caller tidak boleh menelpon 2 orang)
    for (const c of calls.values()) {
      if (c.from.userId === me.userId || c.to.userId === me.userId) {
        return ack?.({ ok: false, error: "Ada panggilan yang sedang berjalan" });
      }
    }

    const call: PendingCall = {
      callId,
      from: me,
      to: { userId: target.userId, accessId: target.accessId, username: target.username, role: target.role },
      kind,
      ts: Date.now(),
      state: "ringing",
    };
    calls.set(callId, call);
    call.timer = setTimeout(() => {
      const c = calls.get(callId);
      if (!c || c.state !== "ringing") return;
      io.to(`user:${c.from.userId}`).emit("call:missed", {
        callId,
        peer: c.to,
        kind: c.kind,
        reason: "no-answer",
      });
      io.to(`user:${c.to.userId}`).emit("call:missed", {
        callId,
        peer: c.from,
        kind: c.kind,
        reason: "missed-your-call",
      });
      finishCall(callId);
      log(`call ${callId}: timeout (tidak dijawab)`);
    }, RING_TIMEOUT_MS);

    io.to(`user:${toId}`).emit("call:invite", {
      callId,
      from: call.from,
      kind,
      at: call.ts,
    });
    ack?.({ ok: true });
    log(`call ${callId}: ${me.username} → ${target.username} (${kind})`);
  });

  socket.on("call:cancel", ({ callId }: { callId?: string }) => {
    const me = socket.data.user as PeerUser | undefined;
    const call = callId ? calls.get(callId) : undefined;
    if (!me || !call || call.from.userId !== me.userId) return;
    io.to(`user:${call.to.userId}`).emit("call:cancelled", { callId });
    finishCall(call.callId);
    log(`call ${callId}: dibatalkan penelepon`);
  });

  socket.on("call:accept", ({ callId }: { callId?: string }) => {
    const me = socket.data.user as PeerUser | undefined;
    const call = callId ? calls.get(callId) : undefined;
    if (!me || !call || call.to.userId !== me.userId) return;
    clearCallTimer(call);
    call.state = "active";
    io.to(`user:${call.from.userId}`).emit("call:accepted", { callId });
    log(`call ${callId}: diterima oleh ${me.username}`);
  });

  socket.on("call:reject", ({ callId }: { callId?: string }) => {
    const me = socket.data.user as PeerUser | undefined;
    const call = callId ? calls.get(callId) : undefined;
    if (!me || !call || call.to.userId !== me.userId) return;
    io.to(`user:${call.from.userId}`).emit("call:rejected", { callId });
    finishCall(call.callId);
    log(`call ${callId}: ditolak`);
  });

  // Relay SDP/ICE — hanya peserta panggilan, panggilan harus masih ada
  const relay = (event: "call:offer" | "call:answer" | "call:ice") =>
    (p: { callId?: string; sdp?: unknown; candidate?: unknown }) => {
      const me = socket.data.user as PeerUser | undefined;
      const call = p.callId ? calls.get(p.callId) : undefined;
      if (!me || !call) return;
      const target = otherParty(call, me.userId);
      if (!target) return;
      io.to(`user:${target.userId}`).emit(event, {
        callId: call.callId,
        ...(event === "call:ice" ? { candidate: p.candidate } : { sdp: p.sdp }),
      });
    };
  socket.on("call:offer", relay("call:offer"));
  socket.on("call:answer", relay("call:answer"));
  socket.on("call:ice", relay("call:ice"));

  socket.on("call:end", ({ callId, reason }: { callId?: string; reason?: string }) => {
    const me = socket.data.user as PeerUser | undefined;
    const call = callId ? calls.get(callId) : undefined;
    if (!me || !call) return;
    const target = otherParty(call, me.userId);
    if (target) io.to(`user:${target.userId}`).emit("call:ended", { callId, reason: reason ?? "hangup" });
    finishCall(call.callId);
    log(`call ${callId}: selesai (${reason ?? "hangup"}) oleh ${me.username}`);
  });

  // ================= KONFERENSI (mesh kecil) =================
  socket.on("conf:join", (p: { roomId?: string }, ack?: (r: unknown) => void) => {
    const me = socket.data.user as PeerUser | undefined;
    if (!me) return ack?.({ ok: false, error: "belum auth" });
    const roomId = typeof p.roomId === "string" ? p.roomId.slice(0, 64) : "";
    if (!roomId) return ack?.({ ok: false, error: "roomId wajib" });

    leaveConf(socket); // pindah ruang = keluar dulu
    const room = getOrCreateRoom(roomId);
    const existing = Array.from(room.members.entries()).map(([peerSocketId, u]) => ({
      peerSocketId,
      userId: u.userId,
      username: u.username,
      accessId: u.accessId,
    }));
    room.members.set(socket.id, { userId: me.userId, username: me.username, accessId: me.accessId });
    socket.join(`conf:${roomId}`);
    socket.data.confRoomId = roomId;

    // Kabari anggota lama: peer baru bergabung (MEREKA yang membuat offer)
    socket.to(`conf:${roomId}`).emit("conf:peer-joined", {
      roomId,
      peerSocketId: socket.id,
      userId: me.userId,
      username: me.username,
      accessId: me.accessId,
    });
    ack?.({ ok: true, roomId, peers: existing });
    log(`conf ${roomId}: ${me.username} gabung (${room.members.size} peserta)`);
  });

  socket.on("conf:leave", () => leaveConf(socket));

  socket.on(
    "conf:relay",
    (p: { roomId?: string; toPeer?: string; kind?: string; payload?: unknown }) => {
      const me = socket.data.user as PeerUser | undefined;
      const roomId = socket.data.confRoomId as string | undefined;
      if (!me || !roomId || roomId !== p.roomId) return;
      if (!p.toPeer || (p.kind !== "offer" && p.kind !== "answer" && p.kind !== "ice")) return;
      io.to(p.toPeer).emit("conf:relay", {
        roomId,
        fromPeer: socket.id,
        fromUser: { userId: me.userId, username: me.username },
        kind: p.kind,
        payload: p.payload,
      });
    }
  );

  socket.on("conf:invite", (p: { to?: string; roomId?: string }) => {
    const me = socket.data.user as PeerUser | undefined;
    const roomId = socket.data.confRoomId as string | undefined;
    if (!me || !roomId || !p.to || roomId !== p.roomId) return;
    io.to(`user:${p.to}`).emit("conf:invite", {
      roomId,
      from: { userId: me.userId, username: me.username, accessId: me.accessId },
    });
  });

  // ================= DISCONNECT =================
  socket.on("disconnect", () => {
    const user = leavePresence(socket);
    // Bersihkan panggilan menggantung yang melibatkan pengguna ini
    for (const call of Array.from(calls.values())) {
      if (!user) break;
      if (call.from.userId === user.userId || call.to.userId === user.userId) {
        const other = otherParty(call, user.userId);
        if (other) {
          io.to(`user:${other.userId}`).emit("call:ended", { callId: call.callId, reason: "peer-disconnect" });
        }
        finishCall(call.callId);
      }
    }
    leaveConf(socket);
    log("disconnect:", socket.id, user?.username ?? "");
  });
});

httpServer.listen(PORT, () => {
  log(`Call Service (signaling) berjalan di port ${PORT}`);
});

// Guard proses: catat error tak tertangkap tanpa mati
process.on("uncaughtException", (err) => log("uncaughtException:", err.message));
process.on("unhandledRejection", (err) => log("unhandledRejection:", (err as Error)?.message));
