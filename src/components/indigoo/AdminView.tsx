"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowLeft,
  BadgeCheck,
  CalendarCheck,
  CircleDashed,
  Coins,
  Database,
  Flame,
  Gift,
  LayoutDashboard,
  Loader2,
  MessageCircle,
  Network,
  Phone,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Store,
  Target,
  Timer,
  Users,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import MatrixPanel from "@/components/indigoo/MatrixPanel";
import EconomyPanel from "@/components/indigoo/EconomyPanel";
import { cn, getInitials } from "@/lib/wa-utils";
import { formatMp, roleLabelId } from "@/lib/indigoo";
import { religionLabel, RELIGIONS } from "@/lib/routines";

// ===================== TIPE =====================

interface AdminConfig {
  features: { key: string; label: string; description: string; group: string }[];
  flags: Record<string, boolean>;
  activities: { key: string; label: string; description: string; amount: number; dailyCap: number }[];
  checkin: number[];
  schedule: { key: string; title: string; time: string; religion: string | null; rewardMp: number }[];
  routines: { key: string; title: string; rewardMp: number }[];
  appointment: { amount: number; dailyCap: number };
}

interface AdminOverview {
  me: { username: string; accessId: string; role: string };
  stats: {
    users: number;
    timerAktif: number;
    totalBonusMp: number;
    totalTimerMp: number;
    totalMp: number;
    messages: number;
    chats: number;
    groups: number;
    calls: number;
    stories: number;
    products: number;
    channels: number;
    broadcasts: number;
    contacts: number;
    labels: number;
    checkInsToday: number;
    activityChecksToday: number;
    routineChecksToday: number;
    activityLogsToday: number;
  };
  recentUsers: { id: string; username: string; accessId: string; role: string; bonusMp: number; createdAt: string }[];
  config: AdminConfig;
}

interface AdminUser {
  id: string;
  accessId: string;
  username: string;
  role: string;
  religion: string;
  bonusMp: number;
  earnedMp: number;
  totalMp: number;
  totalMpLabel: string;
  timerActivated: boolean;
  timerRunning: boolean;
  timerCompleted: boolean;
  createdAt: string;
}

interface Draft {
  flags: Record<string, boolean>;
  activities: Record<string, { amount: number; dailyCap: number }>;
  checkin: number[];
  schedule: Record<string, number>;
  routines: Record<string, number>;
  appointment: { amount: number; dailyCap: number };
}

type SectionId = "ringkasan" | "pengguna" | "nilai" | "fitur" | "matrix" | "ekonomi";

const SECTIONS: { id: SectionId; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "ringkasan", label: "Ringkasan", icon: LayoutDashboard },
  { id: "pengguna", label: "Pengguna", icon: Users },
  { id: "nilai", label: "Nilai mP", icon: Coins },
  { id: "fitur", label: "Fitur", icon: SlidersHorizontal },
  { id: "matrix", label: "Matrix 3 Fase", icon: Network },
  { id: "ekonomi", label: "Ekonomi mP", icon: Wallet },
];

function draftFromConfig(c: AdminConfig): Draft {
  const activities: Draft["activities"] = {};
  for (const a of c.activities) activities[a.key] = { amount: a.amount, dailyCap: a.dailyCap };
  const schedule: Record<string, number> = {};
  for (const s of c.schedule) schedule[s.key] = s.rewardMp;
  const routines: Record<string, number> = {};
  for (const r of c.routines) routines[r.key] = r.rewardMp;
  return {
    flags: { ...c.flags },
    activities,
    checkin: [...c.checkin],
    schedule,
    routines,
    appointment: { amount: c.appointment.amount, dailyCap: c.appointment.dailyCap },
  };
}

