"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Loader2,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Video,
  VideoOff,
} from "lucide-react";
import { formatDuration } from "@/lib/wa-utils";
import { useToast } from "@/hooks/use-toast";
import ChatAvatar from "./ChatAvatar";
import {
  getSignalingSocket,
  type CallAnswerPayload,
  type CallIcePayload,
  type CallStatusPayload,
} from "./signaling";

interface CallDialogProps {
  /** "outgoing" = panggilan keluar (dari tombol chat); "incoming" = panggilan masuk yang diterima. */
  mode?: "outgoing" | "incoming";
  contactId?: string | null;
  contactName: string;
  colorKey?: string;
  avatarUrl?: string | null;
  kind: "VOICE" | "VIDEO";
  /** Wajib untuk mode "incoming": callId signaling + offer dari caller. */
  callId?: string;
  offer?: RTCSessionDescriptionInit | null;
  /** Dipanggil saat dialog ditutup (riwayat sudah disimpan). */
  onEnd: () => void;
}

type Phase = "preparing" | "calling" | "connecting" | "active" | "ended" | "error";

const ICE_SERVERS: RTCIceServer[] = [{ urls: ["stun:stun.l.google.com:19302"] }];

const MEDIA_PERMISSION_HINT =
  "Izin mikrofon/kamera diperlukan — buka aplikasi di tab baru bila di preview iframe.";

const FALLBACK_BUSINESS = "IndiGoo";

