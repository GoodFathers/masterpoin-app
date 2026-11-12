"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  DatabaseBackup,
  Download,
  HardDrive,
  Loader2,
  Phone,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useBusinessProfile } from "@/lib/useBusinessProfile";
import { useAuth } from "@/hooks/use-auth";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { formatBytes } from "@/lib/wa-utils";
import { useToast } from "@/hooks/use-toast";
import SettingsRow from "@/components/extras/SettingsRow";
import { LogoutButton } from "@/components/extras/LogoutFlow";

type Backup = { id: string; sizeKb: number; messageCount: number; auto: boolean; createdAt: string; hasFile?: boolean };
type AccountData = {
  phoneNumber: string;
  autoBackup: string;
  backups: Backup[];
  storage: { messageCount: number; mediaCount: number; estSizeKb: number };
};

const AUTO_BACKUP_OPTIONS = [
  { value: "off", label: "Nonaktif" },
  { value: "daily", label: "Harian" },
  { value: "weekly", label: "Mingguan" },
  { value: "monthly", label: "Bulanan" },
];

const QUOTA_KB = 4 * 1024 * 1024; // 4 GB
const nf = new Intl.NumberFormat("id-ID");

/** Kunci storage yang dibersihkan saat akun dihapus (sama dengan performLogout di LogoutFlow). */
const LOGGED_OUT_KEY = "wa_logged_out";
const DEMO_LS_KEYS = ["bj_promo_ads", "bj_social_fb", "bj_social_ig"];

function backupDate(d: string): string {
  const date = new Date(d);
  return (
    date.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" }) +
    " · " +
    date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }).replace(".", ":")
  );
}

