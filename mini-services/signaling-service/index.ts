/**
 * Signaling service — WebRTC signaling (socket.io) untuk panggilan suara/video
 * WA Bisnis Panel — Toko Berkah Jaya.
 *
 * PORT TETAP 3003 (diteruskan gateway Caddy via query ?XTransformPort=3003).
 * Path socket.io "/" (menerima request di path apa pun) — pola sama dengan
 * examples/websocket/server.ts.
 *
 * Alur signaling (1 panggilan aktif global):
 *  caller → call:offer  → server simpan offer + broadcast ring:incoming ke tab lain
 *  callee → call:accept → server kirim call:offer (tersembunyi/target) ke callee
 *  callee → call:answer → server teruskan ke caller + flush buffer ICE caller
 *  keduanya → call:ice  → server teruskan ke peserta lain (buffer bila belum siap)
 *  callee → call:decline → caller menerima call:declined
 *  peserta → call:end    → peserta lain menerima call:ended
 *  timeout ring 32 dtk   → caller: call:timeout, tab lain: ring:cancelled
 */

import { createServer } from "http";
import { Server, type Socket } from "socket.io";

const PORT = 3003; // TETAP — jangan pakai env PORT

type Kind = "VOICE" | "VIDEO";

interface CallState {
  callId: string;
  kind: Kind;
  callerName: string; // businessName (pemanggil = pemilik toko)
  contactName: string;
  contactId: string | null;
  colorKey: string | null;
  avatarUrl: string | null;
  callerSocketId: string;
  callerClientId: string | null;
  offer: unknown;
  calleeSocketId: string | null;
  answered: boolean;
  callerCandidates: unknown[];
  calleeCandidates: unknown[];
  ringTimer: ReturnType<typeof setTimeout> | null;
}

let activeCall: CallState | null = null;
/** socket.id → clientId (unik per tab, via event register) */
const clientIdBySocket = new Map<string, string>();

const httpServer = createServer();