function makeCallId(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  } catch {
    /* ignore */
  }
  return `call-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Layar panggilan WebRTC NYATA (suara + video via RTCPeerConnection).
 * Signaling melalui socket.io (mini-service port 3003 via gateway XTransformPort).
 * Timer durasi berjalan saat connectionState === "connected" dan dihitung dari
 * timestamp (aman terhadap throttling tab background).
 */
export default function CallDialog({
  mode = "outgoing",
  contactId = null,
  contactName,
  colorKey,
  avatarUrl,
  kind,
  callId: callIdProp,
  offer = null,
  onEnd,
}: CallDialogProps) {
  const { toast } = useToast();
  const isVideo = kind === "VIDEO";

  const [phase, setPhase] = useState<Phase>("preparing");
  const [note, setNote] = useState<string>(mode === "outgoing" ? "Menyiapkan mikrofon…" : "Menyambungkan…");
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(isVideo);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const socketRef = useRef<ReturnType<typeof getSignalingSocket> | null>(null);
  const callIdRef = useRef<string>(mode === "incoming" ? (callIdProp ?? "") : makeCallId());
  const connectedAtRef = useRef<number>(0);
  const endedRef = useRef(false);
  const phaseRef = useRef<Phase>("preparing");
  const disconnectGraceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sinkronisasi ref di effect (bukan saat render)
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const durationSec = useCallback(
    () => (connectedAtRef.current ? Math.max(0, Math.round((Date.now() - connectedAtRef.current) / 1000)) : 0),
    []
  );

  const logCall = useCallback(
    async (duration: number) => {
      try {
        await fetch("/api/calls", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contactId,
            kind,
            direction: mode === "outgoing" ? "OUT" : "IN",
            durationSec: duration,
          }),
        });
      } catch {
        toast({ title: "Gagal menyimpan riwayat panggilan", variant: "destructive" });
      }
    },
    [contactId, kind, mode, toast]
  );

  /** Stop media + tutup PC + lepaskan listener socket. */
  const teardownMedia = useCallback(() => {
    if (disconnectGraceRef.current) {
      clearTimeout(disconnectGraceRef.current);
      disconnectGraceRef.current = null;
    }
    try {
      pcRef.current?.getSenders().forEach((s) => s.track?.stop());
    } catch {
      /* ignore */
    }
    try {
      pcRef.current?.close();
    } catch {
      /* ignore */
    }
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
  }, []);

  /** Akhiri panggilan dari sisi lokal (tombol tutup / putus koneksi). */
  const endCall = useCallback(
    async (opts?: { notify?: boolean }) => {
      if (endedRef.current) return;
      endedRef.current = true;
      const duration = durationSec();
      if (opts?.notify !== false) {
        try {
          socketRef.current?.emit("call:end", { callId: callIdRef.current });
        } catch {
          /* ignore */
        }
      }
      teardownMedia();
      setPhase("ended");
      await logCall(duration);
      onEnd();
    },
    [durationSec, logCall, onEnd, teardownMedia]
  );

  /** Path terminal dari sisi remote (ditolak / tidak dijawab / diakhiri remote / sibuk). */
  const finishRemote = useCallback(
    async (terminalNote: string, duration: number | null, opts?: { log?: boolean; ms?: number }) => {
      if (endedRef.current) return;
      endedRef.current = true;
      teardownMedia();
      setPhase("ended");
      setNote(terminalNote);
      if (opts?.log !== false) await logCall(duration ?? 0);
      setTimeout(() => onEnd(), opts?.ms ?? 1600);
    },
    [logCall, onEnd, teardownMedia]
  );

  const showMediaError = useCallback(
    (err: unknown) => {
      const name = err instanceof DOMException ? err.name : "";
      let detail: string;
      if (name === "NotAllowedError" || name === "SecurityError") {
        detail = "Akses mikrofon/kamera ditolak.";
      } else if (name === "NotFoundError" || name === "OverconstrainedError") {
        detail = "Perangkat mikrofon/kamera tidak ditemukan.";
      } else {
        detail = "Mikrofon/kamera tidak dapat diakses.";
      }
      teardownMedia();
      endedRef.current = true;
      setError(`${detail} ${MEDIA_PERMISSION_HINT}`);
      setPhase("error");
    },
    [teardownMedia]
  );

  // ---------- Alur utama (mount-once) ----------
  useEffect(() => {
    const socket = getSignalingSocket();
    socketRef.current = socket;
    let cancelled = false;

    const createPC = (stream: MediaStream): RTCPeerConnection => {
      const pc = new RTCPeerConnection({
        iceServers: ICE_SERVERS,
        iceCandidatePoolSize: 4,
      });
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          try {
            socket.emit("call:ice", { callId: callIdRef.current, candidate: e.candidate.toJSON() });
          } catch {
            /* ignore */
          }
        }
      };

      pc.ontrack = (e) => {
        const [stream0] = e.streams;
        if (stream0) setRemoteStream(stream0);
      };

      pc.onconnectionstatechange = () => {
        if (endedRef.current) return;
        const st = pc.connectionState;
        if (st === "connected") {
          if (!connectedAtRef.current) connectedAtRef.current = Date.now();
          if (phaseRef.current !== "active") {
            setPhase("active");
            setNote("Kualitas bagus");
          }
        } else if (st === "failed") {
          void endCall(); // anggap putus — simpan durasi nyata
        } else if (st === "disconnected") {
          if (!disconnectGraceRef.current) {
            disconnectGraceRef.current = setTimeout(() => {
              disconnectGraceRef.current = null;
              if (!endedRef.current && pc.connectionState !== "connected") void endCall();
            }, 5000);
          }
        }
      };
      return pc;
    };

    const run = async () => {
      try {
        // 1) Media nyata
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: isVideo ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localStreamRef.current = stream;
        setLocalStream(stream);
        setMicOn(stream.getAudioTracks()[0]?.enabled ?? true);
        setCamOn(isVideo && (stream.getVideoTracks()[0]?.enabled ?? false));

        const pc = createPC(stream);
        pcRef.current = pc;

        if (mode === "outgoing") {
          // 2) Offer
          setPhase("calling");
          setNote("Memanggil…");
          const offerDesc = await pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: isVideo,
          });
          await pc.setLocalDescription(offerDesc);
          if (cancelled) return;

          let businessName = FALLBACK_BUSINESS;
          try {
            const res = await fetch("/api/profile", { cache: "no-store" });
            const data = await res.json();
            if (data?.profile?.businessName) businessName = String(data.profile.businessName);
          } catch {
            /* pakai fallback */
          }

          // 3) Kirim ke signaling → ring:incoming ke tab lain
          socket.emit("call:offer", {
            callId: callIdRef.current,
            offer: pc.localDescription ? pc.localDescription.toJSON() : offerDesc,
            kind,
            callerName: businessName,
            contactName,
            contactId,
            colorKey: colorKey ?? null,
            avatarUrl: avatarUrl ?? null,
          });
        } else {
          // Incoming: setRemote(offer) → jawab
          if (!offer) return;
          setNote("Menyambungkan…");
          setPhase("connecting");
          await pc.setRemoteDescription(new RTCSessionDescription(offer));
          const answerDesc = await pc.createAnswer();
          await pc.setLocalDescription(answerDesc);
          if (cancelled) return;
          socket.emit("call:answer", {
            callId: callIdRef.current,
            answer: pc.localDescription ? pc.localDescription.toJSON() : answerDesc,
          });
        }
      } catch (err) {
        if (cancelled) return;
        console.error("[CallDialog] gagal memulai panggilan:", err);
        showMediaError(err);
      }
    };

    void run();

    // ---------- Listener signaling ----------
    const onAnswer = (p: CallAnswerPayload) => {
      if (mode !== "outgoing" || p.callId !== callIdRef.current || endedRef.current) return;
      const pc = pcRef.current;
      if (!pc || !p.answer) return;
      pc.setRemoteDescription(new RTCSessionDescription(p.answer))
        .then(() => {
          if (!endedRef.current) {
            setPhase("connecting");
            setNote("Menyambungkan…");
          }
        })
        .catch((err) => {
          console.error("[CallDialog] setRemoteDescription gagal:", err);
          void endCall();
        });
    };

    const onIce = (p: CallIcePayload) => {
      if (p.callId !== callIdRef.current || endedRef.current) return;
      const pc = pcRef.current;
      if (!pc || !p.candidate) return;
      pc.addIceCandidate(new RTCIceCandidate(p.candidate)).catch(() => {
        /* kandidat lama/terlambat diabaikan */
      });
    };

    const onDeclined = (p: CallStatusPayload) => {
      if (p.callId !== callIdRef.current) return;
      void finishRemote("Panggilan ditolak", 0, { ms: 1600 });
    };

    const onTimeout = (p: CallStatusPayload) => {
      if (p.callId !== callIdRef.current) return;
      void finishRemote("Tidak ada jawaban", 0, { ms: 1600 });
    };

    const onBusy = (p: CallStatusPayload) => {
      if (p.callId !== callIdRef.current) return;
      void finishRemote("Ada panggilan lain yang sedang berlangsung", null, { log: false, ms: 2000 });
    };

    const onEnded = (p: CallStatusPayload) => {
      if (p.callId !== callIdRef.current) return;
      // durasi nyata (0 bila belum pernah tersambung)
      void finishRemote("Panggilan diakhiri", durationSec(), { ms: 1200 });
    };

    socket.on("call:answer", onAnswer);
    socket.on("call:ice", onIce);
    socket.on("call:declined", onDeclined);
    socket.on("call:timeout", onTimeout);
    socket.on("call:busy", onBusy);
    socket.on("call:ended", onEnded);

    return () => {
      cancelled = true;
      socket.off("call:answer", onAnswer);
      socket.off("call:ice", onIce);
      socket.off("call:declined", onDeclined);
      socket.off("call:timeout", onTimeout);
      socket.off("call:busy", onBusy);
      socket.off("call:ended", onEnded);
      if (!endedRef.current) {
        // unmount tanpa end eksplisit — berhentikan panggilan dengan rapi
        endedRef.current = true;
        try {
          socket.emit("call:end", { callId: callIdRef.current });
        } catch {
          /* ignore */
        }
        teardownMedia();
      }
    };
  }, []);

  // ---------- Timer tampilan (durasi nyata dihitung dari timestamp) ----------
  useEffect(() => {
    if (phase !== "active") return;
    const t = setInterval(() => setSeconds(durationSec()), 1000);
    return () => clearInterval(t);
  }, [phase, durationSec]);

  // ---------- Tempel stream ke elemen ----------
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch(() => {});
    }
  }, [localStream, phase]);

  useEffect(() => {
    const el = (isVideo ? remoteVideoRef.current : remoteAudioRef.current) ?? null;
    if (el && remoteStream) {
      el.srcObject = remoteStream;
      el.play().catch(() => {});
    }
  }, [remoteStream, isVideo, phase]);

  // ---------- Kontrol media ----------
  const toggleMic = () => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMicOn(track.enabled);
  };

  const toggleCam = () => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setCamOn(track.enabled);
  };

  const showAvatarStage = !isVideo || phase === "error" || (!remoteStream && phase !== "active");
  const busyPhase = phase === "preparing" || phase === "calling" || phase === "connecting";

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-between overflow-hidden bg-gradient-to-b from-maroon-950 via-zinc-900 to-black text-white"
      role="dialog"
      aria-modal="true"
      aria-label={`${isVideo ? "Panggilan video" : "Panggilan suara"} dengan ${contactName}`}
    >
      {/* Video remote layar penuh (panggilan video) */}
      {isVideo && phase !== "error" && (
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="absolute inset-0 h-full w-full bg-black object-cover"
          aria-label={`Video dari ${contactName}`}
        />
      )}

      {!isVideo && <audio ref={remoteAudioRef} autoPlay className="hidden" aria-hidden="true" />}

      {/* Penggelap agar teks terbaca di atas video */}
      {isVideo && phase !== "error" && (
        <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/70 to-transparent" aria-hidden="true" />
      )}

      {/* Pusat: info / avatar / error */}
      {showAvatarStage ? (
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
          <div className="relative">
            {busyPhase && (
              <div className="absolute inset-0 rounded-full ring-2 ring-primary/60 animate-pulse" aria-hidden="true" />
            )}
            <ChatAvatar
              name={contactName}
              colorKey={colorKey}
              avatarUrl={avatarUrl}
              className="h-32 w-32"
              iconClassName="text-4xl"
            />
          </div>
          <div>
            <h2 className="text-2xl font-semibold">{contactName}</h2>
            {phase === "error" && error ? (
              <div className="mt-3 max-w-md rounded-xl bg-red-500/15 px-4 py-3 text-sm text-red-200 ring-1 ring-red-400/40">
                <p className="flex items-center justify-center gap-2 font-medium">
                  <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                  Gagal memulai panggilan
                </p>
                <p className="mt-1 text-xs leading-relaxed text-red-100/90">{error}</p>
              </div>
            ) : (
              <>
                <p className="mt-1 flex items-center justify-center gap-2 text-sm text-white/70">
                  {phase === "active" ? (
                    <>Berlangsung • {formatDuration(seconds)}</>
                  ) : phase === "preparing" ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      {note}
                    </>
                  ) : (
                    <>
                      {isVideo ? (
                        <Video className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Phone className="h-4 w-4" aria-hidden="true" />
                      )}
                      {note}
                    </>
                  )}
                </p>
                <p className="mt-1 text-xs text-white/40">
                  {isVideo ? "Panggilan Video" : "Panggilan Suara"} •{" "}
                  {mode === "outgoing" ? "keluar" : "masuk"} • WebRTC
                </p>
              </>
            )}
          </div>
          {phase === "error" && (
            <button
              type="button"
              onClick={() => {
                endedRef.current = true;
                teardownMedia();
                onEnd();
              }}
              className="mt-2 rounded-full bg-white/10 px-6 py-2.5 text-sm font-medium hover:bg-white/20 transition-colors"
            >
              Tutup
            </button>
          )}
        </div>
      ) : (
        <div className="relative z-10 flex w-full flex-1 flex-col justify-between pt-5">
          {/* Header status saat panggilan video */}
          <div className="flex flex-col items-center gap-1 text-center">
            <h2 className="text-lg font-semibold drop-shadow">{contactName}</h2>
            <p className="text-xs text-white/75">
              {phase === "active"
                ? `Berlangsung • ${formatDuration(seconds)}`
                : busyPhase
                  ? note
                  : "Panggilan diakhiri"}
            </p>
          </div>
        </div>
      )}

      {/* Preview lokal (mirror) — tampil sejak media siap, di semua fase */}
      {isVideo && phase !== "error" && localStream && (
        <div className="pointer-events-none absolute bottom-32 right-4 z-10 w-28 sm:w-40 overflow-hidden rounded-xl border border-white/20 shadow-xl bg-black">
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="aspect-[3/4] w-full scale-x-[-1] object-cover"
            aria-label="Video Anda"
          />
          {!camOn && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-xs text-white/80">
              Kamera mati
            </div>
          )}
        </div>
      )}

      {/* Kontrol bawah */}
      {phase !== "error" && (
        <div className="relative z-10 pb-12 flex items-center justify-center gap-5 sm:gap-7">
          <button
            type="button"
            onClick={toggleMic}
            aria-label={micOn ? "Bisukan mikrofon" : "Nyalakan mikrofon"}
            aria-pressed={!micOn}
            className="h-14 w-14 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center shadow-lg transition-colors"
          >
            {micOn ? <Mic className="h-6 w-6" /> : <MicOff className="h-6 w-6" />}
          </button>

          {isVideo && (
            <button
              type="button"
              onClick={toggleCam}
              aria-label={camOn ? "Matikan kamera" : "Nyalakan kamera"}
              aria-pressed={!camOn}
              className="h-14 w-14 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center shadow-lg transition-colors"
            >
              {camOn ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}
            </button>
          )}

          <button
            type="button"
            onClick={() => void endCall()}
            aria-label="Akhiri panggilan"
            className="h-16 w-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-lg transition-colors"
          >
            <PhoneOff className="h-7 w-7" />
          </button>
        </div>
      )}
    </div>
  );
}
