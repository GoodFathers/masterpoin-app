"use client";
// ===================== MESIN PANGGILAN NYATA INDIIGOO =====================
// Client-side singleton untuk panggilan suara & video NYATA antar pengguna
// IndiGoo (WebRTC) + keanggotaan realtime via signaling socket.io
// (mini-services/call-service, diakses lewat "/?XTransformPort=3003").
//
// Tanggung jawab:
//  - Koneksi socket + auth token sesi + presence (siapa yang daring).
//  - Siklus hidup panggilan 1-on-1: invite → ring → accept/reject/missed →
//    offer/answer/ICE → aktif (timer) → end, termasuk fallback audio-only
//    bila kamera tidak tersedia, dan pembersihan resource yang aman.
//  - Menyimpan riwayat panggilan ke /api/calls (OUT utk penelepon, IN utk
//    penerima, MISSED bila tak dijawab).
//  - Konferensi mesh kecil: join/leave ruangan + relay offer/answer/ICE.
//
// Semua state tampilan hidup di store Zustand (src/store/realcall.ts) —
// mesin ini yang menuliskannya. UI (RealCallCenter) hanya membaca & memanggil
// aksi mesin. Server signaling TIDAK pernah menyentuh media.

import type { Socket } from "socket.io-client";
import {
  playCallEndTone,
  startIncomingRing,
  startRingback,
  stopIncomingRing,
  stopRingback,
} from "@/lib/alarm";
import { getSessionToken } from "@/lib/session-token";
import { useRealcallStore, type CallKind, type PeerInfo, type CallPhase } from "@/store/realcall";

const SIGNAL_URL = "/?XTransformPort=3003";
// FIX Task 68: STUN Google + TURN openrelay — relay fallback agar ICE tetap
// tersambung pada NAT/jaringan ketat (panggilan tak menggantung di "Menyambungkan…").
const ICE_SERVERS: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
  { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" },
  { urls: "turn:openrelay.metered.ca:443?transport=tcp", username: "openrelayproject", credential: "openrelayproject" },
];
// Batas waktu ICE: gagal cepat (14 dtk) + watchdog diagnostik (45 dtk)
const ICE_CONNECT_TIMEOUT_MS = 14_000;
const ICE_WATCHDOG_MS = 45_000;

export interface ActiveCall {
  callId: string;
  role: "caller" | "callee";
  peer: PeerInfo;
  kind: CallKind;
  phase: CallPhase; // ringing | connecting | active
  startedAt: number | null; // aktif sejak (epoch ms)
  videoFallback: boolean; // video diminta tapi kamera tak tersedia → audio-only
  muted: boolean;
  camOff: boolean;
}

class RealCallEngine {
  private socket: Socket | null = null;
  private connecting = false;
  private generation = 0; // penanda siklus connect/disconnect (anti race StrictMode)

  // WebRTC (1-on-1)
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private call: ActiveCall | null = null;
  private queuedCandidates: RTCIceCandidateInit[] = [];
  private makingOffer = false;
  private iceTimer: ReturnType<typeof setTimeout> | null = null;
  private iceWatchdogTimer: ReturnType<typeof setTimeout> | null = null;
  private iceStartedAt: number | null = null;

  // Konferensi mesh
  private confRoomId: string | null = null;
  private confPeers = new Map<string, RTCPeerConnection>(); // peerSocketId -> pc
  private confStreams = new Map<string, MediaStream>(); // peerSocketId -> remote
  private confLocalStream: MediaStream | null = null;

  /** Fallback media sintetis untuk lingkungan tanpa kamera/mik (sandbox/E2E). */
  static syntheticRequested = false;

  // ---------------- KONEKSI & PRESENCE ----------------

