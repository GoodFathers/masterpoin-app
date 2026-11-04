"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Coins,
  Crown,
  Edit3,
  Gift,
  ImageIcon,
  Network,
  PlusCircle,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
  Sunrise,
  ToggleLeft,
  ToggleRight,
  TrendingUp,
  UserCheck,
  UserCog,
  Users,
  XCircle,
} from "lucide-react";
import { MatrixDashboard } from "./matrix-dashboard";
import { ResetPanel } from "./reset-panel";
import { EmptyState, Modal, Spinner, StatusBadge, Toast } from "@/components/ui";
import { formatDateTimeWib, formatNumber, formatRupiah } from "@/lib/time";
import { ROLE_BADGE_STYLE, ROLE_LABELS, canManagePoints, isSuperAdmin } from "@/lib/roles";
import { cn, initials } from "@/lib/utils";

type AdminRequest = {
  id: number;
  amount: number;
  uniqueCode: string;
  status: string;
  proofUrl: string | null;
  proofName: string | null;
  senderName: string | null;
  note: string | null;
  adminNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  user: { name: string; email: string; religion: string; city: string | null };
};

type ManagedUser = {
  id: number;
  name: string;
  email: string;
  role: string;
  religion: string;
  phone: string | null;
  city: string | null;
  avatarUrl: string | null;
  canEditPoints: boolean;
  ledgerBalance?: number;
  accessStatus: string;
  timerStartedAt: string | null;
  createdAt: string;
};

type RewardItem = {
  id: number;
  name: string;
  description: string | null;
  category: string;
  pointsCost: number;
  stock: number;
  isActive: boolean;
};

type RoutineItem = {
  id: number;
  title: string;
  description: string | null;
  points: number;
  category: string;
  startTime: string;
  endTime: string;
};

type SystemConfig = {
  pointsPerSecond: number;
  checkinBasePoints: number;
  checkinStreakBonus: number;
};

