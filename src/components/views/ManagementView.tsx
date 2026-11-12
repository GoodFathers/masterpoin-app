"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  CalendarClock,
  Coins,
  Hourglass,
  Loader2,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Timer as TimerIcon,
  UserRoundCog,
  Users,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/chat/ChatMenus";
import { cn, getInitials } from "@/lib/wa-utils";
import { roleAvatarClass, roleBadgeClass, ROLE_LABEL, DASHBOARD_OPTIONS, PERM_LABEL, PERM_LIST, isValidDashboard, type Perm, type Role } from "@/lib/user";
import { formatMp } from "@/lib/indigoo";

// ===================== TIPE =====================

interface ActivationRow {
  id: string;
  username: string;
  name: string;
  accessId: string;
  role: string;
  activationStatus: string;
  activationRequestedAt: string | null;
  activationProcessedAt: string | null;
  activationProcessedBy: string | null;
}

interface ActivationPayload {
  pending: ActivationRow[];
  processed: ActivationRow[];
}

/** Pengguna dari GET /api/users (payload SafeUser + saldo utk konteks). */
interface ManageUserRow {
  id: string;
  accessId: string;
  username: string;
  name: string;
  role: string;
  active: boolean;
  perms?: Perm[];
  dashboard?: string;
  activationStatus?: string;
  bonusMp?: number;
  totalMp?: number;
}

const fmtDateTime = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }) + " WIB"
    : "—";

// ===================== VIEW MANAJEMEN =====================
// Panel manajemen (Super Admin & Admin):
// 1. Permohonan AKTIVASI Timer mP — setujui/tolak.
// 2. (Super Admin) Peran, hak akses & dasbor pengguna.
// 3. (Super Admin) Reset semua saldo & Timer mP ke 0.

