"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Megaphone,
  Send,
  Users,
  Loader2,
  Trash2,
  MoreVertical,
  ImagePlus,
  X,
  Radio,
} from "lucide-react";
import { cn, waListTime } from "@/lib/wa-utils";
import { useToast } from "@/hooks/use-toast";
import ViewHeader from "@/components/business/ViewHeader";
import EmptyState from "@/components/business/EmptyState";
import WaImg from "@/components/business/WaImg";
import { uploadImage } from "@/lib/upload";
import type { Broadcast, Label } from "@/components/business/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label as UiLabel } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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

const MAX_CHARS = 1024;

// ===================== Bar statistik siaran =====================
function BroadcastStats({ b }: { b: Broadcast }) {
  const total = Math.max(b.recipientCount || b.sentCount || 1, 1);
  const segs = [
    { key: "read", label: "Dibaca", count: b.readCount, cls: "bg-sky-500", dot: "bg-sky-500" },
    { key: "delivered", label: "Diterima", count: Math.max(b.deliveredCount - b.readCount, 0), cls: "bg-maroon-500", dot: "bg-maroon-500" },
    { key: "sent", label: "Terkirim", count: Math.max(b.sentCount - b.deliveredCount, 0), cls: "bg-maroon-500", dot: "bg-maroon-500" },
    { key: "failed", label: "Gagal", count: b.failedCount, cls: "bg-red-500", dot: "bg-red-500" },
  ];
  return (
    <div className="space-y-2">
      <div className="flex h-2.5 w-full rounded-full overflow-hidden bg-muted" role="img" aria-label={`Statistik siaran: ${segs.map((s) => `${s.label} ${s.count}`).join(", ")}`}>
        {segs.map(
          (s) =>
            s.count > 0 && <div key={s.key} className={cn("h-full", s.cls)} style={{ width: `${(s.count / total) * 100}%` }} />
        )}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {segs.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className={cn("h-2 w-2 rounded-full", s.dot)} aria-hidden="true" />
            {s.label} <span className="font-medium text-foreground">{s.count}</span>
          </span>
        ))}
        <span className="ml-auto inline-flex items-center gap-1">
          <Users className="h-3 w-3" aria-hidden="true" /> Penerima: <span className="font-medium text-foreground">{b.recipientCount}</span>
        </span>
      </div>
    </div>
  );
}

