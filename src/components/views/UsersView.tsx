"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  UsersRound,
  UserCog,
  ShieldCheck,
  ShieldAlert,
  User,
  Plus,
  Search,
  Loader2,
  Pencil,
  Trash2,
  KeyRound,
  ShieldOff,
  Shield,
  BadgeCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/wa-utils";
import { useAuth } from "@/hooks/use-auth";
import {
  ROLE_LABEL,
  can,
  roleBadgeClass,
  roleAvatarClass,
  type SafeUser,
  type Role,
} from "@/lib/user";
import { ConfirmDialog } from "@/components/chat/ChatMenus";

type Draft = { name: string; username: string; password: string; role: Role };

const EMPTY_DRAFT: Draft = { name: "", username: "", password: "", role: "USER" };

function initialsOf(u: SafeUser): string {
  return (u.name || u.username || "?").slice(0, 2).toUpperCase();
}

function dateId(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" });
}

export default function UsersView() {
  const { user: me } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<SafeUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<SafeUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SafeUser | null>(null);
  const [busy, setBusy] = useState(false);

  const permitted = can(me?.role, "users.manage");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/users", { cache: "no-store" });
      const data = (await res.json()) as { users?: SafeUser[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Gagal memuat pengguna");
      setUsers(data.users ?? []);
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Gagal memuat pengguna", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (permitted) void load();
    else setLoading(false);
  }, [permitted, load]);

  // Batch 5: tombol "+ Tambah akun" di top bar (mobile) — paritas dengan desktop
  useEffect(() => {
    const openNew = () => setAddOpen(true);
    window.addEventListener("wa:users:new", openNew);
    return () => window.removeEventListener("wa:users:new", openNew);
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return users;
    return users.filter((u) =>
      [u.name, u.username, u.accessId, ROLE_LABEL[u.role]].some((v) => v.toLowerCase().includes(needle))
    );
  }, [users, q]);

  const stats = useMemo(
    () => ({
      total: users.length,
      superAdmin: users.filter((u) => u.role === "SUPER_ADMIN").length,
      admin: users.filter((u) => u.role === "ADMIN").length,
      pengguna: users.filter((u) => u.role === "USER").length,
      nonaktif: users.filter((u) => !u.active).length,
    }),
    [users]
  );

  // ---------- aksi ----------
  const toggleActive = async (u: SafeUser) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/users/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !u.active }),
      });
      const data = (await res.json()) as { user?: SafeUser; error?: string };
      if (!res.ok || !data.user) throw new Error(data.error ?? "Gagal mengubah status");
      setUsers((prev) => prev.map((p) => (p.id === u.id ? data.user! : p)));
      toast({ title: `${data.user.name} ${data.user.active ? "diaktifkan" : "dinonaktifkan"}` });
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Gagal mengubah status", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async (u: SafeUser) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/users/${u.id}`, { method: "DELETE" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Gagal menghapus pengguna");
      setUsers((prev) => prev.filter((p) => p.id !== u.id));
      toast({ title: `${u.name || u.username} dihapus` });
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Gagal menghapus pengguna", variant: "destructive" });
    } finally {
      setBusy(false);
      setDeleteTarget(null);
    }
  };

  // ---------- guard tampilan ----------
  if (!permitted) {
    return (
      <div className="h-full flex items-center justify-center p-8 bg-background">
        <div className="text-center space-y-3 max-w-xs">
          <span className="h-14 w-14 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
            <ShieldOff className="h-6 w-6 text-red-500" aria-hidden="true" />
          </span>
          <p className="font-semibold">Akses ditolak</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Manajemen Pengguna hanya dapat diakses oleh akun <span className="font-medium">Super Admin</span>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Kepala */}
      <div className="shrink-0 px-4 pt-4 pb-3 border-b border-border">
        {/* Baris judul hanya desktop — di mobile judul tampil di top bar AppShell
            & logo manajemen pengguna pindah ke pojok kanan atas (sesuai anotasi).
            Statistik peran & pencarian tetap tampil di mobile. */}
        <div className="hidden md:flex items-center gap-2 mb-3">
          <span className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <UserCog className="h-5 w-5 text-primary" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h1 className="text-lg font-bold tracking-tight leading-tight">Manajemen Pengguna</h1>
            <p className="text-xs text-muted-foreground leading-tight">
              Tambah, edit, hapus akun & atur peran — khusus Super Admin
            </p>
          </div>
          <Button size="sm" className="ml-auto shrink-0 gap-1.5" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Tambah
          </Button>
        </div>

        {/* Statistik peran */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          <StatChip icon={UsersRound} label="Total akun" value={stats.total} />
          <StatChip icon={ShieldCheck} label="Super Admin" value={stats.superAdmin} tone="emerald" />
          <StatChip icon={ShieldAlert} label="Admin" value={stats.admin} tone="amber" />
          <StatChip icon={User} label="Pengguna" value={stats.pengguna} tone="slate" />
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari nama, username, ID, atau peran"
            aria-label="Cari pengguna"
            className="pl-9 bg-secondary border-transparent h-10 rounded-xl"
          />
        </div>
      </div>

      {/* Daftar */}
      <div className="flex-1 min-h-0 overflow-y-auto wa-scrollbar p-3 pb-8" role="list" aria-label="Daftar pengguna">
        {loading ? (
          <div className="space-y-2" aria-hidden="true">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 rounded-xl border border-border bg-card p-3 flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 w-1/3 bg-muted rounded animate-pulse" />
                  <div className="h-3 w-1/4 bg-muted rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center gap-3">
            <span className="h-14 w-14 rounded-full bg-secondary flex items-center justify-center">
              <UsersRound className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
            </span>
            <p className="text-sm font-medium">Tidak ada pengguna cocok</p>
            <p className="text-xs text-muted-foreground">Coba kata kunci lain atau tambah akun baru.</p>
          </div>
        ) : (
          <div className="space-y-2 max-w-3xl mx-auto">
            {filtered.map((u) => {
              const isSelf = u.id === me?.id;
              return (
                <article
                  key={u.id}
                  role="listitem"
                  className={cn(
                    "rounded-xl border border-border bg-card p-3 flex items-center gap-3 transition-shadow hover:shadow-sm",
                    !u.active && "opacity-60"
                  )}
                >
                  <span
                    className={cn(
                      "h-10 w-10 rounded-full flex items-center justify-center text-[13px] font-bold text-white shrink-0",
                      roleAvatarClass(u.role)
                    )}
                    aria-hidden="true"
                  >
                    {initialsOf(u)}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-semibold leading-tight truncate">
                        {u.name || u.username}
                        {isSelf && <span className="ml-1 text-[10px] font-medium text-primary">(Anda)</span>}
                      </p>
                      <span className={cn("text-[10px] font-semibold border rounded-full px-1.5 py-0.5", roleBadgeClass(u.role))}>
                        {ROLE_LABEL[u.role]}
                      </span>
                      {!u.active && (
                        <span className="text-[10px] font-semibold bg-red-100 text-red-700 border border-red-200 rounded-full px-1.5 py-0.5">
                          Nonaktif
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-tight mt-0.5 truncate">
                      <span className="font-mono">{u.accessId}</span> · @{u.username} · bergabung {dateId(u.createdAt)}
                    </p>
                  </div>

                  {/* Aksi */}
                  <div className="flex items-center gap-0.5 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      aria-label={`Edit ${u.name || u.username}`}
                      onClick={() => setEditTarget(u)}
                    >
                      <Pencil className="h-4 w-4 text-muted-foreground" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      aria-label={u.active ? `Nonaktifkan ${u.name || u.username}` : `Aktifkan ${u.name || u.username}`}
                      disabled={busy || isSelf}
                      onClick={() => void toggleActive(u)}
                    >
                      {u.active ? <ShieldOff className="h-4 w-4 text-amber-600" /> : <Shield className="h-4 w-4 text-primary" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      aria-label={`Hapus ${u.name || u.username}`}
                      disabled={busy || isSelf}
                      onClick={() => setDeleteTarget(u)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* Dialog tambah */}
      <UserFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSaved={(u) => {
          setUsers((prev) => [...prev, u]);
          toast({ title: `Akun ${u.name || u.username} dibuat` });
        }}
      />

      {/* Dialog edit */}
      <UserFormDialog
        open={!!editTarget}
        onOpenChange={(o) => {
          if (!o) setEditTarget(null);
        }}
        target={editTarget}
        onSaved={(u) => {
          setUsers((prev) => prev.map((p) => (p.id === u.id ? u : p)));
          if (editTarget && u.id === me?.id) {
            toast({ title: "Profil akun Anda diperbarui" });
          } else {
            toast({ title: `Perubahan ${u.name || u.username} tersimpan` });
          }
        }}
      />

      {/* Konfirmasi hapus */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => {
          if (!o) setDeleteTarget(null);
        }}
        title={`Hapus akun ${deleteTarget?.name || deleteTarget?.username || ""}?`}
        description="Akun akan dihapus permanen. Video yang pernah diunggah tetap tampil di Beranda. Aksi ini tidak dapat dibatalkan."
        confirmLabel="Hapus"
        destructive
        onConfirm={() => deleteTarget && void doDelete(deleteTarget)}
      />
    </div>
  );
}

// ---------- chip statistik ----------
function StatChip({
  icon: Icon,
  label,
  value,
  tone = "slate",
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  tone?: "emerald" | "amber" | "slate";
}) {
  const toneClass =
    tone === "emerald" ? "bg-primary/10 text-primary" : tone === "amber" ? "bg-amber-500/10 text-amber-600" : "bg-secondary text-muted-foreground";
  return (
    <div className="rounded-xl border border-border bg-card px-2.5 py-2 flex items-center gap-2">
      <span className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", toneClass)}>
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-base font-bold leading-none">{value}</p>
        <p className="text-[10px] text-muted-foreground leading-tight truncate">{label}</p>
      </div>
    </div>
  );
}

// ---------- dialog tambah/edit ----------
function UserFormDialog({
  open,
  onOpenChange,
  target,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  target?: SafeUser | null;
  onSaved: (u: SafeUser) => void;
}) {
  const { user: me } = useAuth();
  const { toast } = useToast();
  const isEdit = !!target;
  const isSelf = isEdit && target!.id === me?.id;

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("USER");
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);

  // Isi ulang form setiap kali dialog dibuka / target berubah.
  useEffect(() => {
    if (!open) return;
    setName(target?.name ?? "");
    setUsername(target?.username ?? "");
    setPassword("");
    setRole(target?.role ?? "USER");
    setActive(target?.active ?? true);
  }, [open, target]);

  const submit = async () => {
    setBusy(true);
    try {
      if (isEdit) {
        const body: Record<string, unknown> = { name: name.trim(), role, active };
        if (password) body.password = password;
        const res = await fetch(`/api/users/${target!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = (await res.json()) as { user?: SafeUser; error?: string };
        if (!res.ok || !data.user) throw new Error(data.error ?? "Gagal menyimpan perubahan");
        onSaved(data.user);
      } else {
        const res = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), username: username.trim(), password, role }),
        });
        const data = (await res.json()) as { user?: SafeUser; error?: string };
        if (!res.ok || !data.user) throw new Error(data.error ?? "Gagal menambah pengguna");
        onSaved(data.user);
      }
      onOpenChange(false);
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Gagal menyimpan", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const canSubmit = isEdit
    ? name.trim().length > 0 && (!password || password.length >= 6)
    : name.trim().length > 0 && /^[a-z0-9_.]{3,24}$/.test(username.trim()) && password.length >= 6;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!busy) onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit akun — ${target?.name || target?.username}` : "Tambah Pengguna"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Ubah nama, peran, status aktif, atau atur ulang password akun ini."
              : "Buat akun baru lalu tetapkan perannya: Super Admin, Admin, atau Pengguna."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="u-name">Nama lengkap</Label>
            <Input id="u-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. Budi Santoso" maxLength={60} />
          </div>

          {!isEdit && (
            <div className="space-y-1.5">
              <Label htmlFor="u-username">Username</Label>
              <Input
                id="u-username"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                placeholder="mis. budi"
                autoComplete="off"
              />
              <p className="text-[11px] text-muted-foreground">3–24 karakter: huruf kecil, angka, titik, garis bawah.</p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Peran & hak akses</Label>
            <div className="grid gap-1.5" role="radiogroup" aria-label="Peran pengguna">
              {(["SUPER_ADMIN", "ADMIN", "USER"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  role="radio"
                  aria-checked={role === r}
                  disabled={isSelf}
                  onClick={() => setRole(r)}
                  className={cn(
                    "flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors",
                    role === r ? "border-primary bg-primary/5" : "border-border hover:bg-secondary/50",
                    isSelf && "opacity-60 cursor-not-allowed"
                  )}
                >
                  {r === "SUPER_ADMIN" ? (
                    <ShieldCheck className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  ) : r === "ADMIN" ? (
                    <ShieldAlert className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                  ) : (
                    <User className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  )}
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold leading-tight">{ROLE_LABEL[r]}</span>
                    <span className="block text-[11px] text-muted-foreground leading-snug">
                      {r === "SUPER_ADMIN"
                        ? "Semua akses: kelola akun, konten, marketplace, upload"
                        : r === "ADMIN"
                          ? "Kelola konten & marketplace, upload foto/video"
                          : "Upload foto/video sendiri + fitur chat & belanja"}
                    </span>
                  </span>
                </button>
              ))}
            </div>
            {isSelf && <p className="text-[11px] text-muted-foreground">Peran akun sendiri tidak dapat diubah.</p>}
          </div>

          {isEdit && (
            <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2.5">
              <div>
                <p className="text-[13px] font-semibold leading-tight">Status akun</p>
                <p className="text-[11px] text-muted-foreground">Akun nonaktif tidak bisa masuk.</p>
              </div>
              <Switch
                checked={active}
                onCheckedChange={setActive}
                disabled={busy || isSelf}
                aria-label="Status aktif akun"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="u-password">{isEdit ? "Password baru (opsional)" : "Password"}</Label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <Input
                id="u-password"
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isEdit ? "Biarkan kosong bila tidak diubah" : "Minimal 6 karakter"}
                autoComplete="new-password"
                className="pl-9"
              />
            </div>
          </div>

          {!isEdit && (
            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              <BadgeCheck className="h-3.5 w-3.5 text-primary" /> Nomor akun (ID-xxxxxx) dibuat otomatis.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Batal
          </Button>
          <Button onClick={() => void submit()} disabled={busy || !canSubmit}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} {isEdit ? "Simpan" : "Buat Akun"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