  ensureConnected(): void {
    if (typeof window === "undefined" || this.socket || this.connecting) return;
    const token = getSessionToken();
    if (!token) return; // belum login — jangan buka koneksi
    this.connecting = true;
    const gen = this.generation;

    void import("socket.io-client").then(({ io }) => {
      if (gen !== this.generation) return; // sudah di-disconnect saat import berjalan
      const s = io(SIGNAL_URL, {
        path: "/socket.io/", // FIX Task 68: Caddy merutekan via QUERY, path harus standar
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: 8,
        reconnectionDelay: 1200,
        timeout: 10000,
      });
      this.socket = s;

      s.on("connect", () => {
        s.emit("auth", { token }, (res: { ok: boolean; user?: PeerInfo; peers?: PeerInfo[]; error?: string }) => {
          this.connecting = false;
          const st = useRealcallStore.getState();
          if (!res?.ok || !res.user) {
            st.setConn("error");
            return;
          }
          st.setMe(res.user);
          st.setPeers(res.peers ?? []);
          st.setConn("connected");
        });
      });

      s.on("disconnect", () => {
        useRealcallStore.getState().setConn("connecting");
      });

      s.on("presence:update", (peers: PeerInfo[]) => {
        useRealcallStore.getState().setPeers(peers ?? []);
      });

      // ---------------- panggilan masuk ----------------
      s.on("call:invite", (p: { callId: string; from: PeerInfo; kind: CallKind }) => {
        const st = useRealcallStore.getState();
        if (this.call || st.incoming) {
          // sibuk — tolak otomatis
          s.emit("call:reject", { callId: p.callId });
          return;
        }
        st.setIncoming({ callId: p.callId, from: p.from, kind: p.kind, at: Date.now() });
        startIncomingRing();
      });

      s.on("call:cancelled", ({ callId }: { callId: string }) => {
        const st = useRealcallStore.getState();
        if (st.incoming?.callId === callId) {
          st.setIncoming(null);
          stopIncomingRing();
          playCallEndTone("end");
        }
      });

      s.on("call:missed", (p: { callId: string; reason: string }) => {
        // Dipanggil di KEDUA sisi saat timeout
        const st = useRealcallStore.getState();
        const wasCaller = this.call?.role === "caller" && this.call.callId === p.callId;
        st.setIncoming(null);
        stopIncomingRing();
        stopRingback();
        playCallEndTone("busy");
        if (this.call && this.call.callId === p.callId) {
          this.saveHistory(wasCaller ? "OUT" : "MISSED", 0);
          this.cleanupCall();
        }
      });

      s.on("call:rejected", ({ callId }: { callId: string }) => {
        if (this.call?.callId === callId && this.call.role === "caller") {
          stopRingback();
          playCallEndTone("busy");
          this.saveHistory("OUT", 0); // panggilan keluar, tidak tersambung
          this.cleanupCall();
        }
      });

      s.on("call:accepted", ({ callId }: { callId: string }) => {
        if (this.call?.callId === callId && this.call.role === "caller") {
          stopRingback();
          void this.startMediaAndOffer();
        }
      });

      s.on("call:offer", ({ callId, sdp }: { callId: string; sdp: RTCSessionDescriptionInit }) => {
        void this.handleOffer(callId, sdp);
      });

      s.on("call:answer", ({ callId, sdp }: { callId: string; sdp: RTCSessionDescriptionInit }) => {
        void this.handleAnswer(callId, sdp);
      });

      s.on("call:ice", ({ callId, candidate }: { callId: string; candidate: RTCIceCandidateInit }) => {
        void this.handleCandidate(callId, candidate);
      });

      s.on("call:ended", ({ callId, reason }: { callId: string; reason?: string }) => {
        if (this.call?.callId === callId) {
          const dur = this.call.phase === "active" && this.call.startedAt ? Math.round((Date.now() - this.call.startedAt) / 1000) : 0;
          stopRingback();
          playCallEndTone("end");
          if (this.call.role === "callee" && dur === 0 && reason !== "hangup") {
            this.saveHistory("MISSED", 0);
          } else {
            this.saveHistory(this.call.role === "caller" ? "OUT" : "IN", dur);
          }
          this.cleanupCall();
        }
      });

      // ---------------- konferensi ----------------
      s.on("conf:peer-joined", (p: { roomId: string; peerSocketId: string; userId: string; username: string; accessId: string }) => {
        void this.confCreateOfferTo(p.peerSocketId, { userId: p.userId, username: p.username, accessId: p.accessId });
      });

      s.on("conf:peer-left", ({ peerSocketId }: { peerSocketId: string }) => {
        this.confClosePeer(peerSocketId);
        useRealcallStore.getState().removeConfStream(peerSocketId);
      });

      s.on("conf:relay", (p: { fromPeer: string; fromUser?: { userId: string; username: string }; kind: "offer" | "answer" | "ice"; payload: unknown }) => {
        void this.confHandleRelay(p);
      });

      s.on("conf:invite", (p: { roomId: string; from: PeerInfo }) => {
        // Abaikan bila sedang sibuk (panggilan 1-on-1 atau sudah di konferensi)
        const st = useRealcallStore.getState();
        if (this.call || st.confActive) return;
        st.setConfInvite({ roomId: p.roomId, from: p.from });
      });

      s.io.on("reconnect", () => {
        // reconnect → auth ulang
        s.emit("auth", { token: getSessionToken() }, () => undefined);
      });
    });
  }