// ===================== Kartu riwayat siaran =====================
function BroadcastCard({
  b,
  onSend,
  onDelete,
  sending,
}: {
  b: Broadcast;
  onSend: (b: Broadcast) => void;
  onDelete: (b: Broadcast) => void;
  sending: boolean;
}) {
  const isSent = b.status === "SENT";
  return (
    <Card>
      <CardContent className="p-4 sm:p-5 space-y-3">
        <div className="flex items-start gap-3">
          {b.mediaUrl ? (
            <WaImg src={b.mediaUrl} alt={`Lampiran ${b.name}`} className="h-11 w-11 rounded-lg object-cover shrink-0 border" />
          ) : (
            <div className="h-11 w-11 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Megaphone className="h-5 w-5" aria-hidden="true" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium leading-tight">{b.name}</p>
              {isSent ? (
                <Badge className="bg-maroon-600 hover:bg-maroon-600 text-[10px]">Terkirim</Badge>
              ) : (
                <Badge variant="outline" className="text-amber-600 border-amber-500 text-[10px]">Draf</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {waListTime(b.sentAt ?? b.createdAt)} •{" "}
              {b.audienceType === "LABEL" ? `Label: ${b.audienceLabelName ?? "tidak dikenal"}` : "Semua Kontak"}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {!isSent ? (
              <Button size="sm" className="h-8" onClick={() => onSend(b)} disabled={sending}>
                {sending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1.5" />}
                Kirim
              </Button>
            ) : null}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Menu siaran ${b.name}`}>
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {!isSent ? (
                  <DropdownMenuItem onClick={() => onSend(b)}>
                    <Send className="h-4 w-4 mr-2" aria-hidden="true" /> Kirim sekarang
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem onClick={() => onDelete(b)} className="text-red-600 focus:text-red-600">
                  <Trash2 className="h-4 w-4 mr-2" aria-hidden="true" /> Hapus
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <p className={cn("text-sm rounded-lg bg-muted/60 px-3 py-2 whitespace-pre-wrap break-words", isSent ? "line-clamp-3" : "line-clamp-2")}>
          {b.message}
        </p>

        {isSent ? <BroadcastStats b={b} /> : <p className="text-xs text-muted-foreground italic">Belum dikirim — kirim untuk melihat statistik penerimaan.</p>}
      </CardContent>
    </Card>
  );
}

// ===================== View utama =====================
export default function BroadcastView() {
  const { toast } = useToast();
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [loading, setLoading] = useState(true);

  // form
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [audience, setAudience] = useState("ALL"); // "ALL" | "LABEL:<id>"
  const [media, setMedia] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sendingDraft, setSendingDraft] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Broadcast | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [bRes, lRes] = await Promise.all([fetch("/api/broadcasts", { cache: "no-store" }), fetch("/api/labels", { cache: "no-store" })]);
      const bData = await bRes.json();
      const lData = await lRes.json();
      if (!bRes.ok) throw new Error(bData.error || "Gagal memuat siaran");
      if (lRes.ok) setLabels(lData.labels);
      setBroadcasts(bData.broadcasts);
    } catch (e) {
      toast({ title: "Gagal memuat siaran", description: e instanceof Error ? e.message : "Coba lagi", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const handleFile = async (file: File) => {
    try {
      // Batch 4: media siaran diunggah ke server (URL), bukan base64 di DB
      setMedia(await uploadImage(file, "broadcast"));
    } catch (e) {
      toast({ title: "Gagal memuat gambar", description: e instanceof Error ? e.message : "Coba gambar lain", variant: "destructive" });
    }
  };

  const sendBroadcast = async (id: string): Promise<{ recipientCount: number }> => {
    const res = await fetch(`/api/broadcasts/${id}/send`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Gagal mengirim siaran");
    return data.broadcast;
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast({ title: "Nama siaran wajib diisi", variant: "destructive" });
      return;
    }
    if (!message.trim()) {
      toast({ title: "Isi pesan siaran wajib diisi", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const audienceType = audience === "ALL" ? "ALL" : "LABEL";
      const res = await fetch("/api/broadcasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          message: message.trim(),
          mediaUrl: media ?? undefined,
          audienceType,
          audienceLabel: audienceType === "LABEL" ? audience.replace("LABEL:", "") : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal membuat siaran");
      const sent = await sendBroadcast(data.broadcast.id);
      toast({ title: "Siaran terkirim", description: `Diteruskan ke ${sent.recipientCount} kontak.` });
      setName("");
      setMessage("");
      setAudience("ALL");
      setMedia(null);
      await load();
    } catch (e) {
      toast({ title: "Gagal mengirim siaran", description: e instanceof Error ? e.message : "Coba lagi", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const handleSendDraft = async (b: Broadcast) => {
    setSendingDraft(b.id);
    try {
      const sent = await sendBroadcast(b.id);
      toast({ title: "Siaran terkirim", description: `${b.name} diteruskan ke ${sent.recipientCount} kontak.` });
      await load();
    } catch (e) {
      toast({ title: "Gagal mengirim", description: e instanceof Error ? e.message : "Coba lagi", variant: "destructive" });
    } finally {
      setSendingDraft(null);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      const res = await fetch(`/api/broadcasts/${deleting.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menghapus siaran");
      toast({ title: "Siaran dihapus", description: deleting.name });
      setDeleting(null);
      await load();
    } catch (e) {
      toast({ title: "Gagal menghapus", description: e instanceof Error ? e.message : "Coba lagi", variant: "destructive" });
    } finally {
      setDeleteBusy(false);
    }
  };

  const audienceLabelId = audience.startsWith("LABEL:") ? audience.replace("LABEL:", "") : "";
  const estAudience = audience === "ALL" ? "Semua kontak" : labels.find((l) => l.id === audienceLabelId)?.name ?? "";

  return (
    <div className="h-full flex flex-col">
      {/* Header internal hanya desktop — di mobile judul tampil di top bar AppShell
          & logo siaran pindah ke pojok kanan atas (sesuai anotasi) */}
      <ViewHeader icon={Megaphone} title="Siaran" subtitle={loading ? "Memuat..." : `${broadcasts.length} siaran • kirim pesan massal ke pelanggan`} className="hidden md:flex" />

      <div className="flex-1 min-h-0 overflow-y-auto wa-scrollbar p-4 sm:p-6">
        <div className="mx-auto max-w-3xl space-y-6">
          {/* Compose */}
          <Card>
            <CardContent className="p-4 sm:p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Radio className="h-4 w-4 text-primary" aria-hidden="true" />
                <h2 className="font-semibold text-sm sm:text-base">Buat Siaran Baru</h2>
              </div>

              <div className="space-y-1.5">
                <UiLabel htmlFor="bc-name">Nama siaran</UiLabel>
                <Input id="bc-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="cth. Promo Gajian Akhir Bulan" maxLength={80} />
              </div>

              <div className="space-y-1.5">
                <UiLabel htmlFor="bc-msg">Pesan</UiLabel>
                <Textarea
                  id="bc-msg"
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value.slice(0, MAX_CHARS))}
                  placeholder="Tulis pesan siaran... boleh pakai *tebal* untuk penekanan."
                  aria-describedby="bc-msg-count"
                />
                <p id="bc-msg-count" className={cn("text-[11px] text-right", message.length >= MAX_CHARS ? "text-red-600 font-medium" : "text-muted-foreground")}>
                  {message.length}/{MAX_CHARS}
                </p>
              </div>

              <div className="space-y-1.5">
                <UiLabel>Audiens</UiLabel>
                <Select value={audience} onValueChange={setAudience}>
                  <SelectTrigger aria-label="Pilih audiens siaran" className="w-full sm:w-72">
                    <SelectValue placeholder="Pilih audiens" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Semua Kontak</SelectItem>
                    {labels.map((l) => (
                      <SelectItem key={l.id} value={`LABEL:${l.id}`}>
                        Label: {l.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {estAudience ? <p className="text-[11px] text-muted-foreground">Dikirim ke {estAudience} (kontak yang tidak diblokir).</p> : null}
              </div>

              <div className="space-y-1.5">
                <UiLabel>Gambar (opsional)</UiLabel>
                {media ? (
                  <div className="relative w-fit">
                    <WaImg src={media} alt="Lampiran siaran" className="h-20 w-20 rounded-lg object-cover border" />
                    <Button
                      variant="secondary"
                      size="icon"
                      className="absolute -top-2 -right-2 h-6 w-6 rounded-full shadow"
                      onClick={() => setMedia(null)}
                      aria-label="Hapus gambar siaran"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <label className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-input px-3 h-9 text-xs font-medium cursor-pointer hover:bg-accent transition-colors">
                    <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />
                    Tambah gambar
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleFile(f);
                        e.target.value = "";
                      }}
                    />
                  </label>
                )}
              </div>

              <div className="flex justify-end border-t pt-3">
                <Button onClick={handleSubmit} disabled={sending || !name.trim() || !message.trim()} className="min-w-40">
                  {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                  {sending ? "Mengirim..." : "Kirim Siaran"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Riwayat */}
          <section aria-label="Riwayat siaran" className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground">Riwayat Siaran</h2>
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-44 w-full rounded-xl" />)
            ) : broadcasts.length === 0 ? (
              <EmptyState icon={Megaphone} title="Belum ada siaran" description="Buat siaran pertama Anda untuk mengumumkan promo atau info penting ke pelanggan." />
            ) : (
              broadcasts.map((b) => (
                <BroadcastCard key={b.id} b={b} onSend={handleSendDraft} onDelete={setDeleting} sending={sendingDraft === b.id} />
              ))
            )}
          </section>
        </div>
      </div>

      {/* Konfirmasi hapus */}
      <AlertDialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus siaran ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Siaran <span className="font-medium text-foreground">{deleting?.name}</span> akan dihapus permanen beserta statistiknya.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteBusy}>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={deleteBusy}
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
            >
              {deleteBusy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
