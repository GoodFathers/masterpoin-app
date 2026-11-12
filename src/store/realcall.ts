"use client";
// ===================== STORE PANGGILAN NYATA INDIIGOO =====================
// State tampilan untuk panggilan suara/video nyata + konferensi (Zustand).
// Mesin (src/lib/realcall.ts) yang MENULIS state ini; UI (RealCallCenter,
// CallsTab) hanya membaca & memanggil aksi mesin.

import { create } from "zustand";

export type CallKind = "VOICE" | "VIDEO";
export type CallPhase = "ringing" | "connecting" | "active";
export type ConnStatus = "idle" | "connecting" | "connected" | "error";

export interface PeerInfo {
  userId: string;
  accessId: string;
  username: string;
  role: string;
  at?: number;
}

export interface IncomingCall {
  callId: string;
  from: PeerInfo;
  kind: CallKind;
  at: number;
}

export interface ConfInvite {
  roomId: string;
  from: PeerInfo;
}

export interface ConfPeer {
  userId: string;
  username: string;
  accessId: string;
}

interface RealcallState {
  conn: ConnStatus;
  me: PeerInfo | null;
  peers: PeerInfo[]; // pengguna lain yang daring (tanpa diri sendiri)
  call: {
    callId: string;
    role: "caller" | "callee";
    peer: PeerInfo;
    kind: CallKind;
    phase: CallPhase;
    startedAt: number | null;
    videoFallback: boolean;
    muted: boolean;
    camOff: boolean;
  } | null;
  incoming: IncomingCall | null;
  confInvite: ConfInvite | null;
  remoteStream: MediaStream | null;
  localStream: MediaStream | null;
  error: string | null;

  // Konferensi
  confRoomId: string | null;
  confActive: boolean;
  confMuted: boolean;
  confCamOff: boolean;
  confLocalStream: MediaStream | null;
  confStreams: Record<string, MediaStream>; // peerSocketId -> stream
  confPeersInfo: Record<string, ConfPeer>;

  // Aksi (dipakai mesin)
  setConn: (c: ConnStatus) => void;
  setMe: (u: PeerInfo | null) => void;
  setPeers: (p: PeerInfo[]) => void;
  setCall: (c: RealcallState["call"]) => void;
  setIncoming: (i: IncomingCall | null) => void;
  setConfInvite: (i: ConfInvite | null) => void;
  setRemoteStream: (s: MediaStream | null) => void;
  setLocalStream: (s: MediaStream | null) => void;
  setError: (e: string | null) => void;
  setConf: (roomId: string, active: boolean) => void;
  setConfMuted: (m: boolean) => void;
  setConfCamOff: (c: boolean) => void;
  setConfLocalStream: (s: MediaStream | null) => void;
  setConfStream: (peerSocketId: string, s: MediaStream, info: ConfPeer) => void;
  removeConfStream: (peerSocketId: string) => void;
  addConfPeer: (peerSocketId: string, info: ConfPeer) => void;
  resetConf: () => void;
  reset: () => void;
}

export const useRealcallStore = create<RealcallState>((set) => ({
  conn: "idle",
  me: null,
  peers: [],
  call: null,
  incoming: null,
  confInvite: null,
  remoteStream: null,
  localStream: null,
  error: null,

  confRoomId: null,
  confActive: false,
  confMuted: false,
  confCamOff: false,
  confLocalStream: null,
  confStreams: {},
  confPeersInfo: {},

  setConn: (conn) => set({ conn }),
  setMe: (me) =>
    set((s) => ({ me, peers: me ? s.peers.filter((p) => p.userId !== me.userId) : s.peers })),
  setPeers: (peers) => set((s) => ({ peers: peers.filter((p) => p.userId !== s.me?.userId) })),
  setCall: (call) => set({ call }),
  setIncoming: (incoming) => set({ incoming }),
  setConfInvite: (confInvite) => set({ confInvite }),
  setRemoteStream: (remoteStream) => set({ remoteStream }),
  setLocalStream: (localStream) => set({ localStream }),
  setError: (error) => set({ error }),

  setConf: (confRoomId, confActive) => set({ confRoomId, confActive }),
  setConfMuted: (confMuted) => set({ confMuted }),
  setConfCamOff: (confCamOff) => set({ confCamOff }),
  setConfLocalStream: (confLocalStream) => set({ confLocalStream }),
  setConfStream: (peerSocketId, stream, info) =>
    set((s) => ({
      confStreams: { ...s.confStreams, [peerSocketId]: stream },
      confPeersInfo: { ...s.confPeersInfo, [peerSocketId]: info },
    })),
  removeConfStream: (peerSocketId) =>
    set((s) => {
      const streams = { ...s.confStreams };
      const info = { ...s.confPeersInfo };
      delete streams[peerSocketId];
      delete info[peerSocketId];
      return { confStreams: streams, confPeersInfo: info };
    }),
  addConfPeer: (peerSocketId, info) =>
    set((s) => ({ confPeersInfo: { ...s.confPeersInfo, [peerSocketId]: info } })),
  resetConf: () =>
    set({
      confRoomId: null,
      confActive: false,
      confMuted: false,
      confCamOff: false,
      confLocalStream: null,
      confStreams: {},
      confPeersInfo: {},
    }),
  reset: () =>
    set({
      conn: "idle",
      me: null,
      peers: [],
      call: null,
      incoming: null,
      confInvite: null,
      remoteStream: null,
      localStream: null,
      error: null,
      confRoomId: null,
      confActive: false,
      confMuted: false,
      confCamOff: false,
      confLocalStream: null,
      confStreams: {},
      confPeersInfo: {},
    }),
}));
