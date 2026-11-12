"use client";

import { useCallback, useEffect, useState } from "react";
import { Phone, Video, PhoneIncoming, PhoneOutgoing, PhoneMissed, Loader2, PhoneCall, Trash2, MoreVertical } from "lucide-react";
import { cn, WIB_TZ } from "@/lib/wa-utils";
import { wibDateKey } from "@/lib/wib";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/chat/ChatMenus";
import CallDialog from "@/components/chat/CallDialog";
import ChatAvatar from "@/components/chat/ChatAvatar";

type CallLog = {
  id: string;
  contactId: string | null;
  contactName: string;
  colorKey: string;
  kind: string; // VOICE | VIDEO
  direction: string; // IN | OUT | MISSED
  durationSec: number;
  createdAt: string;
};

function durationText(sec: number): string {
  if (sec <= 0) return "";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m} mnt ${s > 0 ? `${s} dtk` : ""}`.trim() : `${s} dtk`;
}

function timeText(iso: string): string {
  const d = new Date(iso);
  const key = wibDateKey(d);
  const time = d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: WIB_TZ });
  if (key === wibDateKey(new Date())) return time;
  if (key === wibDateKey(new Date(Date.now() - 86_400_000))) return `Kemarin, ${time}`;
  return `${d.toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: WIB_TZ })}, ${time}`;
}

type RedialTarget = {
  kind: "VOICE" | "VIDEO";
  contactId: string;
  contactName: string;
  colorKey: string;
};

export default function CallsView() {
  const { toast } = useToast();
  const [calls, setCalls] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [redialTarget, setRedialTarget] = useState<RedialTarget | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [clearOpen, setClearOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/calls", { cache: "no-store" });
      const data = (await res.json()) as { calls?: CallLog[] };
      setCalls(data.calls ?? []);
    } catch {
      toast({ title: "Gagal memuat riwayat panggilan", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  // Menu "Bersihkan riwayat" di pojok kanan top bar AppShell (mobile) memicu event ini
  useEffect(() => {
    const onClear = () => setClearOpen(true);
    window.addEventListener("wa:calls:clear", onClear);
    return () => window.removeEventListener("wa:calls:clear", onClear);
  }, []);

  const deleteOne = async (c: CallLog) => {
    setDeleting(c.id);
    try {
      const res = await fetch(`/api/calls/${c.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Gagal menghapus");
      setCalls((prev) => prev.filter((x) => x.id !== c.id));
      toast({ title: "Panggilan dihapus dari riwayat", description: c.contactName });
    } catch {
      toast({ title: "Gagal menghapus panggilan", variant: "destructive" });
    } finally {
      setDeleting(null);
    }
  };

  const clearAll = async () => {
    setClearing(true);
    try {
      const res = await fetch("/api/calls", { method: "DELETE" });
      const data = (await res.json()) as { deleted?: number };
      if (!res.ok) throw new Error();
      setCalls([]);
      toast({ title: "Riwayat panggilan dibersihkan", description: `${data.deleted ?? 0} entri dihapus.` });
    } catch {
      toast({ title: "Gagal membersihkan riwayat", variant: "destructive" });
    } finally {
      setClearing(false);
    }
  };

  // Panggil ulang NYATA: buka dialog panggilan WebRTC (durasi & riwayat dicatat sungguhan)
  const redial = (c: CallLog) => {
    if (!c.contactId) {
      toast({
        title: "Kontak tidak tersedia",
        description: "Panggil ulang memerlukan kontak tersimpan — simpan kontaknya terlebih dahulu.",
        variant: "destructive",
      });
      return;
    }
    setRedialTarget({
      kind: c.kind === "VIDEO" ? "VIDEO" : "VOICE",
      contactId: c.contactId,
      contactName: c.contactName,
      colorKey: c.colorKey,
    });
  };

  const DirectionIcon = ({ d }: { d: string }) =>
    d === "MISSED" ? (
      <PhoneMissed className="h-3.5 w-3.5 text-red-500" aria-label="Tak terjawab" />
    ) : d === "IN" ? (
      <PhoneIncoming className="h-3.5 w-3.5 text-maroon-500" aria-label="Masuk" />
    ) : (
      <PhoneOutgoing className="h-3.5 w-3.5 text-sky-500" aria-label="Keluar" />
    );

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Kepala — hanya desktop; di mobile judul ada di top bar AppShell & logo telepon pindah ke pojok kanannya
          (menu pojok memuat aksi "Bersihkan riwayat") */}
      <div className="hidden shrink-0 px-4 pt-4 pb-3 border-b border-border md:block">
        <div className="flex items-center gap-2">
          <span className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Phone className="h-5 w-5 text-primary" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-lg font-bold tracking-tight leading-tight">Panggilan</h1>
            <p className="text-xs text-muted-foreground leading-tight">Riwayat panggilan suara &amp; video</p>
          </div>
          {calls.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto shrink-0 gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={() => setClearOpen(true)}
            >
              <Trash2 className="h-4 w-4" /> Bersihkan riwayat
            </Button>
          )}
        </div>
      </div>

      {/* Daftar */}
      <div className="flex-1 min-h-0 overflow-y-auto wa-scrollbar pb-8" role="list" aria-label="Riwayat panggilan">
        {loading && (
          <div className="space-y-1 px-3 py-2" aria-hidden="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-2.5">
                <Skeleton className="h-11 w-11 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-1/3" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
                <Skeleton className="h-8 w-8 rounded-full" />
              </div>
            ))}
          </div>
        )}

        {!loading && calls.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center gap-3">
            <span className="h-14 w-14 rounded-full bg-secondary flex items-center justify-center">
              <PhoneCall className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
            </span>
            <p className="text-sm font-medium">Belum ada riwayat panggilan</p>
            <p className="text-xs text-muted-foreground">Panggilan suara/video yang diterima atau dilakukan akan tampil di sini.</p>
          </div>
        )}

        {!loading &&
          calls.map((c) => (
            <div key={c.id} role="listitem" className="flex items-center gap-2 pl-3 pr-1.5 py-2.5 border-b border-border/60 last:border-b-0 hover:bg-secondary/50 transition-colors">
              <ChatAvatar name={c.contactName} colorKey={c.colorKey} className="h-11 w-11 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className={cn("text-[15px] font-medium truncate", c.direction === "MISSED" && "text-red-500")}>
                  {c.contactName}
                </p>
                <p className="text-[13px] text-muted-foreground flex items-center gap-1.5 truncate">
                  <DirectionIcon d={c.direction} />
                  {c.direction === "MISSED" ? "Tak terjawab" : durationText(c.durationSec) || "Selesai"}
                  <span className="text-muted-foreground/60">· {timeText(c.createdAt)}</span>
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Panggil ulang ${c.contactName} via ${c.kind === "VIDEO" ? "video" : "suara"}`}
                onClick={() => redial(c)}
                className="shrink-0"
              >
                {c.kind === "VIDEO" ? (
                  <Video className="h-5 w-5 text-primary" />
                ) : (
                  <Phone className="h-5 w-5 text-primary" />
                )}
              </Button>
              {/* Menu hapus per-panggilan */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="shrink-0" aria-label={`Menu panggilan ${c.contactName}`}>
                    <MoreVertical className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem
                    className="gap-2 cursor-pointer text-red-600 focus:text-red-600"
                    onClick={() => void deleteOne(c)}
                    disabled={deleting === c.id}
                  >
                    {deleting === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    Hapus dari riwayat
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
      </div>

      {/* Konfirmasi bersihkan semua riwayat */}
      <ConfirmDialog
        open={clearOpen}
        onOpenChange={setClearOpen}
        title="Bersihkan riwayat panggilan?"
        description="Seluruh riwayat panggilan suara & video akan dihapus permanen dari perangkat ini."
        confirmLabel={clearing ? "Membersihkan…" : "Bersihkan"}
        destructive
        onConfirm={() => void clearAll()}
      />

      {/* Panggilan ulang — WebRTC nyata; riwayat baru otomatis dimuat setelah selesai */}
      {redialTarget ? (
        <CallDialog
          mode="outgoing"
          contactId={redialTarget.contactId}
          contactName={redialTarget.contactName}
          colorKey={redialTarget.colorKey}
          avatarUrl={null}
          kind={redialTarget.kind}
          onEnd={() => {
            setRedialTarget(null);
            void load();
          }}
        />
      ) : null}
    </div>
  );
}
