"use client";
// ===================== REALCALL CENTER INDIIGOO =====================
// Pusat panggilan NYATA global: dipasang sekali di shell IndiGoo (hanya saat
// sesi ada). Bertugas:
//  1. Menjaga koneksi signaling (presence) selama sesi aktif.
//  2. Overlay PANGGILAN MASUK (dering + tombol terima/tolak).
//  3. Overlay panggilan KELUAR / AKTIF — suara (avatar + timer) & video
//     (video lawan bicara penuh + PiP kamera sendiri, tombol bisukan/
//     kamera/akhiri).
//  4. Overlay KONFERENSI (grid video mesh kecil).
//  5. Toast galat media (izin kamera/mik, koneksi gagal, dsb).

import { useEffect, useRef, useState } from "react";
import {
  Loader2,
  Mic,
  MicOff,
  PhoneOff,
  UserPlus,
  Users,
  Video,
  VideoOff,
  Phone,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { cn, getInitials } from "@/lib/wa-utils";
import { realcall } from "@/lib/realcall";
import { useRealcallStore } from "@/store/realcall";
import ChatAvatar from "@/components/chat/ChatAvatar";

function formatSec(total: number): string {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Elemen video yang menempelkan MediaStream. */
function VideoTile({
  stream,
  className,
  muted = false,
  label,
  mirror = false,
}: {
  stream: MediaStream | null;
  className?: string;
  muted?: boolean;
  label?: string;
  mirror?: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.srcObject !== stream) el.srcObject = stream;
    if (stream) void el.play().catch(() => undefined);
  }, [stream]);
  return (
    <div className={cn("relative overflow-hidden bg-zinc-900", className)}>
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={muted}
        className={cn("h-full w-full object-cover", mirror && "scale-x-[-1]")}
      />
      {label && (
        <span className="absolute bottom-1.5 left-1.5 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white">
          {label}
        </span>
      )}
      {(!stream || stream.getVideoTracks().length === 0) && (
        <div className="absolute inset-0 flex items-center justify-center text-white/50">
          <VideoOff className="h-7 w-7" aria-hidden="true" />
        </div>
      )}
    </div>
  );
}