export default function SettingsAccountTab() {
  const { businessName } = useBusinessProfile();
  const { toast } = useToast();
  const { user } = useAuth();
  // Batch 1: aksi penghancur data (hapus akun & pulihkan backup) kini hanya
  // untuk Super Admin — selaras dengan guard server requireSuperAdmin.
  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const [data, setData] = useState<AccountData | null>(null);
  const [changeOpen, setChangeOpen] = useState(false);
  const [newNumber, setNewNumber] = useState("");
  const [changePin, setChangePin] = useState("");
  const [changing, setChanging] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<Backup | null>(null); // konfirmasi sebelum pulihkan (Task 48)
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteStep, setDeleteStep] = useState(1);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/account", { cache: "no-store" });
      if (!res.ok) throw new Error("gagal");
      setData(await res.json());
    } catch {
      toast({ title: "Gagal memuat data akun", description: "Coba lagi sebentar.", variant: "destructive" });
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  // ---- Ubah nomor ----
  const changeNumber = async () => {
    if (!newNumber.trim()) return;
    setChanging(true);
    try {
      const res = await fetch("/api/account/change-number", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ newNumber: newNumber.trim(), pin: changePin.trim() }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.error ?? "Gagal mengubah nomor");
      }
      toast({ title: "Nomor berhasil diubah ✅", description: `Nomor baru: ${newNumber.trim()}` });
      setChangeOpen(false);
      setNewNumber("");
      setChangePin("");
      load();
    } catch (err) {
      toast({
        title: "Gagal mengubah nomor",
        description: err instanceof Error ? err.message : "Coba lagi.",
        variant: "destructive",
      });
    } finally {
      setChanging(false);
    }
  };

  // ---- Backup ----
  const setAutoBackup = async (v: string) => {
    const prev = data;
    setData((d) => (d ? { ...d, autoBackup: v } : d));
    try {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ autoBackup: v }),
      });
      if (!res.ok) throw new Error("gagal");
      toast({ title: "Backup otomatis diperbarui", description: `Frekuensi: ${AUTO_BACKUP_OPTIONS.find((o) => o.value === v)?.label}` });
    } catch {
      setData(prev);
      toast({ title: "Gagal menyimpan pengaturan backup", variant: "destructive" });
    }
  };

  const backupNow = async () => {
    setBackingUp(true);
    try {
      const res = await fetch("/api/account/backup", { method: "POST", cache: "no-store" });
      if (!res.ok) throw new Error("gagal");
      const d = await res.json();
      toast({
        title: "Backup selesai ✅",
        description: `${nf.format(d.backup.messageCount)} pesan disimpan ke file (${formatBytes(d.backup.sizeKb * 1024)}).`,
      });
      load();
    } catch {
      toast({ title: "Gagal membuat backup", description: "Coba lagi.", variant: "destructive" });
    } finally {
      setBackingUp(false);
    }
  };

  const restore = async (b: Backup) => {
    setRestoring(b.id);
    try {
      const res = await fetch("/api/account/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ id: b.id }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.error ?? "gagal");
      }
      const d = await res.json();
      toast({
        title: "Pemulihan selesai 🔄",
        description: `${nf.format(d.restoredMessages)} pesan nyata dipulihkan dari file backup.`,
      });
      load();
    } catch (err) {
      toast({
        title: "Gagal memulihkan backup",
        description: err instanceof Error ? err.message : "Coba lagi.",
        variant: "destructive",
      });
    } finally {
      setRestoring(null);
    }
  };

  // ---- Hapus akun (NYATA: seluruh data dihapus permanen dari database) ----
  const deleteAccount = async () => {
    setDeleting(true);
    try {
      const res = await fetch("/api/account/delete", { method: "POST", cache: "no-store" });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.error ?? "Gagal menghapus akun");
      }
      setDeleteOpen(false);
      setDeleteStep(1);
      setConfirmText("");
      // Bersihkan storage lalu tandai sesi keluar — reload menampilkan layar "Anda telah keluar"
      try {
        DEMO_LS_KEYS.forEach((k) => window.localStorage.removeItem(k));
        window.sessionStorage.removeItem(LOGGED_OUT_KEY);
        window.sessionStorage.setItem(LOGGED_OUT_KEY, "1");
      } catch {
        // storage diblokir — tetap lanjut
      }
      window.location.reload();
    } catch (err) {
      toast({
        title: "Gagal menghapus akun",
        description: err instanceof Error ? err.message : "Coba lagi.",
        variant: "destructive",
      });
      setDeleting(false);
    }
  };

  const storage = data?.storage;
  const storagePct = storage ? Math.min(100, (storage.estSizeKb / QUOTA_KB) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Ubah nomor */}
      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-base flex items-center gap-2">
            <Phone className="h-4 w-4 text-primary" aria-hidden="true" /> Ubah Nomor
          </CardTitle>
          <CardDescription>Ganti nomor WhatsApp bisnis tanpa kehilangan chat dan pelanggan</CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          <SettingsRow title="Nomor saat ini" description={data?.phoneNumber ?? "Memuat…"}>
            <Button variant="outline" onClick={() => setChangeOpen(true)} disabled={!data} aria-label="Ubah nomor">
              Ubah
            </Button>
          </SettingsRow>
        </CardContent>
      </Card>

      {/* Backup chat */}
      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-base flex items-center gap-2">
            <DatabaseBackup className="h-4 w-4 text-primary" aria-hidden="true" /> Backup Chat
          </CardTitle>
          <CardDescription>Simpan salinan riwayat chat ke penyimpanan</CardDescription>
        </CardHeader>
        <CardContent className="pt-2 space-y-3">
          <SettingsRow title="Backup otomatis" description="Frekuensi backup chat secara otomatis">
            <Select value={data?.autoBackup ?? "daily"} onValueChange={setAutoBackup} disabled={!data}>
              <SelectTrigger className="w-36" aria-label="Frekuensi backup otomatis">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AUTO_BACKUP_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingsRow>

          <Button onClick={backupNow} disabled={backingUp || !data} className="w-full sm:w-auto" aria-label="Buat backup sekarang">
            {backingUp ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Membuat backup…
              </>
            ) : (
              <>
                <DatabaseBackup className="h-4 w-4" /> Backup Sekarang
              </>
            )}
          </Button>

          <Separator />

          {!data ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : data.backups.length === 0 ? (
            <p className="py-3 text-center text-sm text-muted-foreground">Belum ada backup. Buat backup pertama Anda!</p>
          ) : (
            <ul className="max-h-96 overflow-y-auto wa-scrollbar divide-y divide-border" aria-label="Riwayat backup">
              {data.backups.map((b) => (
                <li key={b.id} className="flex items-center gap-3 py-2.5">
                  <span className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0" aria-hidden="true">
                    <DatabaseBackup className="h-4 w-4 text-muted-foreground" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate flex items-center gap-2">
                      {backupDate(b.createdAt)}
                      {b.auto && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          Otomatis
                        </Badge>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {nf.format(b.messageCount)} pesan · {formatBytes(b.sizeKb * 1024)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {b.hasFile ? (
                      <Button variant="outline" size="sm" asChild>
                        <a
                          href={`/api/account/backup/${b.id}/download`}
                          download
                          aria-label={`Unduh backup ${backupDate(b.createdAt)}`}
                        >
                          <Download className="h-3.5 w-3.5" /> Unduh
                        </a>
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled
                        title="File backup lama tidak tersedia"
                        aria-label={`File backup ${backupDate(b.createdAt)} tidak tersedia`}
                      >
                        <Download className="h-3.5 w-3.5" /> Unduh
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setRestoreTarget(b)}
                      disabled={restoring === b.id || !isSuperAdmin}
                      aria-label={
                        isSuperAdmin
                          ? `Pulihkan backup ${backupDate(b.createdAt)}`
                          : `Pulihkan backup ${backupDate(b.createdAt)} — hanya Super Admin`
                      }
                      title={isSuperAdmin ? undefined : "Hanya Super Admin yang dapat memulihkan backup"}
                    >
                      {restoring === b.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                      Pulihkan
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Penyimpanan */}
      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-base flex items-center gap-2">
            <HardDrive className="h-4 w-4 text-primary" aria-hidden="true" /> Penyimpanan
          </CardTitle>
          <CardDescription>Estimasi penggunaan penyimpanan data chat & media</CardDescription>
        </CardHeader>
        <CardContent className="pt-2 space-y-3">
          {!storage ? (
            <Skeleton className="h-20 w-full" />
          ) : (
            <>
              <div>
                <div className="flex items-center justify-between text-sm mb-1.5">
                  <span className="text-muted-foreground">Terpakai</span>
                  <span className="font-semibold tabular-nums">
                    {formatBytes(storage.estSizeKb * 1024)} <span className="text-muted-foreground font-normal">dari 4 GB</span>
                  </span>
                </div>
                <Progress value={storagePct} aria-label={`Penyimpanan terpakai ${storagePct.toFixed(1)} persen`} className="h-2.5" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Pesan</p>
                  <p className="text-xl font-bold tabular-nums">{nf.format(storage.messageCount)}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Media (foto/video/dokumen)</p>
                  <p className="text-xl font-bold tabular-nums">{nf.format(storage.mediaCount)}</p>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Hapus akun — Batch 1: hanya Super Admin (guard server requireSuperAdmin) */}
      {isSuperAdmin && (
      <Card className="border-red-200 dark:border-red-900">
        <CardHeader className="pb-1">
          <CardTitle className="text-base flex items-center gap-2 text-red-600 dark:text-red-400">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" /> Zona Bahaya
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">Hapus Akun</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Akun dan SELURUH data — chat, katalog, pelanggan, hingga file backup — akan dihapus PERMANEN sekarang.
              </p>
            </div>
            <Button
              variant="destructive"
              onClick={() => {
                setDeleteStep(1);
                setConfirmText("");
                setDeleteOpen(true);
              }}
              className="shrink-0"
              aria-label="Hapus akun"
            >
              <Trash2 className="h-4 w-4" /> Hapus Akun
            </Button>
          </div>
        </CardContent>
      </Card>
      )}

      {/* Keluar dari sesi */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">Keluar</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Tutup sesi {businessName} di perangkat ini. Anda dapat masuk kembali kapan saja.
              </p>
            </div>
            <div className="w-full sm:w-40 shrink-0">
              <LogoutButton appearance="block" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dialog ubah nomor */}
      <Dialog open={changeOpen} onOpenChange={(o) => !changing && setChangeOpen(o)}>
        <DialogContent className="sm:max-w-sm" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Ubah Nomor WhatsApp</DialogTitle>
            <DialogDescription>
              Nomor saat ini: <span className="font-medium text-foreground">{data?.phoneNumber ?? "—"}</span>. Chat,
              grup, dan katalog tetap aman setelah nomor diganti.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 py-1">
            <Label htmlFor="new-number">Nomor baru</Label>
            <Input
              id="new-number"
              value={newNumber}
              onChange={(e) => setNewNumber(e.target.value)}
              placeholder="+62 813-9999-8888"
              inputMode="tel"
              autoFocus
            />
            <p className="text-[11px] text-muted-foreground">Gunakan format Indonesia, mis. +62 812-3456-7890.</p>
          </div>
          <div className="space-y-1.5 pb-1">
            <Label htmlFor="change-number-pin">PIN keamanan</Label>
            <Input
              id="change-number-pin"
              type="password"
              value={changePin}
              onChange={(e) => setChangePin(e.target.value)}
              placeholder="PIN 6 angka akun Anda"
              inputMode="numeric"
              maxLength={6}
              autoComplete="off"
            />
            <p className="text-[11px] text-muted-foreground">
              Wajib bila akun Anda terdaftar dengan PIN 6 angka — demi keamanan aksi sensitif.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangeOpen(false)} disabled={changing}>
              Batal
            </Button>
            <Button onClick={changeNumber} disabled={changing || !newNumber.trim()} className="min-w-32">
              {changing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Menyimpan…
                </>
              ) : (
                "Simpan Nomor"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AlertDialog hapus akun — konfirmasi ganda */}
      <AlertDialog open={deleteOpen} onOpenChange={(o) => !deleting && setDeleteOpen(o)}>
        <AlertDialogContent>
          {deleteStep === 1 ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Yakin ingin menghapus akun?</AlertDialogTitle>
                <AlertDialogDescription>
                  Akun dan SELURUH data (chat, katalog, pelanggan, siaran, backup) akan dihapus PERMANEN sekarang.
                  Tindakan ini tidak dapat dibatalkan.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleting}>Batal</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault();
                    setDeleteStep(2);
                  }}
                  className="bg-red-600 text-white hover:bg-red-700"
                >
                  Lanjutkan
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          ) : (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Konfirmasi terakhir</AlertDialogTitle>
                <AlertDialogDescription>
                  Ketik <span className="font-bold text-foreground">HAPUS</span> di bawah untuk mengonfirmasi. Akun dan
                  SELURUH data akan dihapus PERMANEN sekarang — tidak ada jeda 30 hari.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                placeholder="Ketik HAPUS"
                aria-label="Ketik HAPUS untuk konfirmasi"
                autoFocus
              />
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleting}>Batal</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault();
                    deleteAccount();
                  }}
                  disabled={confirmText !== "HAPUS" || deleting}
                  className="bg-red-600 text-white hover:bg-red-700"
                >
                  {deleting ? "Memproses…" : "Hapus Permanen"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>

      {/* Konfirmasi Pulihkan Cadangan (Task 48): restore MENGGANTI seluruh data saat ini
          dengan isi snapshot — wajib dikonfirmasi eksplisit agar data yang sudah
          diubah/dihapus/ditambahkan pengguna tidak berubah kembali tanpa sengaja. */}
      <AlertDialog
        open={restoreTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRestoreTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" aria-hidden />
              Pulihkan cadangan ini?
            </AlertDialogTitle>
            <AlertDialogDescription>
              SELURUH data saat ini — chat, pesan, produk katalog, kontak, label, channel, komunitas, dan
              pengumuman — akan <span className="font-semibold text-foreground">dihapus dan diganti</span> dengan
              isi cadangan dari{" "}
              <span className="font-semibold text-foreground">
                {restoreTarget ? backupDate(restoreTarget.createdAt) : ""}
              </span>
              . Data yang Anda buat, ubah, atau hapus SETELAH tanggal tersebut akan berubah kembali seperti
              semula. Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restoring !== null}>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-600 text-white hover:bg-amber-700 focus-visible:ring-amber-600"
              disabled={restoring !== null}
              onClick={(e) => {
                e.preventDefault();
                if (restoreTarget) void restore(restoreTarget);
                setRestoreTarget(null);
              }}
            >
              {restoring !== null ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              Ya, Ganti dengan Cadangan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