  disconnect(): void {
    this.generation++;
    this.connecting = false;
    this.end("logout");
    this.leaveConf();
    this.socket?.disconnect();
    this.socket = null;
    const st = useRealcallStore.getState();
    st.reset();
  }

  private emit(event: string, payload?: unknown): boolean {
    if (!this.socket?.connected) return false;
    this.socket.emit(event, payload);
    return true;
  }

  // ---------------- PANGGILAN 1-ON-1 ----------------

  /** Mulai panggilan keluar (penelepon). */
  invite(peer: PeerInfo, kind: CallKind): { ok: boolean; error?: string } {
    if (this.call) return { ok: false, error: "Ada panggilan yang sedang berjalan" };
    const st = useRealcallStore.getState();
    if (st.incoming) return { ok: false, error: "Ada panggilan masuk yang belum direspon" };
    const callId = `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
    this.call = {
      callId,
      role: "caller",
      peer,
      kind,
      phase: "ringing",
      startedAt: null,
      videoFallback: false,
      muted: false,
      camOff: false,
    };
    st.setCall(this.call);
    startRingback();
    const sent = this.emit("call:invite", { callId, to: peer.userId, kind });
    if (!sent) {
      stopRingback();
      this.cleanupCall();
      return { ok: false, error: "Tidak terhubung ke server realtime" };
    }
    return { ok: true };
  }

  /** Penerima menekan terima. */
  accept(): void {
    const st = useRealcallStore.getState();
    const inc = st.incoming;
    if (!inc) return;
    stopIncomingRing();
    this.call = {
      callId: inc.callId,
      role: "callee",
      peer: inc.from,
      kind: inc.kind,
      phase: "connecting",
      startedAt: null,
      videoFallback: false,
      muted: false,
      camOff: false,
    };
    st.setIncoming(null);
    st.setCall(this.call);
    this.emit("call:accept", { callId: inc.callId });
    // Media + answer dibuat saat offer dari caller tiba (handleOffer)
  }

  /** Penerima menolak. */
  reject(): void {
    const st = useRealcallStore.getState();
    const inc = st.incoming;
    if (!inc) return;
    stopIncomingRing();
    st.setIncoming(null);
    this.emit("call:reject", { callId: inc.callId });
    playCallEndTone("end");
  }

  /** Akhiri panggilan dari sisi mana pun. */
  end(reason: string = "hangup"): void {
    if (!this.call) {
      // masih dering masuk tapi belum accept → anggap tolak
      this.reject();
      return;
    }
    const call = this.call;
    const dur = call.phase === "active" && call.startedAt ? Math.round((Date.now() - call.startedAt) / 1000) : 0;
    this.emit("call:end", { callId: call.callId, reason });
    stopRingback();
    stopIncomingRing();
    playCallEndTone("end");
    this.saveHistory(call.role === "caller" ? "OUT" : dur > 0 ? "IN" : "MISSED", dur);
    this.cleanupCall();
  }

  toggleMute(): void {
    if (!this.call || !this.localStream) return;
    const next = !this.call.muted;
    for (const t of this.localStream.getAudioTracks()) t.enabled = !next;
    this.call = { ...this.call, muted: next };
    useRealcallStore.getState().setCall(this.call);
  }

  async toggleCamera(): Promise<void> {
    if (!this.call || this.call.kind !== "VIDEO" || !this.localStream) return;
    const next = !this.call.camOff;
    try {
      if (next) {
        for (const t of this.localStream.getVideoTracks()) t.enabled = false;
      } else {
        for (const t of this.localStream.getVideoTracks()) t.enabled = true;
      }
      this.call = { ...this.call, camOff: next };
      useRealcallStore.getState().setCall(this.call);
    } catch {
      // abaikan
    }
  }

  /** (Penelepon) setelah di-accept: ambil media, buat PC, kirim offer. */
  private async startMediaAndOffer(): Promise<void> {
    if (!this.call || this.call.role !== "caller") return;
    this.setPhase("connecting");
    const ok = await this.setupLocalMedia(this.call.kind);
    if (!ok || !this.call) return;
    await this.createPeer();
    if (!this.pc || !this.localStream) return;
    for (const t of this.localStream.getTracks()) this.pc.addTrack(t, this.localStream);
    try {
      this.makingOffer = true;
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);
      this.emit("call:offer", { callId: this.call.callId, sdp: this.pc.localDescription });
    } catch {
      this.failCall("Gagal menyiapkan koneksi");
    } finally {
      this.makingOffer = false;
    }
  }

  /** (Penerima) offer tiba → ambil media, jawab. */
  private async handleOffer(callId: string, sdp: RTCSessionDescriptionInit): Promise<void> {
    if (!this.call || this.call.callId !== callId || this.call.role !== "callee") return;
    this.setPhase("connecting");
    const ok = await this.setupLocalMedia(this.call.kind);
    if (!ok || !this.call) return;
    await this.createPeer();
    if (!this.pc) return;
    try {
      await this.pc.setRemoteDescription(new RTCSessionDescription(sdp));
      for (const t of this.localStream?.getTracks() ?? []) this.pc.addTrack(t, this.localStream!);
      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);
      this.emit("call:answer", { callId, sdp: this.pc.localDescription });
      for (const c of this.queuedCandidates) await this.pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => undefined);
      this.queuedCandidates = [];
    } catch {
      this.failCall("Gagal menjawab panggilan");
    }
  }

  private async handleAnswer(callId: string, sdp: RTCSessionDescriptionInit): Promise<void> {
    if (!this.pc || !this.call || this.call.callId !== callId) return;
    try {
      await this.pc.setRemoteDescription(new RTCSessionDescription(sdp));
      for (const c of this.queuedCandidates) await this.pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => undefined);
      this.queuedCandidates = [];
    } catch {
      this.failCall("Negosiasi koneksi gagal");
    }
  }

  private async handleCandidate(callId: string, candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.call || this.call.callId !== callId) return;
    if (!this.pc || !this.pc.remoteDescription) {
      this.queuedCandidates.push(candidate);
      return;
    }
    await this.pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => undefined);
  }

  /** Ambil mic (+ kamera utk VIDEO). Gagal kamera → audio-only (videoFallback). */
  private async setupLocalMedia(kind: CallKind): Promise<boolean> {
    if (this.localStream) return true;
    const wantVideo = kind === "VIDEO";
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: wantVideo ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" } : false,
      });
      useRealcallStore.getState().setLocalStream(this.localStream);
      return true;
    } catch {
      if (wantVideo) {
        try {
          this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          if (this.call) {
            this.call = { ...this.call, videoFallback: true, kind: "VOICE" };
            useRealcallStore.getState().setCall(this.call);
          }
          useRealcallStore.getState().setLocalStream(this.localStream);
          return true;
        } catch {
          this.failCall("Mikrofon & kamera tidak dapat diakses — izinkan akses di browser.");
          return false;
        }
      }
      this.failCall("Mikrofon tidak dapat diakses — izinkan akses mikrofon di browser.");
      return false;
    }
  }

  private createPeer(): Promise<void> {
    return new Promise((resolve) => {
      if (this.pc) return resolve();
      const pc = new RTCPeerConnection({
        iceServers: ICE_SERVERS,
        iceCandidatePoolSize: 4,
      });
      this.pc = pc;
      this.remoteStream = new MediaStream();
      this.armIceWatchdog(pc);

      pc.ontrack = (ev) => {
        for (const track of ev.streams[0]?.getTracks() ?? [ev.track]) {
          if (!this.remoteStream?.getTracks().some((t) => t.id === track.id)) {
            this.remoteStream?.addTrack(track);
          }
        }
        useRealcallStore.getState().setRemoteStream(this.remoteStream);
      };
      pc.onicecandidate = (ev) => {
        if (ev.candidate && this.call) {
          this.emit("call:ice", { callId: this.call.callId, candidate: ev.candidate.toJSON() });
        }
      };
      pc.onconnectionstatechange = () => {
        if (!this.call) return;
        if (pc.connectionState === "connected") {
          this.disarmIceWatchdog();
          void this.logConnectionDetail(pc, "connected");
          this.setPhase("active");
          if (this.call.startedAt === null) {
            this.call = { ...this.call, startedAt: Date.now() };
            useRealcallStore.getState().setCall(this.call);
          }
        } else if (pc.connectionState === "failed") {
          this.disarmIceWatchdog();
          void this.logConnectionDetail(pc, "failed");
          this.failCall("Koneksi media gagal (jaringan)");
        }
      };
      resolve();
    });
  }

  /**
   * FIX Task 68: watchdog koneksi ICE.
   *  - Timer pendek (ICE_CONNECT_TIMEOUT_MS): bila ICE belum "connected",
   *    panggilan gagal cepat dengan pesan jelas (tidak menggantung diam-diam).
   *  - Timer panjang (ICE_WATCHDOG_MS): jaring pengaman diagnostik —
   *    mencatat statistik kandidat untuk debugging bila perlu.
   */
  private armIceWatchdog(pc: RTCPeerConnection): void {
    this.disarmIceWatchdog();
    this.iceStartedAt = Date.now();
    this.iceTimer = setTimeout(() => {
      if (this.call && pc.connectionState !== "connected") {
        void this.logConnectionDetail(pc, "ice-connect-timeout");
        this.failCall("Koneksi media melebihi batas waktu — coba lagi atau periksa jaringan.");
      }
    }, ICE_CONNECT_TIMEOUT_MS);
    this.iceWatchdogTimer = setTimeout(() => {
      if (this.call && pc.connectionState !== "connected") {
        void this.logConnectionDetail(pc, "ice-watchdog");
      }
    }, ICE_WATCHDOG_MS);
  }

  private disarmIceWatchdog(): void {
    if (this.iceTimer) {
      clearTimeout(this.iceTimer);
      this.iceTimer = null;
    }
    if (this.iceWatchdogTimer) {
      clearTimeout(this.iceWatchdogTimer);
      this.iceWatchdogTimer = null;
    }
    this.iceStartedAt = null;
  }

  /** Diagnostik: statistik pasangan kandidat ICE (untuk log konsol). */
  private async logConnectionDetail(pc: RTCPeerConnection, tag: string): Promise<void> {
    try {
      const stats = await pc.getStats();
      const elapsed = this.iceStartedAt ? Math.round((Date.now() - this.iceStartedAt) / 1000) : -1;
      let pair = "-";
      let local = "-";
      stats.forEach((r) => {
        if ((r as unknown as { state?: string }).state === "succeeded" && (r as unknown as { nominated?: boolean }).nominated) {
          pair = `${(r as unknown as { localCandidateId?: string }).localCandidateId ?? "?"}`;
          const lc = stats.get((r as unknown as { localCandidateId: string }).localCandidateId) as
            | { candidateType?: string; protocol?: string; ip?: string; port?: number }
            | undefined;
          if (lc) local = `${lc.candidateType ?? "?"}/${lc.protocol ?? "?"} ${lc.ip ?? "?"}:${lc.port ?? "?"}`;
        }
      });
      console.log(`[realcall] ICE ${tag} t=${elapsed}s pair=${pair} local=${local}`);
    } catch {
      // statistik tidak tersedia — abaikan
    }
  }

  private setPhase(phase: CallPhase): void {
    if (!this.call) return;
    this.call = { ...this.call, phase };
    useRealcallStore.getState().setCall(this.call);
  }

  private failCall(msg: string): void {
    if (this.call) this.emit("call:end", { callId: this.call.callId, reason: "error" });
    playCallEndTone("busy");
    useRealcallStore.getState().setError(msg);
    this.cleanupCall();
  }

  /** Simpan riwayat ke /api/calls + segarkan daftar. */
  private async saveHistory(direction: "IN" | "OUT" | "MISSED", durationSec: number): Promise<void> {
    const call = this.call;
    if (!call) return;
    try {
      await fetch("/api/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          peerName: call.peer.username,
          colorKey: call.peer.accessId ? colorFromAccessId(call.peer.accessId) : "emerald",
          kind: call.kind,
          direction,
          durationSec,
        }),
      });
      window.dispatchEvent(new CustomEvent("indigoo:calls-refresh"));
    } catch {
      // riwayat gagal tersimpan — panggilan tetap berjalan
    }
  }

  /** Bersihkan seluruh resource panggilan 1-on-1 (aman dipanggil dua kali). */
  private cleanupCall(): void {
    stopRingback();
    stopIncomingRing();
    this.disarmIceWatchdog();
    this.queuedCandidates = [];
    this.makingOffer = false;
    if (this.pc) {
      try {
        this.pc.ontrack = null;
        this.pc.onicecandidate = null;
        this.pc.onconnectionstatechange = null;
        this.pc.close();
      } catch {
        // abaikan
      }
      this.pc = null;
    }
    for (const t of this.localStream?.getTracks() ?? []) t.stop();
    this.localStream = null;
    this.remoteStream = null;
    this.call = null;
    const st = useRealcallStore.getState();
    st.setCall(null);
    st.setRemoteStream(null);
    st.setLocalStream(null);
  }

  // ---------------- KONFERENSI (mesh kecil) ----------------

  async joinConf(roomId: string): Promise<{ ok: boolean; error?: string }> {
    if (!this.socket?.connected) return { ok: false, error: "Tidak terhubung ke server realtime" };
    if (this.call) return { ok: false, error: "Akhiri panggilan dahulu" };
    try {
      this.confLocalStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: { width: { ideal: 1280 } } });
    } catch {
      try {
        this.confLocalStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        return { ok: false, error: "Mikrofon tidak dapat diakses" };
      }
    }
    useRealcallStore.getState().setConfLocalStream(this.confLocalStream);

    return new Promise((resolve) => {
      const s = this.socket!;
      const timeout = setTimeout(() => resolve({ ok: false, error: "Server tidak merespon" }), 8000);
      s.emit("conf:join", { roomId }, async (res: { ok: boolean; peers?: Array<{ peerSocketId: string; userId: string; username: string; accessId: string }> }) => {
        clearTimeout(timeout);
        if (!res?.ok) return resolve({ ok: false, error: "Gagal bergabung ruangan" });
        this.confRoomId = roomId;
        useRealcallStore.getState().setConf(roomId, true);
        // Peer yang SUDAH di ruang membuat offer ke pendatang → kita (pendatang)
        // hanya menyiapkan dan menunggu offer mereka.
        resolve({ ok: true });
      });
    });
  }

  leaveConf(): void {
    if (this.confRoomId) this.emit("conf:leave", { roomId: this.confRoomId });
    this.confRoomId = null;
    for (const id of Array.from(this.confPeers.keys())) this.confClosePeer(id);
    for (const t of this.confLocalStream?.getTracks() ?? []) t.stop();
    this.confLocalStream = null;
    const st = useRealcallStore.getState();
    st.resetConf();
  }

  inviteToConf(peer: PeerInfo): void {
    if (!this.confRoomId) return;
    this.emit("conf:invite", { to: peer.userId, roomId: this.confRoomId });
  }

  confToggleMute(): void {
    for (const t of this.confLocalStream?.getAudioTracks() ?? []) t.enabled = !t.enabled;
    useRealcallStore.getState().setConfMuted(!useRealcallStore.getState().confMuted);
  }

  confToggleCam(): void {
    for (const t of this.confLocalStream?.getVideoTracks() ?? []) t.enabled = !t.enabled;
    useRealcallStore.getState().setConfCamOff(!useRealcallStore.getState().confCamOff);
  }

  private async confEnsureLocal(): Promise<MediaStream | null> {
    if (this.confLocalStream) return this.confLocalStream;
    try {
      this.confLocalStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    } catch {
      try {
        this.confLocalStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        return null;
      }
    }
    useRealcallStore.getState().setConfLocalStream(this.confLocalStream);
    return this.confLocalStream;
  }

  /** Peer lama → buat offer ke pendatang baru. */
  private async confCreateOfferTo(peerSocketId: string, user: { userId: string; username: string; accessId: string }): Promise<void> {
    if (!this.confRoomId || this.confPeers.has(peerSocketId)) return;
    const local = await this.confEnsureLocal();
    if (!local) return;
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this.confPeers.set(peerSocketId, pc);
    const remote = new MediaStream();
    this.confStreams.set(peerSocketId, remote);

    for (const t of local.getTracks()) pc.addTrack(t, local);
    pc.ontrack = (ev) => {
      for (const track of ev.streams[0]?.getTracks() ?? [ev.track]) {
        if (!remote.getTracks().some((t) => t.id === track.id)) remote.addTrack(track);
      }
      useRealcallStore.getState().setConfStream(peerSocketId, remote, user);
    };
    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        this.emit("conf:relay", { roomId: this.confRoomId, toPeer: peerSocketId, kind: "ice", payload: ev.candidate.toJSON() });
      }
    };
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.emit("conf:relay", { roomId: this.confRoomId, toPeer: peerSocketId, kind: "offer", payload: pc.localDescription });
      useRealcallStore.getState().addConfPeer(peerSocketId, user);
    } catch {
      this.confClosePeer(peerSocketId);
    }
  }

  /** Pendatang → proses offer/answer/ice dari peer lama. */
  private async confHandleRelay(p: { fromPeer: string; fromUser?: { userId: string; username: string }; kind: "offer" | "answer" | "ice"; payload: unknown }): Promise<void> {
    if (!this.confRoomId) return;
    let pc = this.confPeers.get(p.fromPeer);
    if (p.kind === "offer") {
      if (!pc) {
        const local = await this.confEnsureLocal();
        if (!local) return;
        pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        this.confPeers.set(p.fromPeer, pc);
        const remote = new MediaStream();
        this.confStreams.set(p.fromPeer, remote);
        for (const t of local.getTracks()) pc.addTrack(t, local);
        pc.ontrack = (ev) => {
          for (const track of ev.streams[0]?.getTracks() ?? [ev.track]) {
            if (!remote.getTracks().some((t) => t.id === track.id)) remote.addTrack(track);
          }
          useRealcallStore.getState().setConfStream(p.fromPeer, remote, {
            userId: p.fromUser?.userId ?? "?",
            username: p.fromUser?.username ?? "Peserta",
            accessId: "",
          });
        };
        pc.onicecandidate = (ev) => {
          if (ev.candidate) {
            this.emit("conf:relay", { roomId: this.confRoomId, toPeer: p.fromPeer, kind: "ice", payload: ev.candidate.toJSON() });
          }
        };
        useRealcallStore.getState().addConfPeer(p.fromPeer, {
          userId: p.fromUser?.userId ?? "?",
          username: p.fromUser?.username ?? "Peserta",
          accessId: "",
        });
      }
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(p.payload as RTCSessionDescriptionInit));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        this.emit("conf:relay", { roomId: this.confRoomId, toPeer: p.fromPeer, kind: "answer", payload: pc.localDescription });
      } catch {
        this.confClosePeer(p.fromPeer);
      }
      return;
    }
    if (!pc) return;
    try {
      if (p.kind === "answer") {
        await pc.setRemoteDescription(new RTCSessionDescription(p.payload as RTCSessionDescriptionInit));
      } else {
        await pc.addIceCandidate(new RTCIceCandidate(p.payload as RTCIceCandidateInit)).catch(() => undefined);
      }
    } catch {
      // kandidat/answer usang — abaikan
    }
  }

  private confClosePeer(peerSocketId: string): void {
    const pc = this.confPeers.get(peerSocketId);
    if (pc) {
      try {
        pc.close();
      } catch {
        // abaikan
      }
    }
    this.confPeers.delete(peerSocketId);
    this.confStreams.delete(peerSocketId);
  }
}

/** Warna avatar stabil dari Access ID (mis. ID-000001 → kunci palet). */
export function colorFromAccessId(accessId: string): string {
  const keys = ["emerald", "amber", "violet", "rose", "teal", "orange", "cyan", "lime"];
  let h = 0;
  for (let i = 0; i < accessId.length; i++) h = (h * 31 + accessId.charCodeAt(i)) >>> 0;
  return keys[h % keys.length];
}

/** Singleton global (bertahan lintas hot-reload modul). */
const g = globalThis as unknown as { __indigooRealCall?: RealCallEngine };
export const realcall: RealCallEngine = g.__indigooRealCall ?? new RealCallEngine();
g.__indigooRealCall = realcall;
