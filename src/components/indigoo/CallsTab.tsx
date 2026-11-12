"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Info,
  Loader2,
  MoreVertical,
  Phone,
  PhoneIncoming,
  PhoneMissed,
  PhoneOutgoing,
  Radio,
  Trash2,
  UsersRound,
  Video,
  X,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn, colorOf, formatDuration, getInitials, timeAgo } from "@/lib/wa-utils";
import { useToast } from "@/hooks/use-toast";
import { realcall } from "@/lib/realcall";
import { useRealcallStore } from "@/store/realcall";
import { roleLabelId } from "@/lib/indigoo";

/** Shape respons GET /api/calls (lihat src/app/api/calls/route.ts). */
interface CallLogRow {
  id: string;
  contactId: string | null;
  contactName: string;
  colorKey: string;
  kind: string; // VOICE | VIDEO
  direction: string; // IN | OUT | MISSED
  durationSec: number;
  createdAt: string;
}

const KIND_LABEL: Record<string, string> = {
  VOICE: "Panggilan suara",
  VIDEO: "Panggilan video",
};

function DirectionInfo({ direction }: { direction: string }) {
  if (direction === "MISSED") {
    return (
      <span className="inline-flex items-center gap-1 text-red-500">
        <X className="h-3.5 w-3.5" aria-hidden="true" />
        Tak dijawab
      </span>
    );
  }
  if (direction === "IN") {
    return (
      <span className="inline-flex items-center gap-1 text-maroon-600">
        <ArrowDownRight className="h-3.5 w-3.5" aria-hidden="true" />
        Masuk
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-muted-foreground">
      <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
      Keluar
    </span>
  );
}

function DirectionBadgeIcon({ direction }: { direction: string }) {
  if (direction === "MISSED") return <PhoneMissed className="h-4 w-4 text-red-400" aria-hidden="true" />;
  if (direction === "IN") return <PhoneIncoming className="h-4 w-4 text-maroon-500" aria-hidden="true" />;
  return <PhoneOutgoing className="h-4 w-4 text-muted-foreground" aria-hidden="true" />;
}

/** Tab Panggilan — PANGGILAN NYATA antar pengguna daring (WebRTC) + riwayat. */
export default function CallsTab() {
  const { toast } = useToast();
  const [calls, setCalls] = useState<CallLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [confStarting, setConfStarting] = useState(false);

  // ---- Realtime (presence & status koneksi signaling) ----
  const conn = useRealcallStore((s) => s.conn);
  const peers = useRealcallStore((s) => s.peers);
  const confActive = useRealcallStore((s) => s.confActive);
  const callActive = useRealcallStore((s) => s.call);

  useEffect(() => {
    realcall.ensureConnected();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/calls", { cache: "no-store" });
      if (!res.ok) throw new Error("gagal memuat");
      const data = (await res.json()) as { calls?: CallLogRow[] };
      setCalls(data.calls ?? []);
    } catch {
      setCalls([]);
      toast({ title: "Gagal memuat riwayat panggilan", description: "Periksa koneksi lalu coba lagi.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  // Riwayat diperbarui otomatis setelah panggilan nyata selesai (event dari mesin)
  useEffect(() => {
    const onRefresh = () => void load();
    window.addEventListener("indigoo:calls-refresh", onRefresh);
    return () => window.removeEventListener("indigoo:calls-refresh", onRefresh);
  }, [load]);

  /** Telepon/video nyata ke pengguna daring. */
  const startCall = (peerUserId: string, kind: "VOICE" | "VIDEO") => {
    const peer = peers.find((p) => p.userId === peerUserId);
    if (!peer) return;
    const res = realcall.invite(peer, kind);
    if (!res.ok && res.error) {
      toast({ title: "Tidak dapat menelepon", description: res.error, variant: "destructive" });
    }
  };

  /** Mulai ruang konferensi video (mesh) lalu undang peserta dari overlay. */
  const startConference = async () => {
    if (confStarting || confActive || callActive) return;
    setConfStarting(true);
    const me = useRealcallStore.getState().me;
    const roomId = `conf-${me?.userId ?? "x"}-${Date.now().toString(36)}`;
    const res = await realcall.joinConf(roomId);
    setConfStarting(false);
    if (!res.ok) {
      toast({ title: "Gagal memulai konferensi", description: res.error, variant: "destructive" });
    } else {
      toast({ title: "Konferensi dimulai", description: "Gunakan tombol Undang untuk mengajak pengguna daring." });
    }
  };

  /** Hapus satu entri (optimis, rollback bila gagal). */
  const removeOne = useCallback(
    async (id: string) => {
      setRemovingId(id);
      const prev = calls;
      setCalls((cur) => cur.filter((c) => c.id !== id));
      try {
        const res = await fetch(`/api/calls?id=${encodeURIComponent(id)}`, { method: "DELETE" });
        if (!res.ok) throw new Error("gagal menghapus");
        toast({ title: "Panggilan dihapus", description: "Entri riwayat panggilan telah dihapus." });
      } catch {
        setCalls(prev);
        toast({ title: "Gagal menghapus panggilan", description: "Coba lagi sebentar.", variant: "destructive" });
      } finally {
        setRemovingId(null);
      }
    },
    [calls, toast]
  );

  /** Hapus seluruh riwayat (dipanggil dari AlertDialog). */
  const clearAll = useCallback(async () => {
    setClearing(true);
    try {
      const res = await fetch("/api/calls", { method: "DELETE" });
      if (!res.ok) throw new Error("gagal menghapus");
      const data = (await res.json()) as { deleted?: number };
      setCalls([]);
      setConfirmClear(false);
      toast({
        title: "Riwayat panggilan dihapus",
        description: `${(data.deleted ?? 0).toLocaleString("id-ID")} catatan telah dihapus.`,
      });
    } catch {
      toast({ title: "Gagal menghapus riwayat panggilan", description: "Coba lagi sebentar.", variant: "destructive" });
    } finally {
      setClearing(false);
    }
  }, [toast]);

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <header className="flex shrink-0 items-center gap-3 border-b border-border bg-card px-4 py-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Phone className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg font-bold leading-tight tracking-tight">Panggilan</h1>
          <p className="truncate text-xs text-muted-foreground">Riwayat panggilan suara &amp; video</p>
        </div>

        {/* Menu titik-tiga — hapus riwayat panggilan */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto h-10 w-10 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
              aria-label="Menu Panggilan"
              disabled={loading || calls.length === 0}
            >
              <MoreVertical className="h-5 w-5" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem
              variant="destructive"
              className="gap-2"
              onSelect={() => setConfirmClear(true)}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Hapus riwayat panggilan
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <div className="wa-scrollbar flex-1 overflow-y-auto p-3">
        {/* ============ PANGGILAN NYATA (WebRTC) ============ */}
        <section className="mb-4 rounded-xl border border-border bg-card p-4" aria-label="Panggilan nyata">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-maroon-500/15 text-maroon-600">
              <Radio className="h-4.5 w-4.5" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-tight">Panggilan Nyata</p>
              <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span
                  aria-hidden="true"
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    conn === "connected" ? "bg-maroon-500" : conn === "error" ? "bg-red-500" : "bg-amber-500"
                  )}
                />
                {conn === "connected"
                  ? "Realtime tersambung"
                  : conn === "error"
                    ? "Gagal tersambung — coba muat ulang"
                    : "Menyambungkan realtime…"}
              </p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              className="h-8 shrink-0 gap-1.5 rounded-full"
              disabled={confStarting || confActive || Boolean(callActive) || conn !== "connected"}
              onClick={() => void startConference()}
            >
              {confStarting ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <UsersRound className="h-3.5 w-3.5" aria-hidden="true" />}
              Konferensi
            </Button>
          </div>

          <div className="mt-3">
            {conn !== "connected" ? (
              <p className="rounded-lg bg-secondary/60 px-3 py-2.5 text-xs text-muted-foreground">
                Menghubungkan ke layanan realtime — daftar pengguna daring tampil di sini.
              </p>
            ) : peers.length === 0 ? (
              <p className="rounded-lg bg-secondary/60 px-3 py-2.5 text-xs text-muted-foreground">
                Belum ada pengguna lain yang daring. Masuk dengan akun lain di perangkat/tab lain, lalu orang itu
                akan muncul di sini dan bisa ditelepon sungguhan (suara &amp; video).
              </p>
            ) : (
              <ul className="space-y-1">
                {peers.map((p) => (
                  <li
                    key={p.userId}
                    className="flex items-center gap-3 rounded-lg px-1 py-1.5 transition-colors hover:bg-secondary/50"
                  >
                    <span className="relative shrink-0">
                      <span
                        aria-hidden="true"
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-maroon-500/15 text-sm font-bold text-maroon-700 dark:text-maroon-300"
                      >
                        {getInitials(p.username)}
                      </span>
                      <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card bg-maroon-500" aria-label="daring" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{p.username}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {p.accessId} · {roleLabelId(p.role)}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => startCall(p.userId, "VOICE")}
                      disabled={Boolean(callActive) || Boolean(confActive)}
                      aria-label={`Telepon ${p.username}`}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-maroon-600 transition-colors hover:bg-maroon-500/10 disabled:opacity-40"
                    >
                      <Phone className="h-4.5 w-4.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => startCall(p.userId, "VIDEO")}
                      disabled={Boolean(callActive) || Boolean(confActive)}
                      aria-label={`Video call ${p.username}`}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-maroon-600 transition-colors hover:bg-maroon-500/10 disabled:opacity-40"
                    >
                      <Video className="h-4.5 w-4.5" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {loading ? (
          // Skeleton baris daftar panggilan
          <div className="space-y-2" aria-hidden="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                <Skeleton className="h-11 w-11 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-3 w-14" />
              </div>
            ))}
          </div>
        ) : calls.length === 0 ? (
          // Empty state ramah
          <div className="flex flex-col items-center gap-4 pt-10 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Phone className="h-8 w-8" aria-hidden="true" />
            </div>
            <div>
              <p className="font-semibold">Belum ada panggilan</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Riwayat panggilan suara &amp; video akan tampil di sini.
              </p>
            </div>
            <Card className="w-full max-w-sm border-dashed">
              <CardContent className="flex items-start gap-2.5 p-3 text-left">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Telepon atau video call sungguhan dari bagian Panggilan Nyata di atas — pilih pengguna yang daring.
                </p>
              </CardContent>
            </Card>
          </div>
        ) : (
          calls.map((c) => {
            const color = colorOf(c.colorKey);
            const missed = c.direction === "MISSED";
            return (
              <div
                key={c.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:bg-secondary/40"
              >
                <div
                  aria-hidden="true"
                  className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-semibold text-white",
                    color.bg
                  )}
                >
                  <span className="text-sm leading-none">{getInitials(c.contactName)}</span>
                </div>

                <div className="min-w-0 flex-1">
                  <p className={cn("truncate text-sm font-medium", missed && "text-red-600")}>
                    {c.contactName}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs">
                    <DirectionInfo direction={c.direction} />
                    <span className="text-muted-foreground/60" aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      {c.kind === "VIDEO" ? (
                        <Video className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : (
                        <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      {KIND_LABEL[c.kind] ?? "Panggilan"}
                    </span>
                  </p>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-[11px] text-muted-foreground">{timeAgo(c.createdAt)}</span>
                  <span className="flex items-center gap-1.5">
                    <DirectionBadgeIcon direction={c.direction} />
                    {c.durationSec > 0 && (
                      <span className="text-[11px] font-medium text-muted-foreground">
                        {formatDuration(c.durationSec)}
                      </span>
                    )}
                  </span>
                </div>

                {/* Tombol hapus per entri */}
                <button
                  type="button"
                  onClick={() => void removeOne(c.id)}
                  disabled={removingId === c.id}
                  aria-label={`Hapus panggilan ${c.contactName}`}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground/60 transition-colors hover:bg-red-500/10 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {removingId === c.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Konfirmasi hapus seluruh riwayat */}
      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus seluruh riwayat panggilan?</AlertDialogTitle>
            <AlertDialogDescription>
              Semua {calls.length.toLocaleString("id-ID")} catatan panggilan suara &amp; video akan dihapus
              permanen. Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clearing}>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600"
              disabled={clearing}
              onClick={(e) => {
                e.preventDefault(); // tahan dialog sampai selesai
                void clearAll();
              }}
            >
              {clearing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Menghapus…
                </>
              ) : (
                "Hapus semua"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