const io = new Server(httpServer, {
  // DO NOT change the path, it is used by Caddy to forward the request to the correct port
  path: "/",
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

const randId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/** Semua socket terdaftar KECUALI caller (socket & clientId-nya) dan opsional satu socket lain. */
function othersExcept(callerSocketId: string, callerClientId: string | null, alsoExcept?: string): Socket[] {
  const list: Socket[] = [];
  for (const s of io.sockets.sockets.values()) {
    if (s.id === callerSocketId) continue;
    if (alsoExcept && s.id === alsoExcept) continue;
    const cid = clientIdBySocket.get(s.id) ?? null;
    if (callerClientId && cid === callerClientId) continue;
    list.push(s);
  }
  return list;
}

function stopRingTimer(call: CallState) {
  if (call.ringTimer) {
    clearTimeout(call.ringTimer);
    call.ringTimer = null;
  }
}

function broadcastRingCancelled(call: CallState, reason: string, alsoExcept?: string) {
  for (const s of othersExcept(call.callerSocketId, call.callerClientId, alsoExcept)) {
    s.emit("ring:cancelled", { callId: call.callId, reason });
  }
}

io.on("connection", (socket) => {
  console.log(`[signaling] connected: ${socket.id}`);

  socket.on("register", (data: { clientId?: string }) => {
    if (data && typeof data.clientId === "string") {
      clientIdBySocket.set(socket.id, data.clientId);
    }
  });

  // ---------- Caller memulai panggilan ----------
  socket.on(
    "call:offer",
    (payload: {
      callId?: string;
      offer?: unknown;
      kind?: string;
      callerName?: string;
      contactName?: string;
      contactId?: string | null;
      colorKey?: string | null;
      avatarUrl?: string | null;
    }) => {
      if (activeCall) {
        socket.emit("call:busy", { callId: String(payload?.callId ?? ""), reason: "busy" });
        return;
      }

      const call: CallState = {
        callId: String(payload?.callId || randId()),
        kind: payload?.kind === "VIDEO" ? "VIDEO" : "VOICE",
        callerName: String(payload?.callerName || "Toko Berkah Jaya"),
        contactName: String(payload?.contactName || "Pelanggan"),
        contactId: typeof payload?.contactId === "string" ? payload.contactId : null,
        colorKey: typeof payload?.colorKey === "string" ? payload.colorKey : null,
        avatarUrl: typeof payload?.avatarUrl === "string" ? payload.avatarUrl : null,
        callerSocketId: socket.id,
        callerClientId: clientIdBySocket.get(socket.id) ?? null,
        offer: payload?.offer ?? null,
        calleeSocketId: null,
        answered: false,
        callerCandidates: [],
        calleeCandidates: [],
        ringTimer: null,
      };
      activeCall = call;

      // Timeout dering: server adalah sumber kebenaran (32 dtk; klien ringer pakai 30 dtk)
      call.ringTimer = setTimeout(() => {
        if (activeCall !== call || call.answered || call.calleeSocketId) return;
        activeCall = null;
        stopRingTimer(call);
        const caller = io.sockets.sockets.get(call.callerSocketId);
        if (caller) caller.emit("call:timeout", { callId: call.callId, reason: "timeout" });
        broadcastRingCancelled(call, "timeout");
        console.log(`[signaling] ring timeout call=${call.callId}`);
      }, 32_000);

      // Dering masuk ke semua tab lain (kecuali tab pemanggil — clientIdsama)
      for (const s of othersExcept(socket.id, call.callerClientId)) {
        s.emit("ring:incoming", {
          callId: call.callId,
          kind: call.kind,
          callerName: call.callerName,
          contactName: call.contactName,
          contactId: call.contactId,
          colorKey: call.colorKey,
          avatarUrl: call.avatarUrl,
        });
      }
      console.log(`[signaling] call:offer call=${call.callId} kind=${call.kind} from=${socket.id}`);
    }
  );

  // ---------- Callee menerima ----------
  socket.on("call:accept", (data: { callId?: string }) => {
    const call = activeCall;
    if (!call || !data || call.callId !== String(data.callId ?? "")) {
      socket.emit("call:ended", { callId: String(data?.callId ?? ""), reason: "gone" });
      return;
    }
    if (call.calleeSocketId && call.calleeSocketId !== socket.id) {
      socket.emit("call:ended", { callId: call.callId, reason: "answered-elsewhere" });
      return;
    }
    call.calleeSocketId = socket.id;
    stopRingTimer(call);
    // Kirim offer tersimpan ke callee (target)
    socket.emit("call:offer", { callId: call.callId, offer: call.offer });
    // Tab lain yang masih mendengarkan dering → hentikan
    broadcastRingCancelled(call, "answered", socket.id);
    console.log(`[signaling] call:accept call=${call.callId} callee=${socket.id}`);
  });

  // ---------- Callee menjawab ----------
  socket.on("call:answer", (data: { callId?: string; answer?: unknown }) => {
    const call = activeCall;
    if (!call || !data || call.callId !== String(data.callId ?? "")) return;
    if (call.calleeSocketId !== socket.id) return;
    call.answered = true;
    io.to(call.callerSocketId).emit("call:answer", { callId: call.callId, answer: data.answer });
    // Flush kandidat ICE caller yang terbuffer sebelum callee siap
    for (const c of call.callerCandidates) {
      io.to(socket.id).emit("call:ice", { callId: call.callId, candidate: c });
    }
    call.callerCandidates = [];
    console.log(`[signaling] call:answer call=${call.callId}`);
  });

  // ---------- ICE candidate (dua arah, dengan buffer) ----------
  socket.on("call:ice", (data: { callId?: string; candidate?: unknown }) => {
    const call = activeCall;
    if (!call || !data || call.callId !== String(data.callId ?? "")) return;
    const candidate = data.candidate;
    if (!candidate) return;
    if (socket.id === call.callerSocketId) {
      if (call.answered && call.calleeSocketId) {
        io.to(call.calleeSocketId).emit("call:ice", { callId: call.callId, candidate });
      } else {
        call.callerCandidates.push(candidate);
      }
    } else if (socket.id === call.calleeSocketId) {
      if (call.answered) {
        io.to(call.callerSocketId).emit("call:ice", { callId: call.callId, candidate });
      } else {
        call.calleeCandidates.push(candidate);
      }
    }
  });

  // ---------- Callee menolak ----------
  socket.on("call:decline", (data: { callId?: string }) => {
    const call = activeCall;
    if (!call || !data || call.callId !== String(data.callId ?? "")) return;
    if (call.calleeSocketId === socket.id) return; // sudah menerima — gunakan call:end
    activeCall = null;
    stopRingTimer(call);
    const caller = io.sockets.sockets.get(call.callerSocketId);
    if (caller) caller.emit("call:declined", { callId: call.callId, reason: "declined" });
    broadcastRingCancelled(call, "declined");
    console.log(`[signaling] call:decline call=${call.callId}`);
  });

  // ---------- Akhiri panggilan (dari caller atau callee) ----------
  socket.on("call:end", (data: { callId?: string }) => {
    const call = activeCall;
    if (!call || !data || call.callId !== String(data.callId ?? "")) return;
    activeCall = null;
    stopRingTimer(call);
    if (socket.id === call.callerSocketId) {
      if (call.calleeSocketId) {
        io.to(call.calleeSocketId).emit("call:ended", { callId: call.callId, reason: "ended" });
      } else {
        broadcastRingCancelled(call, "ended");
      }
    } else {
      io.to(call.callerSocketId).emit("call:ended", { callId: call.callId, reason: "ended" });
    }
    console.log(`[signaling] call:end call=${call.callId} by=${socket.id}`);
  });

  socket.on("disconnect", () => {
    clientIdBySocket.delete(socket.id);
    const call = activeCall;
    if (call && (call.callerSocketId === socket.id || call.calleeSocketId === socket.id)) {
      activeCall = null;
      stopRingTimer(call);
      if (call.callerSocketId === socket.id) {
        const callee = call.calleeSocketId ? io.sockets.sockets.get(call.calleeSocketId) : null;
        if (callee) callee.emit("call:ended", { callId: call.callId, reason: "ended" });
        broadcastRingCancelled(call, "ended");
      } else {
        const caller = io.sockets.sockets.get(call.callerSocketId);
        if (caller) caller.emit("call:ended", { callId: call.callId, reason: "ended" });
      }
      console.log(`[signaling] participant disconnected call=${call.callId}`);
    }
    console.log(`[signaling] disconnected: ${socket.id}`);
  });

  socket.on("error", (error) => {
    console.error(`[signaling] socket error (${socket.id}):`, error);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
});

process.on("SIGTERM", () => {
  console.log("Signaling server shutting down (SIGTERM)…");
  httpServer.close(() => process.exit(0));
});

process.on("SIGINT", () => {
  console.log("Signaling server shutting down (SIGINT)…");
  httpServer.close(() => process.exit(0));
});