/** Input angka kecil yang konsisten (menerima kosong = 0 saat parse). */
function NumInput({
  value,
  onChange,
  ariaLabel,
  min = 0,
  className,
}: {
  value: number;
  onChange: (n: number) => void;
  ariaLabel: string;
  min?: number;
  className?: string;
}) {
  return (
    <Input
      type="number"
      inputMode="numeric"
      min={min}
      value={Number.isFinite(value) ? value : 0}
      aria-label={ariaLabel}
      onChange={(e) => {
        const n = Number(e.target.value);
        onChange(Number.isFinite(n) ? Math.max(min, n) : 0);
      }}
      className={cn("h-8 w-20 rounded-lg px-2 text-right text-sm tabular-nums", className)}
    />
  );
}

function StatChip({ icon: Icon, label, value, tone = "emerald" }: { icon: typeof Users; label: string; value: string; tone?: string }) {
  const tones: Record<string, string> = {
    emerald: "bg-maroon-50 text-maroon-700 border-maroon-200 dark:bg-maroon-950/40 dark:text-maroon-300 dark:border-maroon-900",
    amber: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
    violet: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-900",
    rose: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900",
  };
  return (
    <div className={cn("flex items-center gap-2.5 rounded-xl border px-3 py-2.5", tones[tone] ?? tones.emerald)}>
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        <p className="truncate text-[10px] font-medium uppercase tracking-wide opacity-70">{label}</p>
        <p className="truncate text-sm font-bold tabular-nums">{value}</p>
      </div>
    </div>
  );
}