export default function ManagementView() {
  const { user: me } = useAuth();
  const { toast } = useToast();
  const isSuperAdmin = me?.role === "SUPER_ADMIN";

  const [activation, setActivation] = useState<ActivationPayload | null>(null);
  const [activationError, setActivationError] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const [users, setUsers] = useState<ManageUserRow[] | null>(null);
  const [usersError, setUsersError] = useState(false);

  const [editTarget, setEditTarget] = useState<ManageUserRow | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  // ---- Muat permohonan aktivasi ----
  const loadActivation = useCallback(async () => {
    try {
      const res = await fetch("/api/management/activation", { cache: "no-store" });
      if (!res.ok) throw new Error("gagal");
      setActivation((await res.json()) as ActivationPayload);
      setActivationError(false);
    } catch {
      setActivationError(true);
    }
  }, []);

  // ---- Muat daftar pengguna (Super Admin saja) ----
  const loadUsers = useCallback(async () => {
    if (!isSuperAdmin) return;
    try {
      const res = await fetch("/api/users", { cache: "no-store" });
      if (!res.ok) throw new Error("gagal");
      const data = (await res.json()) as { users?: ManageUserRow[] };
      setUsers(data.users ?? []);
      setUsersError(false);
    } catch {
      setUsersError(true);
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    void loadActivation();
    void loadUsers();
  }, [loadActivation, loadUsers]);

  // ---- Setujui / tolak permohonan ----
  const processRequest = useCallback(
    async (userId: string, action: "APPROVE" | "REJECT") => {
      setProcessingId(userId + action);
      try {
        const res = await fetch("/api/management/activation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, action }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          toast({ title: "Gagal memproses", description: data.error ?? "Coba lagi.", variant: "destructive" });
          return;
        }
        toast({
          title: action === "APPROVE" ? "Permohonan disetujui ✅" : "Permohonan ditolak",
          description:
            action === "APPROVE"
              ? "Timer mP pengguna mulai berjalan otomatis sekarang."
              : "Pengguna dapat mengajukan permohonan ulang kapan saja.",
        });
        await loadActivation();
      } catch {
        toast({ title: "Gagal memproses", description: "Tidak dapat menghubungi server.", variant: "destructive" });
      } finally {
        setProcessingId(null);
      }
    },
    [loadActivation, toast]
  );

  // ---- Reset semua saldo & Timer ----
  const resetAll = useCallback(async () => {
    setResetting(true);
    try {
      const res = await fetch("/api/admin/reset-mp", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { error?: string; count?: number };
      if (!res.ok) {
        toast({ title: "Gagal reset", description: data.error ?? "Coba lagi.", variant: "destructive" });
        return;
      }
      toast({
        title: "Reset selesai 🔄",
        description: `${data.count ?? 0} akun: saldo mP & Timer kembali ke 0. Timer harus diajukan ulang lewat AKTIVASI.`,
      });
      await Promise.all([loadActivation(), loadUsers()]);
    } catch {
      toast({ title: "Gagal reset", description: "Tidak dapat menghubungi server.", variant: "destructive" });
    } finally {
      setResetting(false);
    }
  }, [loadActivation, loadUsers, toast]);

  const pendingCount = activation?.pending.length ?? 0;

  return (
    <div className="h-full flex flex-col bg-background">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card shrink-0">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold tracking-tight">Manajemen</h1>
          <p className="text-xs text-muted-foreground">Aktivasi Timer mP, hak akses &amp; dasbor pengguna</p>
        </div>
        {pendingCount > 0 && (
          <Badge className="shrink-0 gap-1.5 bg-amber-100 text-amber-800 border border-amber-200 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900">
            <Hourglass className="h-3.5 w-3.5" aria-hidden="true" />
            {pendingCount} permohonan
          </Badge>
        )}
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto wa-scrollbar p-4">
        <div className="max-w-3xl w-full mx-auto space-y-5 pb-8">
          {/* ================= PERMOHONAN AKTIVASI TIMER mP ================= */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <TimerIcon className="h-4 w-4 text-maroon-600" aria-hidden="true" /> Permohonan Aktivasi Timer mP
              </CardTitle>
              <CardDescription>
                Pengguna menyampaikan permohonan &quot;AKTIVASI&quot; — setujui agar Timer mP mereka mulai berjalan.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {activationError && (
                <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
                  Gagal memuat permohonan.{" "}
                  <Button variant="outline" size="sm" className="ml-2" onClick={() => void loadActivation()}>
                    Coba lagi
                  </Button>
                </div>
              )}
              {!activation && !activationError && (
                <div className="space-y-2" aria-hidden="true">
                  <Skeleton className="h-16 w-full rounded-xl" />
                  <Skeleton className="h-16 w-full rounded-xl" />
                </div>
              )}
              {activation && activation.pending.length === 0 && (
                <div className="flex items-center gap-2 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                  <BadgeCheck className="h-4 w-4 text-maroon-600 shrink-0" aria-hidden="true" />
                  Tidak ada permohonan yang menunggu persetujuan.
                </div>
              )}
              {activation &&
                activation.pending.map((p) => (
                  <div key={p.id} className="flex flex-wrap items-center gap-3 rounded-xl border bg-muted/40 p-3">
                    <span
                      className={cn(
                        "h-10 w-10 rounded-full flex items-center justify-center text-[12px] font-bold text-white shrink-0",
                        roleAvatarClass(p.role)
                      )}
                      aria-hidden="true"
                    >
                      {getInitials(p.name || p.username)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">{p.name || p.username}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {p.username} · <span className="font-mono">{p.accessId}</span>
                      </p>
                      <p className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                        <CalendarClock className="h-3 w-3" aria-hidden="true" /> Dikirim: {fmtDateTime(p.activationRequestedAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900 dark:hover:bg-red-950/40"
                        disabled={processingId !== null}
                        onClick={() => void processRequest(p.id, "REJECT")}
                      >
                        {processingId === p.id + "REJECT" ? (
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        ) : (
                          <XCircle className="h-4 w-4" aria-hidden="true" />
                        )}
                        Tolak
                      </Button>
                      <Button
                        size="sm"
                        className="bg-maroon-600 hover:bg-maroon-700"
                        disabled={processingId !== null}
                        onClick={() => void processRequest(p.id, "APPROVE")}
                      >
                        {processingId === p.id + "APPROVE" ? (
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        ) : (
                          <BadgeCheck className="h-4 w-4" aria-hidden="true" />
                        )}
                        Setujui
                      </Button>
                    </div>
                  </div>
                ))}

              {/* Riwayat proses terakhir */}
              {activation && activation.processed.length > 0 && (
                <div className="pt-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Riwayat terakhir
                  </p>
                  <ul className="space-y-1">
                    {activation.processed.slice(0, 8).map((p) => (
                      <li key={p.id} className="flex items-center gap-2 rounded-lg bg-secondary/40 px-3 py-1.5 text-xs">
                        <span className="font-medium truncate">{p.name || p.username}</span>
                        <span className="font-mono text-muted-foreground shrink-0">{p.accessId}</span>
                        <span className="ml-auto shrink-0">
                          {p.activationStatus === "APPROVED" ? (
                            <Badge className="gap-1 bg-maroon-100 text-maroon-700 border border-maroon-200 hover:bg-maroon-100 dark:bg-maroon-950 dark:text-maroon-300 dark:border-maroon-900">
                              <BadgeCheck className="h-3 w-3" aria-hidden="true" /> Disetujui
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1 text-red-600 border-red-200 dark:text-red-400 dark:border-red-900">
                              <XCircle className="h-3 w-3" aria-hidden="true" /> Ditolak
                            </Badge>
                          )}
                        </span>
                        <span className="text-[10px] text-muted-foreground shrink-0 hidden sm:inline">
                          oleh {p.activationProcessedBy ?? "—"} · {fmtDateTime(p.activationProcessedAt)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ================= PERAN, HAK AKSES & DASBOR (Super Admin) ================= */}
          {isSuperAdmin && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4 text-primary" aria-hidden="true" /> Peran, Hak Akses &amp; Dasbor
                  Pengguna
                </CardTitle>
                <CardDescription>
                  Tentukan siapa yang menjadi Admin, atur izin tambahan, dan tetapkan dasbor (halaman awal) tiap
                  pengguna.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {usersError && (
                  <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
                    Gagal memuat daftar pengguna.{" "}
                    <Button variant="outline" size="sm" className="ml-2" onClick={() => void loadUsers()}>
                      Coba lagi
                    </Button>
                  </div>
                )}
                {!users && !usersError && (
                  <div className="space-y-2" aria-hidden="true">
                    <Skeleton className="h-14 w-full rounded-xl" />
                    <Skeleton className="h-14 w-full rounded-xl" />
                    <Skeleton className="h-14 w-full rounded-xl" />
                  </div>
                )}
                {users && (
                  <div className="max-h-96 overflow-y-auto wa-scrollbar space-y-2 pr-0.5" role="list" aria-label="Daftar pengguna">
                    {users.map((u) => (
                      <div key={u.id} className="flex flex-wrap items-center gap-3 rounded-xl border bg-muted/30 p-3" role="listitem">
                        <span
                          className={cn(
                            "h-9 w-9 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0",
                            roleAvatarClass(u.role)
                          )}
                          aria-hidden="true"
                        >
                          {getInitials(u.name || u.username)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold truncate">{u.name || u.username}</p>
                            <span
                              className={cn(
                                "text-[10px] font-semibold border rounded-full px-1.5 py-0.5",
                                roleBadgeClass(u.role)
                              )}
                            >
                              {ROLE_LABEL[u.role as Role] ?? u.role}
                            </span>
                            {!u.active && (
                              <Badge variant="outline" className="text-[10px] text-red-600 border-red-200 dark:text-red-400">
                                Nonaktif
                              </Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {u.username} · <span className="font-mono">{u.accessId}</span>
                            {typeof u.totalMp === "number" ? ` · ${formatMp(u.totalMp)} mP` : ""}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            Dasbor:{" "}
                            <span className="font-medium text-foreground/80">
                              {DASHBOARD_OPTIONS.find((o) => o.id === u.dashboard)?.label ?? "Beranda"}
                            </span>
                            {(u.perms?.length ?? 0) > 0 && u.role !== "SUPER_ADMIN" ? ` · ${u.perms!.length} izin tambahan` : ""}
                          </p>
                        </div>
                        <Button size="sm" variant="outline" className="shrink-0 gap-1.5" onClick={() => setEditTarget(u)}>
                          <UserRoundCog className="h-4 w-4" aria-hidden="true" /> Atur
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ================= RESET SEMUA SALDO & TIMER (Super Admin) ================= */}
          {isSuperAdmin && (
            <Card className="border-red-200 dark:border-red-900">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <RotateCcw className="h-4 w-4 text-red-600" aria-hidden="true" /> Reset Saldo &amp; Timer mP
                </CardTitle>
                <CardDescription>
                  Mengembalikan seluruh saldo mP (bonus) dan Timer semua pengguna ke 0. Timer yang sudah aktif berhenti
                  dan harus diajukan ulang melalui permohonan AKTIVASI.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="destructive" className="gap-2" disabled={resetting} onClick={() => setResetOpen(true)}>
                  {resetting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Coins className="h-4 w-4" aria-hidden="true" />}
                  Reset Semua ke 0
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Dialog atur peran/hak akses/dasbor */}
      <AccessDialog
        target={editTarget}
        meId={me?.id ?? null}
        onClose={() => setEditTarget(null)}
        onSaved={async () => {
          setEditTarget(null);
          await loadUsers();
        }}
      />

      {/* Konfirmasi reset */}
      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Reset semua saldo & Timer ke 0?"
        description="Semua mP (bonus & hasil Timer) seluruh pengguna akan dikembalikan ke 0 dan semua Timer berhenti. Tindakan ini tidak dapat dibatalkan."
        confirmLabel="Ya, Reset Semua"
        destructive
        onConfirm={() => {
          setResetOpen(false);
          void resetAll();
        }}
      />
    </div>
  );
}

// ===================== DIALOG HAK AKSES & DASBOR =====================

function AccessDialog({
  target,
  meId,
  onClose,
  onSaved,
}: {
  target: ManageUserRow | null;
  meId: string | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const { toast } = useToast();
  const [role, setRole] = useState<Role>("USER");
  const [perms, setPerms] = useState<Perm[]>([]);
  const [dashboard, setDashboard] = useState("beranda");
  const [saving, setSaving] = useState(false);

  const isSelf = !!target && target.id === meId;
  const isSuper = role === "SUPER_ADMIN";

  // Isi ulang draft setiap target berubah.
  useEffect(() => {
    if (!target) return;
    setRole((target.role === "SUPER_ADMIN" || target.role === "ADMIN" ? target.role : "USER") as Role);
    setPerms(target.perms ?? []);
    setDashboard(isValidDashboard(target.dashboard) ? target.dashboard : "beranda");
  }, [target]);

  const togglePerm = (p: Perm) => {
    setPerms((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));
  };

  const save = useCallback(async () => {
    if (!target) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/users/${target.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, perms: isSuper ? [] : perms, dashboard }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast({ title: "Gagal menyimpan", description: data.error ?? "Coba lagi.", variant: "destructive" });
        return;
      }
      toast({
        title: "Hak akses diperbarui ✅",
        description: `${target.name || target.username} — peran ${ROLE_LABEL[role]}, dasbor & izin tersimpan.`,
      });
      await onSaved();
    } catch {
      toast({ title: "Gagal menyimpan", description: "Tidak dapat menghubungi server.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }, [dashboard, isSuper, onSaved, perms, role, target, toast]);

  const dashLabel = useMemo(
    () => DASHBOARD_OPTIONS.find((o) => o.id === dashboard)?.label ?? "Beranda",
    [dashboard]
  );

  return (
    <Dialog open={!!target} onOpenChange={(v) => { if (!saving) { if (!v) onClose(); } }}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto wa-scrollbar">
        <DialogHeader>
          <DialogTitle>Atur Akses — {target?.name || target?.username}</DialogTitle>
          <DialogDescription>
            Peran menentukan hak dasar; izin tambahan berlaku untuk peran Pengguna/Admin. Dasbor adalah halaman pertama
            yang dilihat pengguna setelah masuk.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* ---- Peran ---- */}
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">Peran</Label>
            {isSelf ? (
              <p className="text-xs text-muted-foreground rounded-lg bg-muted/60 p-2.5">
                Peran akun sendiri tidak dapat diubah demi keamanan.
              </p>
            ) : (
              <div className="grid gap-1.5" role="radiogroup" aria-label="Peran pengguna">
                {(["USER", "ADMIN", "SUPER_ADMIN"] as Role[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    role="radio"
                    aria-checked={role === r}
                    onClick={() => setRole(r)}
                    className={cn(
                      "flex items-start gap-2.5 rounded-xl border p-3 text-left transition-colors",
                      role === r ? "border-primary bg-primary/5" : "border-border hover:bg-secondary/50"
                    )}
                  >
                    <ShieldCheck
                      className={cn("h-4 w-4 mt-0.5 shrink-0", role === r ? "text-primary" : "text-muted-foreground")}
                      aria-hidden="true"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold">{ROLE_LABEL[r]}</span>
                      <span className="block text-[11px] text-muted-foreground">
                        {r === "USER"
                          ? "Pengguna biasa — fitur komunikasi & konten sendiri."
                          : r === "ADMIN"
                            ? "Mengelola konten toko & marketplace, ikut memproses permohonan aktivasi."
                            : "Akses penuh: akun, konten, marketplace & manajemen."}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ---- Izin tambahan ---- */}
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">Hak Akses Tambahan</Label>
            {isSuper ? (
              <p className="text-xs text-muted-foreground rounded-lg bg-muted/60 p-2.5">
                Super Admin otomatis berhak atas semua izin.
              </p>
            ) : (
              <div className="space-y-1.5">
                {PERM_LIST.map((p) => (
                  <div key={p} className="flex items-start justify-between gap-3 rounded-xl border p-2.5">
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium leading-tight">{PERM_LABEL[p].label}</p>
                      <p className="text-[11px] text-muted-foreground">{PERM_LABEL[p].description}</p>
                    </div>
                    <Switch
                      checked={perms.includes(p)}
                      onCheckedChange={() => togglePerm(p)}
                      aria-label={PERM_LABEL[p].label}
                      className="shrink-0 mt-0.5"
                    />
                  </div>
                ))}
                {role === "ADMIN" && (
                  <p className="text-[11px] text-muted-foreground">
                    Peran Admin sudah termasuk izin Kelola Semua Konten, Marketplace, Unggah Media &amp; Akses
                    Manajemen.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* ---- Dasbor ---- */}
          <div className="space-y-1.5">
            <Label htmlFor="dashboard-select" className="text-sm font-semibold">
              Dasbor Pengguna (halaman awal)
            </Label>
            <Select value={dashboard} onValueChange={setDashboard}>
              <SelectTrigger id="dashboard-select" className="w-full">
                <SelectValue placeholder="Pilih dasbor" />
              </SelectTrigger>
              <SelectContent>
                {DASHBOARD_OPTIONS.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Saat ini: {dashLabel}. Berlaku pada masuk berikutnya.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Batal
          </Button>
          <Button onClick={() => void save()} disabled={saving} className="gap-2 min-w-28">
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Menyimpan…
              </>
            ) : (
              <>
                <Users className="h-4 w-4" aria-hidden="true" /> Simpan
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
