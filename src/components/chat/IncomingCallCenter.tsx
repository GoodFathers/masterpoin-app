"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Phone, PhoneOff, Video } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ChatAvatar from "./ChatAvatar";
import CallDialog from "./CallDialog";
import {
  getSignalingSocket,
  type CallOfferRelayPayload,
  type CallStatusPayload,
  type RingCancelledPayload,
  type RingIncomingPayload,
} from "./signaling";

const RING_TIMEOUT_MS = 30_000; // timeout dering sisi penerima (server 32 dtk)
const OFFER_WAIT_TIMEOUT_MS = 12_000;

/**
 * Pusat dering masuk global (dimount satu kali di AppShell).
 * - Mendengarkan ring:incoming dari signaling service → overlay dering penuh
 *   + suara dering nyata via Web Audio API (loop hingga dijawab/ditolak/timeout).
 * - Terima → emit call:accept → menerima offer → layar panggilan aktif (CallDialog).
 * - Tolak → emit call:decline.
 * - Timeout 30 dtk → tandai MISSED via POST /api/calls (durasi 0).
 * Hanya ada satu ring overlay per tab; backgrounding halaman tidak mematikan panggilan.
 */
export default function IncomingCallCenter() {
  const { toast } = useToast();
  const [ring, setRing] = useState<RingIncomingPayload | null>(null);
  const [accepted, setAccepted] = useState<RingIncomingPayload | null>(null);
  const [acceptedOffer, setAcceptedOffer] = useState<RTCSessionDescriptionInit | null>(null);

  const ringRef = useRef<RingIncomingPayload | null>(null);
  const acceptedRef = useRef<RingIncomingPayload | null>(null);
  const offerReceivedRef = useRef(false);
  const missedLoggedRef = useRef(false);
  const ringerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const offerWaitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ringtoneRef = useRef<{ stop: () => void } | null>(null);

  // Sinkronisasi ref untuk handler socket (hanya di effect, bukan saat render)
  useEffect(() => {
    ringRef.current = ring;
  }, [ring]);

  useEffect(() => {
    acceptedRef.current = accepted;
  }, [accepted]);

  const stopRingtone = useCallback(() => {
    ringtoneRef.current?.stop();
    ringtoneRef.current = null;
  }, []);

  const clearRingerTimer = useCallback(() => {
    if (ringerTimerRef.current) {
      clearTimeout(ringerTimerRef.current);
      ringerTimerRef.current = null;
    }
  }, []);

  /** Suara dering nyata (dua nada klasik 440+480 Hz) berloop hingga dihentikan. */
  const startRingtone = useCallback(() => {
    if (ringtoneRef.current) return;
    try {
      const Ctx: typeof AudioContext | undefined =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      void ctx.resume().catch(() => {});

      const gain = ctx.createGain();
      gain.gain.value = 0.0001;
      gain.connect(ctx.destination);

      const osc1 = ctx.createOscillator();
      osc1.type = "sine";
      osc1.frequency.value = 440;
      const osc2 = ctx.createOscillator();
      osc2.type = "sine";
      osc2.frequency.value = 480;
      osc1.connect(gain);
      osc2.connect(gain);
      osc1.start();
      osc2.start();

      let loopTimer: ReturnType<typeof setInterval> | null = null;
      const burst = () => {
        try {
          const t = ctx.currentTime;
          gain.gain.cancelScheduledValues(t);
          gain.gain.setValueAtTime(0.0001, t);
          gain.gain.exponentialRampToValueAtTime(0.18, t + 0.06);
          gain.gain.setValueAtTime(0.18, t + 0.7);
          gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.78);
        } catch {
          /* ignore */
        }
      };
      burst();
      loopTimer = setInterval(burst, 2000);

      ringtoneRef.current = {
        stop: () => {
          if (loopTimer) clearInterval(loopTimer);
          try {
            osc1.stop();
            osc2.stop();
          } catch {
            /* ignore */
          }
          void ctx.close().catch(() => {});
        },
      };
    } catch {
      // Audio tidak tersedia (kebijakan autoplay) — dering visual tetap tampil
    }
  }, []);

  /** Tandai MISSED (dipanggil maksimal satu kali per panggilan masuk). */
  const logMissed = useCallback(
    (p: RingIncomingPayload) => {
      if (missedLoggedRef.current) return;
      missedLoggedRef.current = true;
      void fetch("/api/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId: p.contactId, kind: p.kind, direction: "MISSED", durationSec: 0 }),
      }).catch(() => {});
    },
    []
  );

  // ---------- Listener signaling (mount sekali) ----------
  useEffect(() => {
    const socket = getSignalingSocket();

    const onIncoming = (p: RingIncomingPayload) => {
      if (!p || !p.callId) return;
      // satu ring overlay saja — abaikan bila sedang ada dering/panggilan aktif
      if (ringRef.current || acceptedRef.current) return;
      const payload: RingIncomingPayload = {
        callId: String(p.callId),
        callerName: p.callerName || "IndiGoo",
        contactName: p.contactName || "Pelanggan",
        contactId: p.contactId ?? null,
        colorKey: p.colorKey ?? null,
        avatarUrl: p.avatarUrl ?? null,
        kind: p.kind === "VIDEO" ? "VIDEO" : "VOICE",
      };
      missedLoggedRef.current = false;
      ringRef.current = payload;
      setRing(payload);
      startRingtone();
      clearRingerTimer();
      ringerTimerRef.current = setTimeout(() => {
        // timeout di sisi penerima → MISSED
        if (ringRef.current?.callId === payload.callId && !acceptedRef.current) {
          stopRingtone();
          logMissed(payload);
          setRing(null);
          toast({
            title: "Panggilan tidak dijawab",
            description: `${payload.kind === "VIDEO" ? "Video" : "Suara"} dari ${payload.callerName} • ditandai tak terjawab`,
          });
        }
      }, RING_TIMEOUT_MS);
    };

    const onRingCancelled = (p: RingCancelledPayload) => {
      const current = ringRef.current;
      if (!current || current.callId !== p?.callId || acceptedRef.current) return;
      stopRingtone();
      clearRingerTimer();
      if (p.reason === "timeout") logMissed(current);
      setRing(null);
    };

    const onOfferRelay = (p: CallOfferRelayPayload) => {
      if (!acceptedRef.current || acceptedRef.current.callId !== p?.callId) return;
      if (offerWaitTimerRef.current) {
        clearTimeout(offerWaitTimerRef.current);
        offerWaitTimerRef.current = null;
      }
      offerReceivedRef.current = true;
      setAcceptedOffer(p.offer ?? null);
    };

    const onEnded = (p: CallStatusPayload) => {
      const current = acceptedRef.current;
      if (!current || current.callId !== p?.callId) return;
      if (offerReceivedRef.current) return; // CallDialog yang menangani (sudah POST /api/calls)
      // Diterima tetapi offer belum sempat datang (caller langsung menutup)
      stopRingtone();
      clearRingerTimer();
      acceptedRef.current = null;
      setAccepted(null);
      setAcceptedOffer(null);
      void fetch("/api/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId: current.contactId, kind: current.kind, direction: "IN", durationSec: 0 }),
      }).catch(() => {});
    };

    socket.on("ring:incoming", onIncoming);
    socket.on("ring:cancelled", onRingCancelled);
    socket.on("call:offer", onOfferRelay);
    socket.on("call:ended", onEnded);

    return () => {
      socket.off("ring:incoming", onIncoming);
      socket.off("ring:cancelled", onRingCancelled);
      socket.off("call:offer", onOfferRelay);
      socket.off("call:ended", onEnded);
      stopRingtone();
      clearRingerTimer();
      if (offerWaitTimerRef.current) clearTimeout(offerWaitTimerRef.current);
    };
  }, [clearRingerTimer, logMissed, startRingtone, stopRingtone, toast]);

  // ---------- Aksi pengguna ----------
  const acceptCall = () => {
    const current = ringRef.current;
    if (!current || acceptedRef.current) return;
    stopRingtone();
    clearRingerTimer();
    offerReceivedRef.current = false;
    acceptedRef.current = current;
    setAccepted(current);
    setRing(null);
    // pengaman: bila offer tidak kunjung datang
    offerWaitTimerRef.current = setTimeout(() => {
      if (acceptedRef.current?.callId === current.callId && !offerReceivedRef.current) {
        acceptedRef.current = null;
        setAccepted(null);
        setAcceptedOffer(null);
        toast({ title: "Panggilan gagal tersambung", description: "Coba lagi sebentar.", variant: "destructive" });
      }
    }, OFFER_WAIT_TIMEOUT_MS);
    try {
      getSignalingSocket().emit("call:accept", { callId: current.callId });
    } catch {
      /* ignore */
    }
  };

  const declineCall = () => {
    const current = ringRef.current;
    if (!current) return;
    stopRingtone();
    clearRingerTimer();
    setRing(null);
    try {
      getSignalingSocket().emit("call:decline", { callId: current.callId });
    } catch {
      /* ignore */
    }
  };

  const handleIncomingEnd = useCallback(() => {
    acceptedRef.current = null;
    offerReceivedRef.current = false;
    setAccepted(null);
    setAcceptedOffer(null);
  }, []);

  const isVideoRing = ring?.kind === "VIDEO";

  return (
    <>
      {/* Overlay dering masuk (hanya satu) */}
      {ring && (
        <div
          className="fixed inset-0 z-[60] flex flex-col items-center justify-between bg-gradient-to-b from-maroon-950 via-zinc-900 to-black text-white py-14 px-6"
          role="dialog"
          aria-modal="true"
          aria-label={`${isVideoRing ? "Panggilan video" : "Panggilan suara"} masuk dari ${ring.contactName}`}
        >
          <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center">
            <div className="relative">
              <div className="absolute inset-0 rounded-full ring-2 ring-primary/60 animate-pulse" aria-hidden="true" />
              <ChatAvatar
                name={ring.contactName}
                colorKey={ring.colorKey ?? undefined}
                avatarUrl={ring.avatarUrl ?? null}
                className="h-32 w-32 wa-pulse"
                iconClassName="text-4xl"
              />
            </div>
            <div>
              <h2 className="text-2xl font-semibold">{ring.contactName}</h2>
              <p className="mt-1 flex items-center justify-center gap-2 text-sm text-white/75">
                {isVideoRing ? (
                  <Video className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Phone className="h-4 w-4" aria-hidden="true" />
                )}
                {isVideoRing ? "Panggilan video masuk…" : "Panggilan suara masuk…"}
              </p>
              <p className="mt-1 text-xs text-white/45">dari {ring.callerName} • WebRTC</p>
            </div>
          </div>

          <div className="flex items-center gap-16 pb-4">
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={declineCall}
                aria-label="Tolak panggilan"
                className="h-16 w-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-lg transition-colors"
              >
                <PhoneOff className="h-7 w-7" />
              </button>
              <span className="text-xs text-white/60">Tolak</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={acceptCall}
                aria-label="Terima panggilan"
                className="h-16 w-16 rounded-full bg-primary hover:bg-primary/90 flex items-center justify-center shadow-lg transition-colors"
              >
                <Phone className="h-7 w-7" />
              </button>
              <span className="text-xs text-white/60">Terima</span>
            </div>
          </div>
        </div>
      )}

      {/* Jembatan sesaat setelah menerima (menunggu offer dari caller) */}
      {accepted && !acceptedOffer && (
        <div
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-5 bg-gradient-to-b from-maroon-950 via-zinc-900 to-black text-white"
          role="status"
          aria-label={`Menyambungkan panggilan dengan ${accepted.contactName}`}
        >
          <ChatAvatar
            name={accepted.contactName}
            colorKey={accepted.colorKey ?? undefined}
            avatarUrl={accepted.avatarUrl ?? null}
            className="h-24 w-24"
            iconClassName="text-3xl"
          />
          <p className="flex items-center gap-2 text-sm text-white/75">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Menyambungkan…
          </p>
        </div>
      )}

      {/* Layar panggilan aktif — komponen yang sama dengan pemanggil */}
      {accepted && acceptedOffer && (
        <CallDialog
          mode="incoming"
          callId={accepted.callId}
          offer={acceptedOffer}
          contactId={accepted.contactId}
          contactName={accepted.contactName}
          colorKey={accepted.colorKey ?? undefined}
          avatarUrl={accepted.avatarUrl ?? null}
          kind={accepted.kind}
          onEnd={handleIncomingEnd}
        />
      )}
    </>
  );
}