/** Halaman khusus Super Admin — kendalikan seluruh IndiGoo dari satu tempat. */
export default function AdminView({ onBack }: { onBack: () => void }) {
  const { toast } = useToast();
  const [section, setSection] = useState<SectionId>("ringkasan");
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  // Hak akses dasbor: Pengguna (kelola akun) hanya untuk SUPER_ADMIN;
  // ADMIN melihat ringkasan, nilai, fitur, matrix & ekonomi (Task 82).
  const isSuperAdmin = overview?.me.role === "SUPER_ADMIN";
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // ----- draf editor konfigurasi -----
  const [draft, setDraft] = useState<Draft | null>(null);
  const [savedDraft, setSavedDraft] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  // ----- daftar pengguna -----
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userQuery, setUserQuery] = useState("");
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [editBonus, setEditBonus] = useState("0");
  const [editRole, setEditRole] = useState("USER");
  const [editReligion, setEditReligion] = useState("");
  const [userSaving, setUserSaving] = useState(false);

  const dirty = useMemo(
    () => draft !== null && savedDraft !== "" && JSON.stringify(draft) !== savedDraft,
    [draft, savedDraft]
  );

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await fetch("/api/admin/overview", { cache: "no-store" });
      if (!res.ok) throw new Error("gagal");
      const data = (await res.json()) as AdminOverview;
      setOverview(data);
      const d = draftFromConfig(data.config);
      setDraft(d);
      setSavedDraft(JSON.stringify(d));
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadUsers = useCallback(async (q = "") => {
    setUsersLoading(true);
    try {
      const res = await fetch(`/api/admin/users?q=${encodeURIComponent(q)}`, { cache: "no-store" });
      if (!res.ok) throw new Error("gagal");
      const data = (await res.json()) as { users?: AdminUser[] };
      setUsers(data.users ?? []);
    } catch {
      toast({ title: "Gagal memuat daftar pengguna", variant: "destructive" });
    } finally {
      setUsersLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    if (section === "pengguna" && users.length === 0 && !usersLoading) void loadUsers();
  }, [section, users.length, usersLoading, loadUsers]);

  const saveConfig = useCallback(async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          features: draft.flags,
          rewards: {
            activities: draft.activities,
            checkin: draft.checkin,
            schedule: draft.schedule,
            routines: draft.routines,
            appointment: draft.appointment,
          },
        }),
      });
      if (!res.ok) throw new Error("gagal");
      const data = (await res.json()) as { config?: AdminConfig };
      const d = data.config ? draftFromConfig(data.config) : draft;
      setDraft(d);
      setSavedDraft(JSON.stringify(d));
      if (data.config) setOverview((prev) => (prev ? { ...prev, config: data.config! } : prev));
      // Terapkan flag baru ke seluruh aplikasi secara instan (segarkan sesi).
      window.dispatchEvent(new CustomEvent("indigoo:mp-changed"));
      toast({ title: "Konfigurasi tersimpan", description: "Semua perubahan langsung berlaku untuk seluruh pengguna." });
    } catch {
      toast({ title: "Gagal menyimpan konfigurasi", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }, [draft, toast]);

  const resetConfig = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/config", { method: "DELETE" });
      if (!res.ok) throw new Error("gagal");
      const data = (await res.json()) as { config?: AdminConfig };
      const d = data.config ? draftFromConfig(data.config) : draft;
      if (d) {
        setDraft(d);
        setSavedDraft(JSON.stringify(d));
      }
      if (data.config) setOverview((prev) => (prev ? { ...prev, config: data.config! } : prev));
      window.dispatchEvent(new CustomEvent("indigoo:mp-changed"));
      toast({ title: "Konfigurasi kembali ke default", description: "Semua fitur aktif & nilai mP bawaan dipulihkan." });
    } catch {
      toast({ title: "Gagal mengembalikan default", variant: "destructive" });
    } finally {
      setConfirmReset(false);
      setSaving(false);
    }
  }, [draft, toast]);

  const openEditUser = (u: AdminUser) => {
    setEditUser(u);
    setEditBonus(String(u.bonusMp));
    setEditRole(u.role);
    setEditReligion(u.religion);
  };

  const saveUser = useCallback(async () => {
    if (!editUser) return;
    setUserSaving(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editUser.id, bonusMp: Number(editBonus) || 0, role: editRole, religion: editReligion }),
      });
      const data = (await res.json()) as { user?: AdminUser; error?: string };
      if (!res.ok || !data.user) throw new Error(data.error ?? "gagal");
      setUsers((cur) => cur.map((u) => (u.id === data.user!.id ? data.user! : u)));
      setOverview((prev) =>
        prev
          ? {
              ...prev,
              recentUsers: prev.recentUsers.map((u) =>
                u.id === data.user!.id ? { ...u, bonusMp: data.user!.bonusMp, role: data.user!.role } : u
              ),
            }
          : prev
      );
      setEditUser(null);
      toast({ title: "Pengguna diperbarui", description: `${data.user.username} — saldo & peran tersimpan.` });
    } catch (e) {
      toast({ title: "Gagal memperbarui pengguna", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    } finally {
      setUserSaving(false);
    }
  }, [editUser, editBonus, editRole, editReligion, toast]);

  const timerAction = useCallback(
    async (u: AdminUser, action: "activate" | "pause" | "reset") => {
      setUserSaving(true);
      try {
        const res = await fetch("/api/admin/users", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: u.id, timerAction: action }),
        });
        const data = (await res.json()) as { user?: AdminUser; error?: string };
        if (!res.ok || !data.user) throw new Error(data.error ?? "gagal");
        setUsers((cur) => cur.map((x) => (x.id === data.user!.id ? data.user! : x)));
        if (editUser?.id === u.id) setEditUser(data.user);
        toast({ title: "Timer diperbarui", description: `${data.user.username} — aksi ${action} berhasil.` });
      } catch (e) {
        toast({ title: "Gagal mengubah timer", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
      } finally {
        setUserSaving(false);
      }
    },
    [editUser, toast]
  );

  const setFlag = (key: string, v: boolean) => setDraft((d) => (d ? { ...d, flags: { ...d.flags, [key]: v } } : d));
  const setActivity = (key: string, field: "amount" | "dailyCap", v: number) =>
    setDraft((d) =>
      d ? { ...d, activities: { ...d.activities, [key]: { ...d.activities[key], [field]: v } } } : d
    );
  const setCheckin = (i: number, v: number) =>
    setDraft((d) => (d ? { ...d, checkin: d.checkin.map((x, ix) => (ix === i ? v : x)) } : d));
  const setSchedule = (key: string, v: number) => setDraft((d) => (d ? { ...d, schedule: { ...d.schedule, [key]: v } } : d));
  const setRoutine = (key: string, v: number) => setDraft((d) => (d ? { ...d, routines: { ...d.routines, [key]: v } } : d));
  const setAppointment = (field: "amount" | "dailyCap", v: number) =>
    setDraft((d) => (d ? { ...d, appointment: { ...d.appointment, [field]: v } } : d));

  const featureGroups = useMemo(() => {
    if (!overview) return [];
    const groups = new Map<string, typeof overview.config.features>();
    for (const f of overview.config.features) {
      const list = groups.get(f.group) ?? [];
      list.push(f);
      groups.set(f.group, list);
    }
    return [...groups.entries()];
  }, [overview]);

  const scheduleGroups = useMemo(() => {
    if (!draft || !overview) return [];
    const umum = overview.config.schedule.filter((s) => !s.religion);
    const groups: { label: string; rows: typeof umum }[] = [{ label: "Kegiatan Umum", rows: umum }];
    for (const r of RELIGIONS) {
      const rows = overview.config.schedule.filter((s) => s.religion === r.key);
      if (rows.length > 0) groups.push({ label: `Ibadah ${r.label}`, rows });
    }
    return groups;
  }, [draft, overview]);

  const filteredUsers = useMemo(() => {
    const q = userQuery.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => [u.username, u.accessId, u.role, u.religion].some((v) => v?.toLowerCase().includes(q)));
  }, [users, userQuery]);

  // ---------- render ----------

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <header className="flex shrink-0 items-center gap-3 border-b border-border bg-card px-3 py-2.5">
        <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={onBack} aria-label="Kembali ke tab sebelumnya">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <ShieldCheck className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 truncate text-base font-bold leading-tight tracking-tight">
            Panel Super Admin
            <Badge className="bg-maroon-100 text-maroon-700 hover:bg-maroon-100 dark:bg-maroon-950 dark:text-maroon-300">
              <BadgeCheck className="mr-1 h-3 w-3" aria-hidden="true" /> {roleLabelId("SUPER_ADMIN")}
            </Badge>
          </h1>
          <p className="truncate text-[11px] text-muted-foreground">
            Kendalikan seluruh fitur &amp; nilai mP IndiGoo dari satu halaman
          </p>
        </div>
      </header>

      {/* Navigasi bagian */}
      <div className="shrink-0 border-b border-border bg-card px-3 pb-2">
        <div role="tablist" aria-label="Bagian panel admin" className="flex gap-1 overflow-x-auto">
          {SECTIONS.filter((s) => isSuperAdmin || s.id !== "pengguna").map((s) => {
            const Icon = s.icon;
            const active = section === s.id;
            return (
              <button
                key={s.id}
                role="tab"
                type="button"
                aria-selected={active}
                onClick={() => setSection(s.id)}
                className={cn(
                  "flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
                  active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Konten */}
      <div className="wa-scrollbar min-h-0 flex-1 overflow-y-auto p-3">
        <div className="mx-auto w-full max-w-3xl space-y-4 pb-24">
          {loading ? (
            <>
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-40 w-full rounded-xl" />
              <Skeleton className="h-40 w-full rounded-xl" />
            </>
          ) : loadError || !overview || !draft ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
                <ShieldCheck className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
                <p className="font-semibold">Gagal memuat panel</p>
                <p className="text-sm text-muted-foreground">Periksa koneksi lalu coba lagi.</p>
                <Button onClick={() => void loadOverview()}>Coba lagi</Button>
              </CardContent>
            </Card>
          ) : section === "ringkasan" ? (
            <>
              {/* Kartu mP beredar */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-950/60">
                      <Coins className="h-5 w-5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">Ekonomi mP</p>
                      <p className="mt-0.5 text-2xl font-bold tabular-nums tracking-tight">
                        {formatMp(overview.stats.totalMp)} <span className="text-sm font-semibold text-muted-foreground">mP beredar</span>
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Bonus {formatMp(overview.stats.totalBonusMp)} mP · Timer {formatMp(overview.stats.totalTimerMp)} mP ·{" "}
                        {overview.stats.timerAktif} timer berjalan
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Statistik utama */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <StatChip icon={Users} label="Pengguna" value={String(overview.stats.users)} tone="emerald" />
                <StatChip icon={MessageCircle} label="Pesan" value={String(overview.stats.messages)} tone="emerald" />
                <StatChip icon={Phone} label="Panggilan" value={String(overview.stats.calls)} tone="violet" />
                <StatChip icon={CircleDashed} label="Status" value={String(overview.stats.stories)} tone="amber" />
                <StatChip icon={MessageCircle} label="Chat Pribadi" value={String(overview.stats.chats)} tone="emerald" />
                <StatChip icon={Users} label="Grup" value={String(overview.stats.groups)} tone="emerald" />
                <StatChip icon={Store} label="Produk" value={String(overview.stats.products)} tone="rose" />
                <StatChip icon={Activity} label="Channel" value={String(overview.stats.channels)} tone="violet" />
                <StatChip icon={Flame} label="Check-In Hari Ini" value={String(overview.stats.checkInsToday)} tone="amber" />
                <StatChip icon={CalendarCheck} label="Kegiatan Hari Ini" value={String(overview.stats.activityChecksToday)} tone="emerald" />
                <StatChip icon={Database} label="Kontak" value={String(overview.stats.contacts)} tone="violet" />
                <StatChip icon={Timer} label="Siaran" value={String(overview.stats.broadcasts)} tone="rose" />
              </div>

              {/* Pengguna terbaru */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">Pengguna Terbaru</p>
                    <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => setSection("pengguna")}>
                      <Users className="h-3.5 w-3.5" aria-hidden="true" /> Kelola
                    </Button>
                  </div>
                  <ul className="mt-3 divide-y divide-border">
                    {overview.recentUsers.map((u) => (
                      <li key={u.id} className="flex items-center gap-3 py-2">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                          {getInitials(u.username)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {u.username}
                            {u.role !== "USER" && (
                              <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                                {roleLabelId(u.role)}
                              </span>
                            )}
                          </p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {u.accessId} · {new Date(u.createdAt).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta" })}
                          </p>
                        </div>
                        <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">{formatMp(u.bonusMp)} mP</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              {/* Status konfigurasi */}
              <Card>
                <CardContent className="flex flex-wrap items-center gap-2 p-4">
                  <p className="mr-auto text-sm font-semibold">Status Konfigurasi</p>
                  <Badge variant="secondary">{overview.config.features.filter((f) => draft.flags[f.key] !== false).length}/{overview.config.features.length} fitur aktif</Badge>
                  <Badge variant="secondary">{overview.config.activities.length} aktivitas berhadiah</Badge>
                  <Badge variant="secondary">{overview.config.schedule.length} kegiatan harian</Badge>
                  <Badge variant="secondary">
                    Appointment {formatMp(overview.config.appointment.amount)} mP × {overview.config.appointment.dailyCap}/hari
                  </Badge>
                </CardContent>
              </Card>
            </>
          ) : section === "pengguna" ? (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                    <Input
                      value={userQuery}
                      onChange={(e) => setUserQuery(e.target.value)}
                      placeholder="Cari username, ID Akses, peran, agama…"
                      aria-label="Cari pengguna"
                      className="h-9 pl-8"
                    />
                  </div>
                  <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => void loadUsers(userQuery)} aria-label="Muat ulang daftar pengguna">
                    <RotateCcw className={cn("h-4 w-4", usersLoading && "animate-spin")} />
                  </Button>
                </div>
                <p className="mt-2 px-1 text-[11px] text-muted-foreground">
                  {usersLoading ? "Memuat…" : `${filteredUsers.length} dari ${overview.stats.users} pengguna`}
                </p>

                <div className="mt-2 max-h-[60vh] space-y-2 overflow-y-auto wa-scrollbar pr-0.5">
                  {usersLoading && users.length === 0
                    ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)
                    : filteredUsers.map((u) => (
                        <div key={u.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-2.5">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                            {getInitials(u.username)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                              {u.username}
                              {u.role !== "USER" && (
                                <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                                  {roleLabelId(u.role)}
                                </span>
                              )}
                            </p>
                            <p className="truncate text-[11px] text-muted-foreground">
                              {u.accessId} · {formatMp(u.totalMp)} mP ·{" "}
                              {u.timerCompleted ? "timer selesai" : u.timerRunning ? "timer jalan" : u.timerActivated ? "timer jeda" : "timer nonaktif"}
                            </p>
                          </div>
                          <Button size="sm" variant="outline" className="h-8 shrink-0" onClick={() => openEditUser(u)}>
                            Kelola
                          </Button>
                        </div>
                      ))}
                  {!usersLoading && filteredUsers.length === 0 && (
                    <p className="py-8 text-center text-sm text-muted-foreground">Tidak ada pengguna yang cocok.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : section === "nilai" ? (
            <>
              {/* Aktivitas otomatis */}
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm font-semibold">Aktivitas Otomatis</p>
                  <p className="text-xs text-muted-foreground">Hadiah mP per kejadian &amp; batas harian (cap) tiap aktivitas.</p>
                  <div className="mt-3 space-y-1.5">
                    {overview.config.activities.map((a) => (
                      <div key={a.key} className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold">{a.label}</p>
                          <p className="truncate text-[10px] text-muted-foreground">{a.description}</p>
                        </div>
                        <NumInput value={draft.activities[a.key]?.amount ?? a.amount} onChange={(n) => setActivity(a.key, "amount", n)} ariaLabel={`Hadiah ${a.label}`} />
                        <NumInput value={draft.activities[a.key]?.dailyCap ?? a.dailyCap} onChange={(n) => setActivity(a.key, "dailyCap", n)} ariaLabel={`Batas harian ${a.label}`} min={1} className="w-16" />
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 px-1 text-[10px] text-muted-foreground">Kolom kiri = mP/kejadian, kanan = cap harian.</p>
                </CardContent>
              </Card>

              {/* Check-In 30 hari */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">Check-In 30 Hari</p>
                    <Badge variant="secondary" className="gap-1">
                      <Gift className="h-3 w-3" aria-hidden="true" /> Total siklus {formatMp(draft.checkin.reduce((a, b) => a + b, 0))} mP
                    </Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-5 gap-1.5 sm:grid-cols-10">
                    {draft.checkin.map((v, i) => (
                      <label key={i} className="flex flex-col items-center gap-0.5">
                        <span className="text-[9px] font-semibold text-muted-foreground">H{i + 1}</span>
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          value={v}
                          aria-label={`Hadiah hari ke-${i + 1}`}
                          onChange={(e) => {
                            const n = Number(e.target.value);
                            setCheckin(i, Number.isFinite(n) ? Math.max(0, n) : 0);
                          }}
                          className="h-8 w-full px-1 text-center text-xs tabular-nums"
                        />
                      </label>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Jadwal kegiatan & ibadah */}
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm font-semibold">Jadwal Kegiatan &amp; Ibadah Harian</p>
                  <p className="text-xs text-muted-foreground">Hadiah mP tiap kegiatan (03.30–22.00 WIB + 6 agama).</p>
                  <div className="mt-3 space-y-4">
                    {scheduleGroups.map((g) => (
                      <div key={g.label}>
                        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{g.label}</p>
                        <div className="space-y-1.5">
                          {g.rows.map((s) => (
                            <div key={s.key} className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-2">
                              <span className="w-10 shrink-0 text-right text-[10px] font-bold tabular-nums text-muted-foreground">{s.time}</span>
                              <p className="min-w-0 flex-1 truncate text-xs font-medium">{s.title}</p>
                              <NumInput value={draft.schedule[s.key] ?? s.rewardMp} onChange={(n) => setSchedule(s.key, n)} ariaLabel={`Hadiah ${s.title}`} />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Rutinitas harian */}
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm font-semibold">4 Rutinitas Harian</p>
                  <div className="mt-3 space-y-1.5">
                    {overview.config.routines.map((r) => (
                      <div key={r.key} className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-2">
                        <p className="min-w-0 flex-1 truncate text-xs font-medium">{r.title}</p>
                        <NumInput value={draft.routines[r.key] ?? r.rewardMp} onChange={(n) => setRoutine(r.key, n)} ariaLabel={`Hadiah ${r.title}`} />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Appointment (pengganti Misi) */}
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm font-semibold">Appointment</p>
                  <p className="text-xs text-muted-foreground">
                    Hadiah mP untuk setiap appointment yang dibuat pengguna, dan batas pembuatan per hari WIB.
                  </p>
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium">Hadiah per appointment</p>
                        <p className="text-[9px] uppercase tracking-wide text-muted-foreground">mP / appointment</p>
                      </div>
                      <NumInput value={draft.appointment.amount} onChange={(n) => setAppointment("amount", n)} ariaLabel="Hadiah per appointment" />
                    </div>
                    <div className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium">Batas harian</p>
                        <p className="text-[9px] uppercase tracking-wide text-muted-foreground">maks appointment / hari</p>
                      </div>
                      <NumInput value={draft.appointment.dailyCap} onChange={(n) => setAppointment("dailyCap", n)} ariaLabel="Batas appointment per hari" min={1} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : section === "matrix" ? (
            /* ---------- MATRIX 3 FASE (khusus SUPER_ADMIN & ADMIN) ---------- */
            <MatrixPanel />
          ) : section === "ekonomi" ? (
            /* ---------- KETENTUAN EKONOMI (Top Up / Kirim / Tukar) ---------- */
            <EconomyPanel />
          ) : (
            /* ---------- FITUR ---------- */
            <>
              {featureGroups.map(([group, flags]) => (
                <Card key={group}>
                  <CardContent className="p-4">
                    <p className="text-sm font-semibold">{group}</p>
                    <div className="mt-3 space-y-2">
                      {flags.map((f) => (
                        <div key={f.key} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5">
                          <div className="min-w-0 flex-1">
                            <Label htmlFor={`flag-${f.key}`} className="text-xs font-semibold">
                              {f.label}
                            </Label>
                            <p className="text-[10px] leading-snug text-muted-foreground">{f.description}</p>
                          </div>
                          <Switch id={`flag-${f.key}`} checked={draft.flags[f.key] !== false} onCheckedChange={(v) => setFlag(f.key, v)} />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
              <p className="px-1 text-[11px] text-muted-foreground">
                Fitur yang dimatikan langsung hilang dari tampilan pengguna dan ditolak di sisi server.
              </p>
            </>
          )}
        </div>
      </div>

      {/* Bar simpan (muncul saat ada perubahan) */}
      {dirty && (
        <div className="shrink-0 border-t border-border bg-card/95 px-3 py-2.5 backdrop-blur">
          <div className="mx-auto flex w-full max-w-3xl items-center gap-2">
            <p className="mr-auto text-xs font-medium text-amber-600 dark:text-amber-400">
              Ada perubahan belum disimpan
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 gap-1.5"
              disabled={saving}
              onClick={() => {
                if (overview) {
                  const d = draftFromConfig(overview.config);
                  setDraft(d);
                  setSavedDraft(JSON.stringify(d));
                }
              }}
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Buang
            </Button>
            <Button size="sm" className="h-9 gap-1.5" disabled={saving} onClick={() => void saveConfig()}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Save className="h-3.5 w-3.5" aria-hidden="true" />}
              Simpan Perubahan
            </Button>
          </div>
        </div>
      )}

      {/* Bar aksi konfigurasi (reset default) — hanya di tab Fitur/Nilai */}
      {!dirty && (section === "nilai" || section === "fitur") && (
        <div className="shrink-0 border-t border-border bg-card/95 px-3 py-2.5">
          <div className="mx-auto flex w-full max-w-3xl items-center gap-2">
            <p className="mr-auto text-[11px] text-muted-foreground">Semua perubahan langsung berlaku untuk seluruh pengguna.</p>
            <Button variant="outline" size="sm" className="h-9 gap-1.5 text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950" onClick={() => setConfirmReset(true)}>
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Kembalikan Default
            </Button>
          </div>
        </div>
      )}

      {/* Dialog edit pengguna */}
      <Dialog open={editUser !== null} onOpenChange={(o) => !o && setEditUser(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Kelola Pengguna</DialogTitle>
            <DialogDescription>
              {editUser?.username} · {editUser?.accessId} · {editUser?.totalMpLabel} mP
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="adm-bonus">Saldo Bonus mP</Label>
              <Input
                id="adm-bonus"
                type="number"
                inputMode="numeric"
                min={0}
                value={editBonus}
                onChange={(e) => setEditBonus(e.target.value)}
              />
              <p className="text-[10px] text-muted-foreground">
                Timer pengguna: {editUser ? formatMp(editUser.earnedMp) : "0"} mP (tidak berubah di sini).
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>Peran</Label>
                <Select value={editRole} onValueChange={setEditRole}>
                  <SelectTrigger aria-label="Peran pengguna"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USER">Pengguna</SelectItem>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                    <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Agama</Label>
                <Select value={editReligion || "none"} onValueChange={(v) => setEditReligion(v === "none" ? "" : v)}>
                  <SelectTrigger aria-label="Agama pengguna"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Tidak ditampilkan</SelectItem>
                    {RELIGIONS.map((r) => (
                      <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {editUser && (
              <div className="flex flex-wrap gap-1.5">
                {!editUser.timerActivated && (
                  <Button variant="outline" size="sm" className="h-8 gap-1.5" disabled={userSaving} onClick={() => void timerAction(editUser, "activate")}>
                    <Timer className="h-3.5 w-3.5" aria-hidden="true" /> Aktifkan Timer
                  </Button>
                )}
                {editUser.timerRunning && (
                  <Button variant="outline" size="sm" className="h-8 gap-1.5" disabled={userSaving} onClick={() => void timerAction(editUser, "pause")}>
                    <Timer className="h-3.5 w-3.5" aria-hidden="true" /> Jeda Timer
                  </Button>
                )}
                {editUser.timerActivated && !editUser.timerRunning && !editUser.timerCompleted && (
                  <Button variant="outline" size="sm" className="h-8 gap-1.5" disabled={userSaving} onClick={() => void timerAction(editUser, "activate")}>
                    <Timer className="h-3.5 w-3.5" aria-hidden="true" /> Lanjutkan Timer
                  </Button>
                )}
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950" disabled={userSaving} onClick={() => void timerAction(editUser, "reset")}>
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Reset Timer
                </Button>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setEditUser(null)}>Batal</Button>
            <Button onClick={() => void saveUser()} disabled={userSaving}>
              {userSaving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog konfirmasi reset konfigurasi */}
      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kembalikan semua ke default?</AlertDialogTitle>
            <AlertDialogDescription>
              Semua fitur akan diaktifkan kembali dan seluruh nilai mP (aktivitas, check-in, jadwal, rutinitas, appointment)
              kembali ke nilai bawaan aplikasi. Tindakan ini berlaku untuk semua pengguna.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600"
              disabled={saving}
              onClick={(e) => {
                e.preventDefault();
                void resetConfig();
              }}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              Ya, kembalikan default
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