export function AdminConsole({
  initialRequests,
  initialStats,
  currentUser,
  initialUsers = [],
  initialRewards = [],
  initialRoutines = [],
  initialSystemConfig = {
    pointsPerSecond: 3.17097916667,
    checkinBasePoints: 250,
    checkinStreakBonus: 50,
  },
}: {
  initialRequests: AdminRequest[];
  initialStats: { pending: number; active: number; totalUsers: number };
  currentUser: {
    id: number;
    name: string;
    role: string;
    canEditPoints: boolean;
  };
  initialUsers?: ManagedUser[];
  initialRewards?: RewardItem[];
  initialRoutines?: RoutineItem[];
  initialSystemConfig?: SystemConfig;
}) {
  const isSuper = isSuperAdmin(currentUser.role);
  const canEdit = canManagePoints(currentUser);

  // Default tab based on permissions
  const [activeTab, setActiveTab] = useState<"requests" | "users" | "points" | "matrix" | "reset">(
    isSuper ? "matrix" : canEdit ? "points" : "requests",
  );

  const [requests, setRequests] = useState(initialRequests);
  const [usersList, setUsersList] = useState<ManagedUser[]>(initialUsers);
  const [rewardsList, setRewardsList] = useState<RewardItem[]>(initialRewards);
  const [routinesList, setRoutinesList] = useState<RoutineItem[]>(initialRoutines);
  const [systemConfig, setSystemConfig] = useState<SystemConfig>(initialSystemConfig);
  const [stats] = useState(initialStats);
  const [filter, setFilter] = useState("pending");

  // Requests state
  const [busyId, setBusyId] = useState<number | null>(null);
  const [preview, setPreview] = useState<AdminRequest | null>(null);
  const [decision, setDecision] = useState<{ request: AdminRequest; action: "approve" | "reject" } | null>(null);
  const [adminNote, setAdminNote] = useState("");

  // Role & Designation Modal (Super Admin only)
  const [roleModalUser, setRoleModalUser] = useState<ManagedUser | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>("user");
  const [selectedCanEditPoints, setSelectedCanEditPoints] = useState<boolean>(false);
  const [savingRole, setSavingRole] = useState(false);

  // Points Editing State
  const [pointTab, setPointTab] = useState<"user_balance" | "rewards" | "routines" | "system">("user_balance");
  const [pointAdjustUser, setPointAdjustUser] = useState<ManagedUser | null>(null);
  const [pointDelta, setPointDelta] = useState<string>("500");
  const [pointReason, setPointReason] = useState<string>("Koreksi poin oleh administrator");
  const [savingPoints, setSavingPoints] = useState(false);

  // Edit Reward Modal
  const [editRewardTarget, setEditRewardTarget] = useState<RewardItem | null>(null);
  const [editRewardPoints, setEditRewardPoints] = useState<string>("");
  const [editRewardStock, setEditRewardStock] = useState<string>("");
  const [editRewardName, setEditRewardName] = useState<string>("");

  // Edit Routine Modal
  const [editRoutineTarget, setEditRoutineTarget] = useState<RoutineItem | null>(null);
  const [editRoutinePoints, setEditRoutinePoints] = useState<string>("");

  // Edit System Settings State
  const [editPps, setEditPps] = useState<string>(String(systemConfig.pointsPerSecond));
  const [editCheckinBase, setEditCheckinBase] = useState<string>(String(systemConfig.checkinBasePoints));
  const [editCheckinBonus, setEditCheckinBonus] = useState<string>(String(systemConfig.checkinStreakBonus));
  const [savingSystem, setSavingSystem] = useState(false);

  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);

  const filteredRequests = useMemo(
    () => (filter === "semua" ? requests : requests.filter((item) => item.status === filter)),
    [requests, filter],
  );

  // Submit Approval/Rejection for QRIS
  const submitDecision = async () => {
    if (!decision) return;
    const { request, action } = decision;
    setBusyId(request.id);
    setDecision(null);
    const previous = requests;
    setRequests((prev) =>
      prev.map((item) =>
        item.id === request.id
          ? {
              ...item,
              status: action === "approve" ? "approved" : "rejected",
              reviewedAt: new Date().toISOString(),
              adminNote: adminNote || (action === "approve" ? "Pembayaran terverifikasi." : "Bukti tidak valid."),
            }
          : item,
      ),
    );
    try {
      const response = await fetch(`/api/access-requests/${request.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, adminNote }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Gagal memproses");
      setToast({
        message:
          action === "approve"
            ? `Akses ${request.user.name} aktif • timer 365 hari dimulai`
            : `Permohonan ${request.user.name} ditolak`,
        tone: "success",
      });
      setAdminNote("");
    } catch (error) {
      setRequests(previous);
      setToast({ message: error instanceof Error ? error.message : "Gagal memproses", tone: "error" });
    } finally {
      setBusyId(null);
    }
  };

  // Open Role & Point Designation Modal
  const handleOpenRoleModal = (targetUser: ManagedUser) => {
    setRoleModalUser(targetUser);
    setSelectedRole(targetUser.role || "user");
    setSelectedCanEditPoints(targetUser.role === "super_admin" || Boolean(targetUser.canEditPoints));
  };

  // Save Role and Point Editing Designation
  const handleSaveRole = async () => {
    if (!roleModalUser) return;
    setSavingRole(true);
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: roleModalUser.id,
          role: selectedRole,
          canEditPoints: selectedRole === "super_admin" ? true : selectedCanEditPoints,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Gagal memperbarui hak akses");

      setUsersList((prev) =>
        prev.map((u) =>
          u.id === roleModalUser.id
            ? {
                ...u,
                role: selectedRole,
                canEditPoints: selectedRole === "super_admin" ? true : selectedCanEditPoints,
              }
            : u,
        ),
      );
      setToast({
        message: `Hak akses ${roleModalUser.name} berhasil diperbarui (Peran: ${ROLE_LABELS[selectedRole]}, Izin Edit Poin: ${selectedRole === "super_admin" || selectedCanEditPoints ? "Aktif" : "Nonaktif"}).`,
        tone: "success",
      });
      setRoleModalUser(null);
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : "Gagal menyimpan peran", tone: "error" });
    } finally {
      setSavingRole(false);
    }
  };

  // Direct Toggle Designation for Point Editing
  const handleTogglePointPermission = async (targetUser: ManagedUser) => {
    if (!isSuper) return;
    if (targetUser.role === "super_admin") {
      setToast({ message: "Super Admin selalu memiliki izin edit poin.", tone: "error" });
      return;
    }
    const nextVal = !targetUser.canEditPoints;
    setUsersList((prev) =>
      prev.map((u) => (u.id === targetUser.id ? { ...u, canEditPoints: nextVal } : u)),
    );
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: targetUser.id,
          canEditPoints: nextVal,
        }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Gagal mengubah izin edit poin");
      }
      setToast({
        message: nextVal
          ? `Akun ${targetUser.name} sekarang DITUNJUK oleh Super Admin untuk mengedit nilai poin.`
          : `Izin edit poin untuk akun ${targetUser.name} telah dicabut.`,
        tone: "success",
      });
    } catch (error) {
      setUsersList((prev) =>
        prev.map((u) => (u.id === targetUser.id ? { ...u, canEditPoints: !nextVal } : u)),
      );
      setToast({ message: error instanceof Error ? error.message : "Gagal memperbarui izin", tone: "error" });
    }
  };

  // Adjust User Points Balance
  const handleAdjustPointsSubmit = async () => {
    if (!pointAdjustUser) return;
    const delta = Number(pointDelta);
    if (!Number.isFinite(delta) || delta === 0) {
      setToast({ message: "Masukkan jumlah poin penyesuaian yang valid (bukan 0).", tone: "error" });
      return;
    }
    setSavingPoints(true);
    try {
      const response = await fetch("/api/admin/points", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "adjust_user_points",
          userId: pointAdjustUser.id,
          pointsDelta: delta,
          reason: pointReason,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Gagal menyesuaikan saldo poin");

      setUsersList((prev) =>
        prev.map((u) =>
          u.id === pointAdjustUser.id
            ? { ...u, ledgerBalance: (u.ledgerBalance ?? 0) + delta }
            : u,
        ),
      );
      setToast({ message: data.message ?? "Saldo poin berhasil disesuaikan.", tone: "success" });
      setPointAdjustUser(null);
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : "Gagal memperbarui saldo", tone: "error" });
    } finally {
      setSavingPoints(false);
    }
  };

  // Save Reward Points Cost
  const handleSaveReward = async () => {
    if (!editRewardTarget) return;
    const cost = Number(editRewardPoints);
    const stock = Number(editRewardStock);
    if (!Number.isFinite(cost) || cost < 0) {
      setToast({ message: "Nilai poin hadiah harus bernilai 0 atau lebih.", tone: "error" });
      return;
    }
    setSavingPoints(true);
    try {
      const response = await fetch("/api/admin/points", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_reward_points",
          rewardId: editRewardTarget.id,
          pointsCost: cost,
          stock: Number.isFinite(stock) ? stock : editRewardTarget.stock,
          name: editRewardName.trim() || editRewardTarget.name,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Gagal menyimpan poin hadiah");

      setRewardsList((prev) =>
        prev.map((r) =>
          r.id === editRewardTarget.id
            ? { ...r, pointsCost: cost, stock: Number.isFinite(stock) ? stock : r.stock, name: editRewardName.trim() || r.name }
            : r,
        ),
      );
      setToast({ message: data.message ?? "Poin hadiah berhasil diperbarui.", tone: "success" });
      setEditRewardTarget(null);
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : "Gagal menyimpan", tone: "error" });
    } finally {
      setSavingPoints(false);
    }
  };

  // Save Routine Points
  const handleSaveRoutine = async () => {
    if (!editRoutineTarget) return;
    const pts = Number(editRoutinePoints);
    if (!Number.isFinite(pts) || pts < 5) {
      setToast({ message: "Nilai poin rutinitas minimal 5 poin.", tone: "error" });
      return;
    }
    setSavingPoints(true);
    try {
      const response = await fetch("/api/admin/points", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_routine_points",
          routineId: editRoutineTarget.id,
          points: pts,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Gagal menyimpan poin rutinitas");

      setRoutinesList((prev) =>
        prev.map((r) => (r.id === editRoutineTarget.id ? { ...r, points: pts } : r)),
      );
      setToast({ message: data.message ?? "Nilai poin rutinitas diperbarui.", tone: "success" });
      setEditRoutineTarget(null);
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : "Gagal menyimpan", tone: "error" });
    } finally {
      setSavingPoints(false);
    }
  };

  // Save System Points Settings
  const handleSaveSystemConfig = async () => {
    const pps = Number(editPps);
    const base = Number(editCheckinBase);
    const bonus = Number(editCheckinBonus);

    if (!Number.isFinite(pps) || pps <= 0) {
      setToast({ message: "Poin per detik harus bernilai angka positif.", tone: "error" });
      return;
    }

    setSavingSystem(true);
    try {
      const response = await fetch("/api/admin/points", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_system_points",
          pointsPerSecond: pps,
          checkinBasePoints: base,
          checkinStreakBonus: bonus,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Gagal menyimpan konfigurasi poin");

      setSystemConfig({
        pointsPerSecond: pps,
        checkinBasePoints: base,
        checkinStreakBonus: bonus,
      });
      setToast({ message: data.message ?? "Konfigurasi poin sistem berhasil disimpan.", tone: "success" });
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : "Gagal menyimpan", tone: "error" });
    } finally {
      setSavingSystem(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header & Main Tabs */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="chip">
              {isSuper ? (
                <Crown className="h-3.5 w-3.5 text-purple-600" />
              ) : (
                <ShieldCheck className="h-3.5 w-3.5 text-master-600" />
              )}
              {isSuper
                ? "Super Admin Master"
                : canEdit
                  ? "Admin Ditunjuk (Izin Edit Poin)"
                  : "Admin Verifikasi"}
            </span>
            {canEdit && (
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                ✓ Hak Edit Semua Nilai Poin
              </span>
            )}
          </div>
          <h1 className="mt-1.5 text-[26px] font-extrabold tracking-tight text-master-950">
            {isSuper
              ? "Panel Super Admin • masterpoin.online"
              : canEdit
                ? "Panel Admin & Edit Nilai Poin • masterpoin.online"
                : "Panel Admin • masterpoin.online"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {isSuper
              ? "Kelola verifikasi QRIS, hybrid matrix 3 phase, rincian bonus per level, penunjukan akun, dan kontrol nilai poin."
              : canEdit
                ? "Anda telah ditunjuk oleh Super Admin untuk mengelola verifikasi, hybrid matrix, dan mengedit nilai poin."
                : "Periksa bukti pembayaran QRIS dan kode unik untuk mengaktifkan timer pengguna."}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex flex-wrap rounded-xl border border-rose-200 bg-white p-1 shadow-sm">
          {(isSuper || currentUser.role === "admin") && (
            <button
              type="button"
              onClick={() => setActiveTab("matrix")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition",
                activeTab === "matrix" ? "bg-master-600 text-white" : "text-slate-600 hover:text-master-800",
              )}
            >
              <Network className="h-3.5 w-3.5" />
              Hybrid Matrix 3 Phase
            </button>
          )}

          {(isSuper || currentUser.role === "admin") && (
            <button
              type="button"
              onClick={() => setActiveTab("requests")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition",
                activeTab === "requests" ? "bg-master-600 text-white" : "text-slate-600 hover:text-master-800",
              )}
            >
              <ClipboardCheck className="h-3.5 w-3.5" />
              Verifikasi QRIS
            </button>
          )}

          {canEdit && (
            <button
              type="button"
              onClick={() => setActiveTab("points")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition",
                activeTab === "points" ? "bg-master-600 text-white" : "text-slate-600 hover:text-master-800",
              )}
            >
              <Coins className="h-3.5 w-3.5" />
              Edit Nilai Poin
            </button>
          )}

          {isSuper && (
            <button
              type="button"
              onClick={() => setActiveTab("users")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition",
                activeTab === "users" ? "bg-master-600 text-white" : "text-slate-600 hover:text-master-800",
              )}
            >
              <UserCog className="h-3.5 w-3.5" />
              Hak Akses & Penunjukan ({usersList.length})
            </button>
          )}

          {isSuper && (
            <button
              type="button"
              onClick={() => setActiveTab("reset")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition",
                activeTab === "reset" ? "bg-master-600 text-white" : "text-slate-600 hover:text-master-800",
              )}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset Sistem
            </button>
          )}
        </div>
      </div>

      {/* Top Stats Overview */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card p-4">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-master-500">
            <Clock3 className="h-3.5 w-3.5" /> Menunggu verifikasi
          </p>
          <p className="mt-1 text-2xl font-extrabold text-amber-600">{stats.pending}</p>
        </div>
        <div className="card p-4">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-master-500">
            <ShieldCheck className="h-3.5 w-3.5" /> Pengguna aktif
          </p>
          <p className="mt-1 text-2xl font-extrabold text-emerald-600">{stats.active}</p>
        </div>
        <div className="card p-4">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-master-500">
            <Users className="h-3.5 w-3.5" /> Total pengguna
          </p>
          <p className="mt-1 text-2xl font-extrabold text-master-950">{stats.totalUsers}</p>
        </div>
      </div>

      {/* TAB 0: HYBRID MATRIX 3 PHASE */}
      {activeTab === "matrix" && (
        <MatrixDashboard currentUserRole={currentUser.role} />
      )}

      {/* TAB RESET SISTEM (Super Admin saja) */}
      {activeTab === "reset" && isSuper && <ResetPanel />}

      {/* TAB 1: VERIFIKASI QRIS */}
      {activeTab === "requests" && (
        <>
          <div className="card p-4">
            <div className="flex flex-wrap items-center gap-1.5">
              {["pending", "approved", "rejected", "semua"].map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setFilter(item)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-[11px] font-semibold capitalize transition",
                    filter === item
                      ? "border-master-400 bg-master-50 text-master-800"
                      : "border-rose-100 bg-white text-slate-500 hover:border-master-200",
                  )}
                >
                  {item === "pending"
                    ? "Menunggu"
                    : item === "approved"
                      ? "Disetujui"
                      : item === "rejected"
                        ? "Ditolak"
                        : "Semua"}
                </button>
              ))}
              <span className="ml-auto text-[11px] text-slate-400">{filteredRequests.length} permohonan</span>
            </div>

            {filteredRequests.length === 0 ? (
              <EmptyState
                className="mt-4"
                icon={<ClipboardCheck className="h-5 w-5" />}
                title="Tidak ada permohonan pada filter ini"
                description="Permohonan baru akan tampil di sini beserta bukti pembayaran QRIS."
              />
            ) : (
              <ul className="mt-3 space-y-2.5">
                {filteredRequests.map((item) => (
                  <li key={item.id} className="rounded-2xl border border-rose-100 p-3">
                    <div className="flex flex-wrap items-start gap-3">
                      <button
                        type="button"
                        onClick={() => (item.proofUrl ? setPreview(item) : undefined)}
                        className="grid h-16 w-12 shrink-0 place-items-center overflow-hidden rounded-lg border border-rose-100 bg-rose-50"
                      >
                        {item.proofUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.proofUrl} alt="Bukti" className="h-full w-full object-cover" />
                        ) : (
                          <ImageIcon className="h-4 w-4 text-slate-400" />
                        )}
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="text-[12.5px] font-bold text-slate-800">{item.user.name}</p>
                          <StatusBadge status={item.status} />
                        </div>
                        <p className="text-[10.5px] text-slate-500">
                          {item.user.email} • {item.user.city ?? "-"} • {item.user.religion}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-600">
                          <span className="font-semibold">{formatRupiah(item.amount)}</span> • kode unik{" "}
                          {item.uniqueCode} • pengirim {item.senderName ?? "-"}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          Diajukan {formatDateTimeWib(item.createdAt)}
                          {item.reviewedAt ? ` • direview ${formatDateTimeWib(item.reviewedAt)}` : ""}
                        </p>
                        {item.note ? (
                          <p className="mt-1 rounded-lg bg-rose-50/60 px-2 py-1 text-[10.5px] text-master-900/80">
                            “{item.note}”
                          </p>
                        ) : null}
                        {item.adminNote ? (
                          <p className="mt-1 text-[10.5px] font-medium text-slate-500">
                            Catatan admin: {item.adminNote}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 flex-col gap-1.5">
                        {item.status === "pending" ? (
                          <>
                            <button
                              type="button"
                              disabled={busyId === item.id}
                              onClick={() => {
                                setAdminNote("");
                                setDecision({ request: item, action: "approve" });
                              }}
                              className="btn bg-emerald-600 px-3 py-1.5 text-[11px] text-white hover:bg-emerald-700"
                            >
                              {busyId === item.id ? <Spinner /> : <CheckCircle2 className="h-3.5 w-3.5" />} Setujui
                            </button>
                            <button
                              type="button"
                              disabled={busyId === item.id}
                              onClick={() => {
                                setAdminNote("");
                                setDecision({ request: item, action: "reject" });
                              }}
                              className="btn border border-rose-200 px-3 py-1.5 text-[11px] text-rose-600 hover:bg-rose-50"
                            >
                              <XCircle className="h-3.5 w-3.5" /> Tolak
                            </button>
                          </>
                        ) : (
                          <span className="text-[10px] font-semibold text-slate-400">Sudah diproses</span>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {/* TAB 2: EDIT NILAI POIN (Super Admin & Akun yang Ditunjuk) */}
      {activeTab === "points" && canEdit && (
        <div className="space-y-4">
          {/* Sub Navigation */}
          <div className="flex flex-wrap gap-2 border-b border-rose-100 pb-3">
            {[
              { key: "user_balance", label: "Saldo Poin Pengguna", icon: Coins },
              { key: "rewards", label: "Poin Hadiah (Katalog)", icon: Gift },
              { key: "routines", label: "Poin Rutinitas", icon: Sunrise },
              { key: "system", label: "Poin Sistem & Timer", icon: Sparkles },
            ].map((st) => {
              const Icon = st.icon;
              return (
                <button
                  key={st.key}
                  type="button"
                  onClick={() => setPointTab(st.key as typeof pointTab)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition",
                    pointTab === st.key
                      ? "border-master-500 bg-master-50 text-master-800 shadow-sm"
                      : "border-rose-100 bg-white text-slate-600 hover:bg-rose-50",
                  )}
                >
                  <Icon className="h-3.5 w-3.5 text-master-600" />
                  {st.label}
                </button>
              );
            })}
          </div>

          {/* Subtab 1: Saldo Poin Pengguna */}
          {pointTab === "user_balance" && (
            <div className="card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-master-950">Koreksi & Edit Saldo Poin Pengguna</h2>
                  <p className="text-[11.5px] text-slate-500">
                    Tambah (+) atau kurangi (-) saldo poin untuk pengguna mana saja dengan mencatat alasan koreksi.
                  </p>
                </div>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-rose-100 text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">
                      <th className="pb-2.5">Pengguna</th>
                      <th className="pb-2.5">Email</th>
                      <th className="pb-2.5">Saldo Buku Besar</th>
                      <th className="pb-2.5 text-right">Tindakan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rose-50">
                    {usersList.map((u) => (
                      <tr key={u.id} className="hover:bg-rose-50/30">
                        <td className="py-3">
                          <div className="flex items-center gap-2.5">
                            <span className="grid h-8 w-8 place-items-center rounded-full bg-rose-100 font-bold text-master-900">
                              {initials(u.name)}
                            </span>
                            <div>
                              <p className="font-semibold text-slate-800">{u.name}</p>
                              <p className="text-[10px] text-slate-400">{ROLE_LABELS[u.role] ?? u.role}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 text-slate-600">{u.email}</td>
                        <td className="py-3">
                          <span className="timer-digits text-sm font-extrabold text-master-900">
                            {formatNumber(u.ledgerBalance ?? 0)} poin
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setPointAdjustUser(u);
                              setPointDelta("500");
                              setPointReason("Penyesuaian saldo poin resmi");
                            }}
                            className="inline-flex items-center gap-1 rounded-lg bg-master-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-sm transition hover:bg-master-700"
                          >
                            <Edit3 className="h-3 w-3" />
                            Sesuaikan Saldo Poin
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Subtab 2: Poin Hadiah (Katalog) */}
          {pointTab === "rewards" && (
            <div className="card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-master-950">Edit Nilai Poin Hadiah (Katalog)</h2>
                  <p className="text-[11.5px] text-slate-500">
                    Ubah harga poin penukaran (`pointsCost`), stok, atau nama hadiah yang dapat ditukarkan pengguna.
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {rewardsList.map((r) => (
                  <div key={r.id} className="rounded-2xl border border-rose-100 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between">
                      <p className="text-xs font-bold text-slate-800">{r.name}</p>
                      <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-master-700">
                        {r.category}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">{r.description ?? "Hadiah penukaran poin"}</p>
                    <div className="mt-3 flex items-center justify-between border-t border-rose-50 pt-2.5">
                      <div>
                        <p className="text-[10px] uppercase text-slate-400">Harga Penukaran</p>
                        <p className="timer-digits text-sm font-extrabold text-master-900">
                          {formatNumber(r.pointsCost)} poin
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setEditRewardTarget(r);
                          setEditRewardPoints(String(r.pointsCost));
                          setEditRewardStock(String(r.stock));
                          setEditRewardName(r.name);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-master-800 hover:bg-rose-50"
                      >
                        <Edit3 className="h-3 w-3 text-master-600" />
                        Edit Nilai Poin
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Subtab 3: Poin Rutinitas */}
          {pointTab === "routines" && (
            <div className="card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-master-950">Edit Nilai Poin Rutinitas</h2>
                  <p className="text-[11.5px] text-slate-500">
                    Ubah bobot poin yang diberikan kepada pengguna ketika menyelesaikan rutinitas harian.
                  </p>
                </div>
              </div>

              <div className="mt-4 max-h-[520px] overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="sticky top-0 border-b border-rose-100 bg-white text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">
                      <th className="pb-2.5">Aktivitas Rutinitas</th>
                      <th className="pb-2.5">Waktu WIB</th>
                      <th className="pb-2.5">Kategori</th>
                      <th className="pb-2.5">Nilai Poin</th>
                      <th className="pb-2.5 text-right">Tindakan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rose-50">
                    {routinesList.map((rt) => (
                      <tr key={rt.id} className="hover:bg-rose-50/30">
                        <td className="py-2.5 font-semibold text-slate-800">{rt.title}</td>
                        <td className="py-2.5 text-slate-500">{rt.startTime} – {rt.endTime}</td>
                        <td className="py-2.5">
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700 capitalize">
                            {rt.category}
                          </span>
                        </td>
                        <td className="py-2.5">
                          <span className="font-extrabold text-emerald-600">+{rt.points} poin</span>
                        </td>
                        <td className="py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setEditRoutineTarget(rt);
                              setEditRoutinePoints(String(rt.points));
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-master-800 hover:bg-rose-50"
                          >
                            <Edit3 className="h-3 w-3 text-master-600" />
                            Ubah Poin
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Subtab 4: Poin Sistem & Timer */}
          {pointTab === "system" && (
            <div className="card p-5">
              <div>
                <h2 className="text-base font-bold text-master-950">Konfigurasi Nilai Poin Sistem & Timer</h2>
                <p className="text-[11.5px] text-slate-500">
                  Ubah laju pertambahan poin per detik pada Timer Waktu Maju serta nilai dasar check-in harian.
                </p>
              </div>

              <div className="mt-4 grid max-w-xl gap-4">
                <div>
                  <label className="label">Laju Poin Per Detik (Timer Waktu Maju)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="any"
                      className="input"
                      value={editPps}
                      onChange={(e) => setEditPps(e.target.value)}
                    />
                    <span className="text-xs font-semibold text-slate-600 whitespace-nowrap">poin / detik</span>
                  </div>
                  <p className="mt-1 text-[10.5px] text-slate-400">
                    Nilai default: 3.17097916667 (menghasilkan ~100 juta poin dalam 365 hari / 31.536.000 detik).
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Poin Dasar Check-In Harian</label>
                    <input
                      type="number"
                      className="input"
                      value={editCheckinBase}
                      onChange={(e) => setEditCheckinBase(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">Bonus Streak Check-In (Per Hari)</label>
                    <input
                      type="number"
                      className="input"
                      value={editCheckinBonus}
                      onChange={(e) => setEditCheckinBonus(e.target.value)}
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleSaveSystemConfig}
                    disabled={savingSystem}
                    className="btn-primary"
                  >
                    {savingSystem ? <Spinner /> : <Save className="h-4 w-4" />}
                    Simpan Nilai Poin Sistem
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: HAK AKSES & PENUNJUKAN (Khusus Super Admin) */}
      {activeTab === "users" && isSuper && (
        <div className="card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-master-950">Daftar Pengguna, Hak Akses & Penunjukan</h2>
              <p className="text-[11.5px] text-slate-500">
                Sebagai Super Admin, Anda dapat mengatur peran (Super Admin, Admin, Pengguna) serta{" "}
                <b className="text-master-800">menunjuk akun tertentu</b> agar berhak mengedit semua nilai poin.
              </p>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-rose-100 text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="pb-2.5">Pengguna</th>
                  <th className="pb-2.5">Email</th>
                  <th className="pb-2.5">Peran (Role)</th>
                  <th className="pb-2.5">Izin Edit Poin (Penunjukan)</th>
                  <th className="pb-2.5">Saldo Buku Besar</th>
                  <th className="pb-2.5 text-right">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rose-50">
                {usersList.map((u) => {
                  const hasPointRights = u.role === "super_admin" || Boolean(u.canEditPoints);
                  return (
                    <tr key={u.id} className="hover:bg-rose-50/30">
                      <td className="py-3">
                        <div className="flex items-center gap-2.5">
                          {u.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={u.avatarUrl} alt={u.name} className="h-8 w-8 rounded-full object-cover" />
                          ) : (
                            <span className="grid h-8 w-8 place-items-center rounded-full bg-rose-100 font-bold text-master-900">
                              {initials(u.name)}
                            </span>
                          )}
                          <div>
                            <p className="font-semibold text-slate-800">{u.name}</p>
                            <p className="text-[10px] text-slate-400">{u.city ?? "-"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 text-slate-600">{u.email}</td>
                      <td className="py-3">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase",
                            ROLE_BADGE_STYLE[u.role] ?? ROLE_BADGE_STYLE.user,
                          )}
                        >
                          {u.role === "super_admin" && <Crown className="h-3 w-3" />}
                          {u.role === "admin" && <ShieldCheck className="h-3 w-3" />}
                          {ROLE_LABELS[u.role] ?? u.role}
                        </span>
                      </td>
                      <td className="py-3">
                        <button
                          type="button"
                          onClick={() => handleTogglePointPermission(u)}
                          disabled={u.role === "super_admin"}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition",
                            hasPointRights
                              ? "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                              : "border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100",
                          )}
                          title={
                            u.role === "super_admin"
                              ? "Super Admin otomatis memiliki izin edit poin"
                              : "Klik untuk menunjuk / mencabut izin edit nilai poin"
                          }
                        >
                          {hasPointRights ? (
                            <>
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                              Ditunjuk (Bisa Edit Poin)
                            </>
                          ) : (
                            <>
                              <XCircle className="h-3.5 w-3.5 text-slate-400" />
                              Tidak Ditunjuk
                            </>
                          )}
                        </button>
                      </td>
                      <td className="py-3">
                        <span className="timer-digits font-bold text-slate-800">
                          {formatNumber(u.ledgerBalance ?? 0)} poin
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleOpenRoleModal(u)}
                          className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-master-800 shadow-sm transition hover:bg-rose-50"
                        >
                          <UserCog className="h-3 w-3 text-master-600" />
                          Ubah Hak Akses
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal 1: Pratinjau Bukti Pembayaran QRIS */}
      <Modal open={Boolean(preview)} onClose={() => setPreview(null)} title="Bukti pembayaran" size="lg">
        {preview?.proofUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview.proofUrl} alt="Bukti pembayaran" className="max-h-[65vh] w-full rounded-2xl object-contain" />
        ) : null}
        {preview ? (
          <p className="mt-2 text-center text-[11px] text-slate-500">
            {preview.proofName} • {preview.user.name}
          </p>
        ) : null}
      </Modal>

      {/* Modal 2: Keputusan Verifikasi QRIS */}
      <Modal
        open={Boolean(decision)}
        onClose={() => setDecision(null)}
        title={decision?.action === "approve" ? "Setujui permohonan akses?" : "Tolak permohonan akses?"}
        description={
          decision?.action === "approve"
            ? "Timer 365 hari akan mulai berjalan dari detik ke-0 untuk pengguna ini."
            : "Pengguna dapat mengajukan ulang dengan bukti pembayaran yang benar."
        }
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={() => setDecision(null)}>
              Batal
            </button>
            <button
              type="button"
              className={decision?.action === "approve" ? "btn bg-emerald-600 text-white" : "btn-danger"}
              onClick={submitDecision}
            >
              {decision?.action === "approve" ? "Ya, aktifkan akses" : "Ya, tolak permohonan"}
            </button>
          </>
        }
      >
        <div className="space-y-2">
          <div className="rounded-2xl bg-rose-50/60 p-3 text-[12px] text-master-900">
            {decision ? `${decision.request.user.name} • ${formatRupiah(decision.request.amount)}` : ""}
          </div>
          <label className="label" htmlFor="admin-note">
            Catatan admin
          </label>
          <textarea
            id="admin-note"
            className="input min-h-[72px] resize-none"
            value={adminNote}
            onChange={(event) => setAdminNote(event.target.value)}
            placeholder={
              decision?.action === "approve"
                ? "Pembayaran QRIS terverifikasi."
                : "Nominal tidak sesuai kode unik, mohon ajukan ulang."
            }
          />
        </div>
      </Modal>

      {/* Modal 3: Ubah Peran & Penunjukan Akun (Super Admin) */}
      <Modal
        open={Boolean(roleModalUser)}
        onClose={() => setRoleModalUser(null)}
        title="Ubah Hak Akses & Penunjukan Akun"
        description={roleModalUser ? `Atur peran dan izin khusus untuk ${roleModalUser.name} (${roleModalUser.email}).` : ""}
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={() => setRoleModalUser(null)}>
              Batal
            </button>
            <button type="button" className="btn-primary" onClick={handleSaveRole} disabled={savingRole}>
              {savingRole ? <Spinner /> : <UserCheck className="h-4 w-4" />}
              Simpan Perubahan
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-xs font-semibold text-slate-700">Tingkat Hak Akses (Peran):</p>
          <div className="space-y-2">
            {[
              {
                role: "super_admin",
                title: "Super Admin",
                desc: "Akses penuh ke semua modul, verifikasi QRIS, mengubah hak akses pengguna, dan edit semua nilai poin.",
                icon: Crown,
              },
              {
                role: "admin",
                title: "Admin",
                desc: "Dapat memverifikasi bukti pembayaran QRIS dan menyetujui aktivasi timer pengguna.",
                icon: ShieldCheck,
              },
              {
                role: "user",
                title: "Pengguna (User Biasa)",
                desc: "Akses reguler ke dompet poin, check-in harian, rutinitas, permohonan akses, dan penukaran poin.",
                icon: Users,
              },
            ].map((option) => {
              const Icon = option.icon;
              const isSelected = selectedRole === option.role;
              return (
                <label
                  key={option.role}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition",
                    isSelected
                      ? "border-master-500 bg-rose-50/50 shadow-sm"
                      : "border-rose-100 bg-white hover:border-master-200",
                  )}
                >
                  <input
                    type="radio"
                    name="roleOption"
                    value={option.role}
                    checked={isSelected}
                    onChange={() => setSelectedRole(option.role)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <p className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                      <Icon className="h-3.5 w-3.5 text-master-600" />
                      {option.title}
                    </p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{option.desc}</p>
                  </div>
                </label>
              );
            })}
          </div>

          {/* Point Designation Switch */}
          {selectedRole !== "super_admin" && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50/40 p-3.5">
              <label className="flex cursor-pointer items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-master-950">Tunjuk Akun untuk Edit Nilai Poin</p>
                  <p className="text-[11px] text-slate-500">
                    Beri izin kepada akun ini untuk mengubah saldo poin pengguna, poin hadiah, dan poin rutinitas.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={selectedCanEditPoints}
                  onChange={(e) => setSelectedCanEditPoints(e.target.checked)}
                  className="h-5 w-5 rounded border-rose-300 text-master-600 focus:ring-master-500"
                />
              </label>
            </div>
          )}
        </div>
      </Modal>

      {/* Modal 4: Sesuaikan Saldo Poin Pengguna */}
      <Modal
        open={Boolean(pointAdjustUser)}
        onClose={() => setPointAdjustUser(null)}
        title="Sesuaikan Saldo Poin Pengguna"
        description={
          pointAdjustUser
            ? `Ubah saldo poin untuk ${pointAdjustUser.name} (${pointAdjustUser.email}). Saldo saat ini: ${formatNumber(pointAdjustUser.ledgerBalance ?? 0)} poin.`
            : ""
        }
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={() => setPointAdjustUser(null)}>
              Batal
            </button>
            <button type="button" className="btn-primary" onClick={handleAdjustPointsSubmit} disabled={savingPoints}>
              {savingPoints ? <Spinner /> : <Save className="h-4 w-4" />}
              Terapkan Penyesuaian Saldo
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="label">Jumlah Poin (+ untuk Menambah, - untuk Mengurangi)</label>
            <input
              type="number"
              className="input font-bold"
              placeholder="Contoh: 1000 atau -500"
              value={pointDelta}
              onChange={(e) => setPointDelta(e.target.value)}
            />
            <p className="mt-1 text-[11px] text-slate-500">
              Gunakan angka positif untuk menambah saldo poin, atau angka negatif (misal: -250) untuk memotong saldo.
            </p>
          </div>

          <div>
            <label className="label">Alasan / Catatan Penyesuaian</label>
            <input
              type="text"
              className="input"
              placeholder="Contoh: Bonus partisipasi khusus atau koreksi administrasi"
              value={pointReason}
              onChange={(e) => setPointReason(e.target.value)}
            />
          </div>
        </div>
      </Modal>

      {/* Modal 5: Edit Nilai Poin Hadiah */}
      <Modal
        open={Boolean(editRewardTarget)}
        onClose={() => setEditRewardTarget(null)}
        title="Edit Nilai Poin Hadiah"
        description={editRewardTarget ? `Ubah harga poin penukaran untuk "${editRewardTarget.name}".` : ""}
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={() => setEditRewardTarget(null)}>
              Batal
            </button>
            <button type="button" className="btn-primary" onClick={handleSaveReward} disabled={savingPoints}>
              {savingPoints ? <Spinner /> : <Save className="h-4 w-4" />}
              Simpan Poin Hadiah
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="label">Nama Hadiah</label>
            <input
              type="text"
              className="input"
              value={editRewardName}
              onChange={(e) => setEditRewardName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Poin Penukaran (Points Cost)</label>
              <input
                type="number"
                className="input font-bold"
                value={editRewardPoints}
                onChange={(e) => setEditRewardPoints(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Stok Hadiah</label>
              <input
                type="number"
                className="input"
                value={editRewardStock}
                onChange={(e) => setEditRewardStock(e.target.value)}
              />
            </div>
          </div>
        </div>
      </Modal>

      {/* Modal 6: Edit Nilai Poin Rutinitas */}
      <Modal
        open={Boolean(editRoutineTarget)}
        onClose={() => setEditRoutineTarget(null)}
        title="Edit Nilai Poin Rutinitas"
        description={editRoutineTarget ? `Ubah perolehan poin saat pengguna menyelesaikan "${editRoutineTarget.title}".` : ""}
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={() => setEditRoutineTarget(null)}>
              Batal
            </button>
            <button type="button" className="btn-primary" onClick={handleSaveRoutine} disabled={savingPoints}>
              {savingPoints ? <Spinner /> : <Save className="h-4 w-4" />}
              Simpan Poin Rutinitas
            </button>
          </>
        }
      >
        <div>
          <label className="label">Nilai Poin yang Diperoleh</label>
          <input
            type="number"
            className="input font-bold"
            value={editRoutinePoints}
            onChange={(e) => setEditRoutinePoints(e.target.value)}
          />
          <p className="mt-1 text-[11px] text-slate-500">Poin akan otomatis diberikan saat aktivitas dicentang selesai.</p>
        </div>
      </Modal>

      <Toast message={toast?.message ?? null} tone={toast?.tone} onClose={() => setToast(null)} />
    </div>
  );
}