export default function RealCallCenter() {
  const { toast } = useToast();
  const { user: authUser } = useAuth();
  const authUserId = authUser?.id ?? null;
  const conn = useRealcallStore((s) => s.conn);
  const call = useRealcallStore((s) => s.call);
  const incoming = useRealcallStore((s) => s.incoming);
  const remoteStream = useRealcallStore((s) => s.remoteStream);
  const localStream = useRealcallStore((s) => s.localStream);
  const error = useRealcallStore((s) => s.error);
  const confActive = useRealcallStore((s) => s.confActive);
  const confStreams = useRealcallStore((s) => s.confStreams);
  const confPeersInfo = useRealcallStore((s) => s.confPeersInfo);
  const confLocalStream = useRealcallStore((s) => s.confLocalStream);
  const confMuted = useRealcallStore((s) => s.confMuted);
  const confCamOff = useRealcallStore((s) => s.confCamOff);
  const confInvite = useRealcallStore((s) => s.confInvite);
  const peers = useRealcallStore((s) => s.peers);
  const [inviteOpen, setInviteOpen] = useState(false);

  // Tick per detik — durasi DITURUNKAN (tanpa setState sinkron di effect)
  const [now, setNow] = useState(() => Date.now());
  const running = call?.phase === "active" || confActive;
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [running]);
  const base = call?.startedAt ?? null;
  const seconds = running && base ? Math.max(0, Math.round((now - base) / 1000)) : 0;

  // Sambungkan signaling HANYA setelah sesi auth ada (authUserId), lalu putuskan
  // saat komponen bongkar (logout). Deps [authUserId] — effect dengan deps kosong
  // berjalan sebelum login dan tak pernah mencoba ulang (presence kosong).
  useEffect(() => {
    if (!authUserId) return;
    realcall.ensureConnected();
    return () => realcall.disconnect();
  }, [authUserId]);

  // Toast galat (izin media, koneksi gagal, dsb.)
  useEffect(() => {
    if (!error) return;
    toast({ title: "Panggilan", description: error, variant: "destructive" });
    useRealcallStore.getState().setError(null);
  }, [error, toast]);

  const isVideoActive = call?.kind === "VIDEO" && call.phase !== "ringing";

  return (
    <>
      {/* ============ KARTU UNDANGAN KONFERENSI ============ */}
      {confInvite && !call && !confActive && (
        <div
          className="fixed left-1/2 top-4 z-[75] w-[92%] max-w-sm -translate-x-1/2 rounded-xl border border-maroon-500/40 bg-card p-4 text-card-foreground shadow-2xl"
          role="alertdialog"
          aria-label="Undangan konferensi"
        >
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Users className="h-4 w-4 text-maroon-600" aria-hidden="true" />
            Undangan konferensi
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{confInvite.from.username}</span> mengundang Anda
            bergabung ke ruang konferensi video.
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              className="flex-1"
              onClick={() => {
                const roomId = confInvite.roomId;
                useRealcallStore.getState().setConfInvite(null);
                void realcall.joinConf(roomId).then((r) => {
                  if (!r.ok) useRealcallStore.getState().setError(r.error ?? "Gagal gabung konferensi");
                });
              }}
            >
              <Video className="h-4 w-4" aria-hidden="true" />
              Gabung
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={() => useRealcallStore.getState().setConfInvite(null)}
            >
              Nanti saja
            </Button>
          </div>
        </div>
      )}

      {/* ============ PANGGILAN MASUK (dering) ============ */}
      {incoming && !call && (
        <div
          className="fixed inset-0 z-[70] flex flex-col items-center justify-between bg-gradient-to-b from-maroon-950 via-zinc-900 to-black px-6 py-14 text-white"
          role="dialog"
          aria-modal="true"
          aria-label={`Panggilan ${incoming.kind === "VIDEO" ? "video" : "suara"} masuk dari ${incoming.from.username}`}
        >
          <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
            <div className="relative">
              <div className="absolute -inset-2 animate-ping rounded-full bg-maroon-500/25" aria-hidden="true" />
              <ChatAvatar
                name={incoming.from.username}
                colorKey={incoming.from.accessId ? undefined : undefined}
                className="h-32 w-32 wa-pulse"
                iconClassName="text-4xl"
              />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-maroon-300/90">
                {incoming.from.accessId || "Pengguna IndiGoo"}
              </p>
              <h2 className="mt-1 text-2xl font-bold">{incoming.from.username}</h2>
              <p className="mt-2 flex items-center justify-center gap-2 text-sm text-white/75">
                {incoming.kind === "VIDEO" ? (
                  <Video className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Phone className="h-4 w-4" aria-hidden="true" />
                )}
                Panggilan {incoming.kind === "VIDEO" ? "video" : "suara"} masuk…
              </p>
            </div>
          </div>
          <div className="flex items-center gap-14 pb-6">
            <button
              type="button"
              onClick={() => realcall.reject()}
              aria-label="Tolak panggilan"
              className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500 shadow-lg transition-colors hover:bg-red-600"
            >
              <PhoneOff className="h-7 w-7" />
            </button>
            <button
              type="button"
              onClick={() => realcall.accept()}
              aria-label="Terima panggilan"
              className="flex h-16 w-16 animate-bounce items-center justify-center rounded-full bg-maroon-500 shadow-lg transition-colors hover:bg-maroon-600"
            >
              <Phone className="h-7 w-7" />
            </button>
          </div>
        </div>
      )}

      {/* ============ PANGGILAN KELUAR / AKTIF ============ */}
      {call && (
        <div
          className="fixed inset-0 z-[70] flex flex-col bg-gradient-to-b from-zinc-900 via-zinc-900 to-black text-white"
          role="dialog"
          aria-modal="true"
          aria-label={`Panggilan ${call.kind === "VIDEO" ? "video" : "suara"} dengan ${call.peer.username}`}
        >
          {/* Video penuh (panggilan video) */}
          {isVideoActive && (
            <VideoTile
              stream={remoteStream}
              className="absolute inset-0 h-full w-full"
            />
          )}

          {/* Info tengah (selalu utk suara; overlay saat connecting utk video) */}
          <div
            className={cn(
              "relative z-10 flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center",
              isVideoActive && call.phase === "active" && "pointer-events-none opacity-0"
            )}
          >
            <div className="relative">
              {call.phase !== "active" && (
                <div className="absolute -inset-2 animate-ping rounded-full bg-maroon-500/20" aria-hidden="true" />
              )}
              <ChatAvatar
                name={call.peer.username}
                className={cn("h-28 w-28", call.phase !== "active" && "wa-pulse")}
                iconClassName="text-4xl"
              />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-maroon-300/90">
                {call.peer.accessId || "Pengguna IndiGoo"}
              </p>
              <h2 className="mt-1 text-2xl font-bold">{call.peer.username}</h2>
              <p className="mt-2 flex items-center justify-center gap-2 text-sm text-white/75" aria-live="polite">
                {call.phase === "ringing" && (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Memanggil…
                  </>
                )}
                {call.phase === "connecting" && (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Menyambungkan…
                  </>
                )}
                {call.phase === "active" && <>Berlangsung • {formatSec(seconds)}</>}
              </p>
              {call.videoFallback && (
                <p className="mt-1 text-xs text-amber-300/90">
                  Kamera tidak tersedia — lanjut sebagai panggilan suara.
                </p>
              )}
            </div>
          </div>

          {/* PiP kamera sendiri (video aktif) */}
          {isVideoActive && call.phase === "active" && (
            <VideoTile
              stream={localStream}
              muted
              mirror
              label="Anda"
              className="absolute bottom-28 right-4 z-20 h-40 w-28 rounded-xl border border-white/20 shadow-xl sm:h-48 sm:w-36"
            />
          )}

          {/* Kontrol */}
          <div className="relative z-20 flex items-center justify-center gap-6 pb-12">
            <button
              type="button"
              onClick={() => realcall.toggleMute()}
              aria-label={call.muted ? "Bunyikan mikrofon" : "Bisukan mikrofon"}
              aria-pressed={call.muted}
              className={cn(
                "flex h-13 w-13 items-center justify-center rounded-full p-3.5 shadow-lg transition-colors",
                call.muted ? "bg-white text-zinc-900" : "bg-white/15 hover:bg-white/25"
              )}
            >
              {call.muted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
            </button>
            <button
              type="button"
              onClick={() => void realcall.toggleCamera()}
              aria-label={call.camOff ? "Nyalakan kamera" : "Matikan kamera"}
              aria-pressed={call.camOff}
              disabled={call.kind !== "VIDEO"}
              className={cn(
                "flex items-center justify-center rounded-full p-3.5 shadow-lg transition-colors disabled:opacity-40",
                call.camOff ? "bg-white text-zinc-900" : "bg-white/15 hover:bg-white/25"
              )}
            >
              {call.camOff ? <VideoOff className="h-6 w-6" /> : <Video className="h-6 w-6" />}
            </button>
            <button
              type="button"
              onClick={() => realcall.end("hangup")}
              aria-label="Akhiri panggilan"
              className="flex items-center justify-center rounded-full bg-red-500 p-3.5 shadow-lg transition-colors hover:bg-red-600"
            >
              <PhoneOff className="h-6 w-6" />
            </button>
          </div>
        </div>
      )}

      {/* ============ KONFERENSI ============ */}
      {confActive && (
        <div
          className="fixed inset-0 z-[70] flex flex-col bg-zinc-950 text-white"
          role="dialog"
          aria-modal="true"
          aria-label="Konferensi video"
        >
          <header className="flex items-center gap-2 px-4 py-3 text-sm">
            <Users className="h-4 w-4 text-maroon-400" aria-hidden="true" />
            <span className="font-semibold">Konferensi</span>
            <span className="text-white/60">• {Object.keys(confStreams).length + 1} peserta</span>
            <span className="ml-auto font-mono text-xs text-white/70">{formatSec(seconds)}</span>
            <Button
              size="sm"
              variant="secondary"
              className="ml-2 h-8 gap-1.5 rounded-full"
              onClick={() => setInviteOpen((v) => !v)}
              aria-expanded={inviteOpen}
            >
              <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
              Undang
            </Button>
          </header>

          {/* Panel undang peserta daring */}
          {inviteOpen && (
            <div className="absolute right-3 top-12 z-30 w-72 rounded-xl border border-border bg-card p-2 text-card-foreground shadow-2xl">
              <div className="flex items-center justify-between px-2 pb-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Undang pengguna daring
                </p>
                <button
                  type="button"
                  onClick={() => setInviteOpen(false)}
                  aria-label="Tutup panel undangan"
                  className="rounded-full p-1 text-muted-foreground hover:bg-secondary"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <div className="max-h-64 overflow-y-auto wa-scrollbar">
                {peers.length === 0 ? (
                  <p className="px-2 py-3 text-xs text-muted-foreground">
                    Belum ada pengguna lain yang daring.
                  </p>
                ) : (
                  peers.map((p) => (
                    <button
                      key={p.userId}
                      type="button"
                      onClick={() => realcall.inviteToConf(p)}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-secondary"
                    >
                      <span
                        aria-hidden="true"
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary"
                      >
                        {getInitials(p.username)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{p.username}</span>
                        <span className="block truncate text-[11px] text-muted-foreground">{p.accessId}</span>
                      </span>
                      <UserPlus className="h-4 w-4 text-primary" aria-hidden="true" />
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          <div className="grid flex-1 grid-cols-1 gap-1.5 overflow-y-auto p-1.5 sm:grid-cols-2">
            <VideoTile
              stream={confLocalStream}
              muted
              mirror
              label="Anda"
              className="min-h-[180px] rounded-xl"
            />
            {Object.entries(confStreams).map(([peerId, stream]) => (
              <VideoTile
                key={peerId}
                stream={stream}
                label={confPeersInfo[peerId]?.username ?? "Peserta"}
                className="min-h-[180px] rounded-xl"
              />
            ))}
          </div>

          <div className="flex items-center justify-center gap-6 pb-10 pt-3">
            <button
              type="button"
              onClick={() => realcall.confToggleMute()}
              aria-label={confMuted ? "Bunyikan mikrofon" : "Bisukan mikrofon"}
              aria-pressed={confMuted}
              className={cn(
                "flex items-center justify-center rounded-full p-3.5 shadow-lg transition-colors",
                confMuted ? "bg-white text-zinc-900" : "bg-white/15 hover:bg-white/25"
              )}
            >
              {confMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
            </button>
            <button
              type="button"
              onClick={() => realcall.confToggleCam()}
              aria-label={confCamOff ? "Nyalakan kamera" : "Matikan kamera"}
              aria-pressed={confCamOff}
              className={cn(
                "flex items-center justify-center rounded-full p-3.5 shadow-lg transition-colors",
                confCamOff ? "bg-white text-zinc-900" : "bg-white/15 hover:bg-white/25"
              )}
            >
              {confCamOff ? <VideoOff className="h-6 w-6" /> : <Video className="h-6 w-6" />}
            </button>
            <button
              type="button"
              onClick={() => realcall.leaveConf()}
              aria-label="Keluar konferensi"
              className="flex items-center justify-center rounded-full bg-red-500 p-3.5 shadow-lg transition-colors hover:bg-red-600"
            >
              <PhoneOff className="h-6 w-6" />
            </button>
          </div>
        </div>
      )}

      {/* Indikator koneksi realtime kecil ( pojok atas saat terputus ) */}
      {conn === "connecting" && !call && !confActive && (
        <div className="fixed left-1/2 top-2 z-[60] -translate-x-1/2 rounded-full bg-zinc-900/90 px-3 py-1 text-[11px] text-white/80 shadow" role="status">
          Menyambungkan realtime…
        </div>
      )}
    </>
  );
}
