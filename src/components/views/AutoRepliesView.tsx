"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Bot,
  Store,
  Handshake,
  MoonStar,
  Zap,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  MessageSquareText,
} from "lucide-react";
import { cn } from "@/lib/wa-utils";
import { useToast } from "@/hooks/use-toast";
import ViewHeader from "@/components/business/ViewHeader";
import type { QuickReply } from "@/components/business/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label as UiLabel } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

interface AutoState {
  greetingEnabled: boolean;
  greetingText: string;
  awayEnabled: boolean;
  awayText: string;
  storeOpen: boolean;
}

// ===================== Dialog balasan cepat =====================
function QuickReplyDialog({
  open,
  onOpenChange,
  qr,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  qr: QuickReply | null;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [shortcut, setShortcut] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setShortcut(qr?.shortcut ?? "");
      setMessage(qr?.message ?? "");
    }
  }, [open, qr]);

  const handleSave = async () => {
    if (!shortcut.trim()) {
      toast({ title: "Shortcut wajib diisi", variant: "destructive" });
      return;
    }
    if (!message.trim()) {
      toast({ title: "Isi pesan wajib diisi", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(qr ? `/api/quick-replies/${qr.id}` : "/api/quick-replies", {
        method: qr ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shortcut: shortcut.trim(), message: message.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan balasan cepat");
      toast({ title: qr ? "Balasan cepat diperbarui" : "Balasan cepat ditambahkan", description: data.quickReply?.shortcut ?? shortcut.trim() });
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast({ title: "Gagal menyimpan", description: e instanceof Error ? e.message : "Coba lagi", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{qr ? "Edit Balasan Cepat" : "Balasan Cepat Baru"}</DialogTitle>
          <DialogDescription>
            Ketik pintasan di kolom chat (mis. <code className="font-mono text-xs bg-muted px-1 rounded">/harga</code>) untuk mengirim pesan ini dengan cepat.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <UiLabel htmlFor="qr-shortcut">Shortcut</UiLabel>
            <Input
              id="qr-shortcut"
              value={shortcut}
              onChange={(e) => setShortcut(e.target.value)}
              placeholder="/harga"
              className="font-mono"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
            />
            <p className="text-[11px] text-muted-foreground">Harus diawali tanda &quot;/&quot; — ditambahkan otomatis jika lupa. Harus unik.</p>
          </div>
          <div className="space-y-1.5">
            <UiLabel htmlFor="qr-message">Pesan</UiLabel>
            <Textarea id="qr-message" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Isi pesan yang akan dikirim..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Batal
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {qr ? "Simpan" : "Tambahkan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===================== View utama =====================
export default function AutoRepliesView() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [auto, setAuto] = useState<AutoState | null>(null);
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const [qrOpen, setQrOpen] = useState(false);
  const [editingQr, setEditingQr] = useState<QuickReply | null>(null);
  const [deletingQr, setDeletingQr] = useState<QuickReply | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [aRes, qRes] = await Promise.all([fetch("/api/autoreplies", { cache: "no-store" }), fetch("/api/quick-replies", { cache: "no-store" })]);
      const aData = await aRes.json();
      const qData = await qRes.json();
      if (!aRes.ok) throw new Error(aData.error || "Gagal memuat pengaturan");
      setAuto(aData);
      if (qRes.ok) setQuickReplies(qData.quickReplies);
    } catch (e) {
      toast({ title: "Gagal memuat data", description: e instanceof Error ? e.message : "Coba lagi", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const saveAuto = async (patch: Partial<AutoState>, key: string, title: string) => {
    setSavingKey(key);
    try {
      const res = await fetch("/api/autoreplies", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan pengaturan");
      setAuto((prev) => (prev ? { ...prev, ...data } : data));
      toast({ title });
    } catch (e) {
      toast({ title: "Gagal menyimpan", description: e instanceof Error ? e.message : "Coba lagi", variant: "destructive" });
    } finally {
      setSavingKey(null);
    }
  };

  const handleDeleteQr = async () => {
    if (!deletingQr) return;
    setDeleteBusy(true);
    try {
      const res = await fetch(`/api/quick-replies/${deletingQr.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menghapus balasan cepat");
      toast({ title: "Balasan cepat dihapus", description: deletingQr.shortcut });
      setDeletingQr(null);
      await load();
    } catch (e) {
      toast({ title: "Gagal menghapus", description: e instanceof Error ? e.message : "Coba lagi", variant: "destructive" });
    } finally {
      setDeleteBusy(false);
    }
  };

  const storeOpen = auto?.storeOpen ?? true;

  return (
    <div className="h-full flex flex-col">
      {/* Header internal hanya desktop — di mobile judul tampil di top bar AppShell
          & logo bot pindah ke pojok kanan atas (sesuai anotasi) */}
      <ViewHeader icon={Bot} title="Pesan Otomatis" subtitle="Atur balasan otomatis & pintasan cepat agar pelanggan selalu terlayani" className="hidden md:flex" />

      <div className="flex-1 min-h-0 overflow-y-auto wa-scrollbar p-4 sm:p-6">
        <div className="mx-auto max-w-4xl space-y-4">
          {loading ? (
            <>
              <Skeleton className="h-40 w-full rounded-xl" />
              <div className="grid gap-4 lg:grid-cols-2">
                <Skeleton className="h-56 w-full rounded-xl" />
                <Skeleton className="h-56 w-full rounded-xl" />
              </div>
              <Skeleton className="h-64 w-full rounded-xl" />
            </>
          ) : !auto ? (
            <p className="text-sm text-muted-foreground text-center py-12">Pengaturan tidak tersedia.</p>
          ) : (
            <>
              {/* Status Toko */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Store className="h-4 w-4 text-primary" aria-hidden="true" /> Status Toko
                  </CardTitle>
                  <CardDescription>Toko buka atau tutup memengaruhi balasan otomatis.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div
                    className={cn(
                      "rounded-xl border p-4 flex items-center gap-4 transition-colors",
                      storeOpen ? "border-maroon-300 bg-maroon-50 dark:border-maroon-900 dark:bg-maroon-950/40" : "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40"
                    )}
                  >
                    <Switch checked={storeOpen} onCheckedChange={(v) => setAuto({ ...auto, storeOpen: v })} aria-label="Status toko buka atau tutup" className="scale-125" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{storeOpen ? "Toko Buka" : "Toko Tutup"}</p>
                      <p className="text-xs text-muted-foreground">Jika toko tutup, away message otomatis dibalas ke setiap chat masuk.</p>
                    </div>
                    <Badge className={cn("shrink-0", storeOpen ? "bg-maroon-600 hover:bg-maroon-600" : "bg-red-600 hover:bg-red-600")}>
                      {storeOpen ? "Buka" : "Tutup"}
                    </Badge>
                  </div>
                  <div className="flex justify-end">
                    <Button size="sm" onClick={() => saveAuto({ storeOpen }, "store", "Status toko disimpan")} disabled={savingKey === "store"}>
                      {savingKey === "store" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Simpan Status
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-4 lg:grid-cols-2">
                {/* Pesan Sambutan */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Handshake className="h-4 w-4 text-primary" aria-hidden="true" /> Pesan Sambutan
                    </CardTitle>
                    <CardDescription>Dikirim otomatis saat chat baru dimulai.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <UiLabel htmlFor="greet-enable" className="text-sm font-normal cursor-pointer">
                        Aktifkan pesan sambutan
                      </UiLabel>
                      <Switch id="greet-enable" checked={auto.greetingEnabled} onCheckedChange={(v) => setAuto({ ...auto, greetingEnabled: v })} aria-label="Aktifkan pesan sambutan" />
                    </div>
                    <div className="space-y-1.5">
                      <UiLabel htmlFor="greet-text">Isi pesan</UiLabel>
                      <Textarea
                        id="greet-text"
                        rows={3}
                        value={auto.greetingText}
                        onChange={(e) => setAuto({ ...auto, greetingText: e.target.value })}
                        placeholder="Halo kak! Terima kasih sudah menghubungi IndiGoo 😊 Ada yang bisa kami bantu?"
                        disabled={!auto.greetingEnabled}
                      />
                    </div>
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        onClick={() => saveAuto({ greetingEnabled: auto.greetingEnabled, greetingText: auto.greetingText }, "greeting", "Pesan sambutan disimpan")}
                        disabled={savingKey === "greeting"}
                      >
                        {savingKey === "greeting" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Simpan
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Pesan di Luar Jam Kerja */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <MoonStar className="h-4 w-4 text-primary" aria-hidden="true" /> Pesan di Luar Jam Kerja
                    </CardTitle>
                    <CardDescription>Dikirim saat toko tutup atau di luar jam operasional.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <UiLabel htmlFor="away-enable" className="text-sm font-normal cursor-pointer">
                        Aktifkan pesan luar jam kerja
                      </UiLabel>
                      <Switch id="away-enable" checked={auto.awayEnabled} onCheckedChange={(v) => setAuto({ ...auto, awayEnabled: v })} aria-label="Aktifkan pesan luar jam kerja" />
                    </div>
                    <div className="space-y-1.5">
                      <UiLabel htmlFor="away-text">Isi pesan</UiLabel>
                      <Textarea
                        id="away-text"
                        rows={3}
                        value={auto.awayText}
                        onChange={(e) => setAuto({ ...auto, awayText: e.target.value })}
                        placeholder="Maaf kak, kami sedang tutup. Pesan akan kami balas begitu toko buka kembali 🙏"
                        disabled={!auto.awayEnabled}
                      />
                    </div>
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        onClick={() => saveAuto({ awayEnabled: auto.awayEnabled, awayText: auto.awayText }, "away", "Pesan luar jam kerja disimpan")}
                        disabled={savingKey === "away"}
                      >
                        {savingKey === "away" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Simpan
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Balasan Cepat */}
              <Card>
                <CardHeader className="pb-3">
                  <CardAction>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingQr(null);
                        setQrOpen(true);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-1.5" aria-hidden="true" /> Tambah
                    </Button>
                  </CardAction>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Zap className="h-4 w-4 text-primary" aria-hidden="true" /> Balasan Cepat
                  </CardTitle>
                  <CardDescription>Pintasan berawalan &quot;/&quot; untuk membalas chat pelanggan lebih cepat.</CardDescription>
                </CardHeader>
                <CardContent>
                  {quickReplies.length === 0 ? (
                    <div className="flex flex-col items-center text-center gap-2 py-8">
                      <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center text-muted-foreground">
                        <MessageSquareText className="h-6 w-6" aria-hidden="true" />
                      </div>
                      <p className="text-sm font-medium">Belum ada balasan cepat</p>
                      <p className="text-xs text-muted-foreground max-w-xs">Buat pintasan seperti /harga atau /ongkir untuk membalas lebih cepat.</p>
                      <Button
                        size="sm"
                        className="mt-1"
                        onClick={() => {
                          setEditingQr(null);
                          setQrOpen(true);
                        }}
                      >
                        <Plus className="h-4 w-4 mr-1.5" aria-hidden="true" /> Buat Sekarang
                      </Button>
                    </div>
                  ) : (
                    <div className="max-h-96 overflow-y-auto wa-scrollbar divide-y">
                      {quickReplies.map((qr) => (
                        <div key={qr.id} className="flex items-center gap-3 py-3">
                          <code className="text-xs font-semibold bg-muted px-2 py-1 rounded shrink-0 font-mono">{qr.shortcut}</code>
                          <p className="text-sm text-muted-foreground line-clamp-1 flex-1 min-w-0">{qr.message}</p>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              aria-label={`Edit balasan cepat ${qr.shortcut}`}
                              onClick={() => {
                                setEditingQr(qr);
                                setQrOpen(true);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                              aria-label={`Hapus balasan cepat ${qr.shortcut}`}
                              onClick={() => setDeletingQr(qr)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>

      <QuickReplyDialog open={qrOpen} onOpenChange={setQrOpen} qr={editingQr} onSaved={load} />

      {/* Konfirmasi hapus balasan cepat */}
      <AlertDialog open={!!deletingQr} onOpenChange={(v) => !v && setDeletingQr(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus balasan cepat ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Pintasan <code className="font-mono bg-muted px-1 rounded">{deletingQr?.shortcut}</code> akan dihapus permanen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteBusy}>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={deleteBusy}
              onClick={(e) => {
                e.preventDefault();
                handleDeleteQr();
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
