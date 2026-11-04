"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Award,
  Binary,
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
  Clock,
  Coins,
  Crown,
  DollarSign,
  Edit,
  Eye,
  Filter,
  Gift,
  Layers,
  Network,
  Plus,
  RefreshCw,
  Save,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Sunrise,
  Trophy,
  UserCheck,
  UserCog,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import { EmptyState, Modal, Spinner, StatusBadge, Toast } from "@/components/ui";
import { formatDateTimeWib, formatNumber, formatRupiah } from "@/lib/time";
import { cn, initials } from "@/lib/utils";

export type MatrixMemberNode = {
  member: {
    id: number;
    userId: number;
    phase: number;
    level: number;
    tingkat: string;
    parentId: number | null;
    sponsorId: number | null;
    position: number;
    status: string;
    directDownlines: number;
    totalDownlines: number;
    commissionEarned: number;
    bonusEarned: number;
    rewardEarned: string | null;
    joinedAt: string;
  };
  user: {
    id: number;
    name: string;
    email: string;
    role: string;
    accessCode: string | null;
    avatarUrl: string | null;
    accessStatus: string;
  };
};

export type UnifiedMatrixUser = {
  user: {
    id: number;
    name: string;
    email: string;
    role: string;
    religion: string;
    city: string | null;
    phone: string | null;
    accessCode: string | null;
    avatarUrl: string | null;
    accessStatus: string;
    canEditPoints: boolean;
    createdAt: string;
  };
  phase1: {
    id: number;
    level: number;
    tingkat: string;
    directDownlines: number;
    totalDownlines: number;
    bonusEarned: number;
    position: number;
    status: string;
  } | null;
  phase2: {
    id: number;
    level: number;
    tingkat: string;
    directDownlines: number;
    totalDownlines: number;
    bonusEarned: number;
    position: number;
    status: string;
  } | null;
  phase3: {
    id: number;
    level: number;
    tingkat: string;
    directDownlines: number;
    totalDownlines: number;
    bonusEarned: number;
    position: number;
    status: string;
  } | null;
  totalBonus: number;
};

export type MatrixTier = {
  id: number;
  phase: number;
  level: number;
  tingkat: string;
  userTarget: number;
  bonusSponsor: number;
  bonusSpillover: number;
  bonusLevel: number;
  rewardName: string | null;
  rewardValue: number;
  checkinMultiplier: number;
  routinePointsBonus: number;
  requirementNote: string | null;
  isActive: boolean;
};

export type MatrixMission = {
  id: number;
  phase: number;
  title: string;
  description: string | null;
  targetType: string;
  targetCount: number;
  rewardPoints: number;
  rewardBonus: number;
  isActive: boolean;
};

const PHASE_HEADER_INFO: Record<
  number,
  {
    badge: string;
    title: string;
    subtitle: string;
    matrixType: string;
    levels: string;
    color: string;
  }
> = {
  1: {
    badge: "Phase 1: Training Matrix",
    title: "Phase 1 — Decimal Matrix 10-Spillover",
    subtitle: "2 Tingkat: Training 1 (10 User) & Training 2 (100 User). Setiap upline menampung maksimal 10 anggota langsung sebelum melimpah (spillover) ke bawahnya.",
    matrixType: "10-Wide Decimal Spillover",
    levels: "2 Level (10 s.d. 100 User)",
    color: "sky",
  },
  2: {
    badge: "Phase 2: Karir Hybrid (Magang ➔ Supervisor)",
    title: "Phase 2 — Binary Matrix 2-Spillover (17 Level)",
    subtitle: "17 Tingkat: Mulai dari Magang 1 (2 User), Magang 2–4, Juniar Staf 1–12, Staf 1–4, Senior Staf 1–2, Tim Leader 1–4, hingga Supervisor (131.072 User).",
    matrixType: "2-Wide Binary Spillover",
    levels: "17 Level (2 s.d. 131.072 User)",
    color: "emerald",
  },
  3: {
    badge: "Phase 3: Eksekutif (Manager ➔ Komisaris)",
    title: "Phase 3 — Executive Binary Matrix (17 Level)",
    subtitle: "17 Tingkat Eksekutif: Mulai dari Manager 1 (2 User), Manager 2–4, Senior Manager 1–2, Kepala Bagian 1–4, Director 1–2, President Director 1–4, hingga Komisaris (131.072 User).",
    matrixType: "2-Wide Executive Binary",
    levels: "17 Level (2 s.d. 131.072 User)",
    color: "purple",
  },
};

export function MatrixDashboard({
  currentUserRole,
}: {
  currentUserRole: string;
}) {
  const [activeSubTab, setActiveSubTab] = useState<"tiers" | "members" | "tree" | "missions">("tiers");
  // Default selectedPhase = 1; Masing-masing Phase dipisahkan jelas dengan tab sendiri
  const [selectedPhase, setSelectedPhase] = useState<1 | 2 | 3>(1);
  const [treePhase, setTreePhase] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const [members, setMembers] = useState<MatrixMemberNode[]>([]);
  const [unifiedUsers, setUnifiedUsers] = useState<UnifiedMatrixUser[]>([]);
  const [tiers, setTiers] = useState<MatrixTier[]>([]);
  const [missions, setMissions] = useState<MatrixMission[]>([]);
  const [stats, setStats] = useState({
    totalPhase1: 0,
    totalPhase2: 0,
    totalPhase3: 0,
    totalBonusSponsorSpillover: 0,
    totalBonusLevel: 0,
    totalBonuses: 0,
  });

  // Modal: Edit Tier
  const [editTierTarget, setEditTierTarget] = useState<MatrixTier | null>(null);
  const [tierForm, setTierForm] = useState({
    tingkat: "",
    userTarget: 0,
    bonusSponsor: 0,
    bonusSpillover: 0,
    bonusLevel: 0,
    rewardName: "",
    rewardValue: 0,
    checkinMultiplier: 100,
    routinePointsBonus: 0,
    requirementNote: "",
  });
  const [savingTier, setSavingTier] = useState(false);

  // Modal: Manual Assign Level for Member
  const [assignUserTarget, setAssignUserTarget] = useState<UnifiedMatrixUser | null>(null);
  const [assignPhaseChoice, setAssignPhaseChoice] = useState<number>(1);
  const [assignLevelChoice, setAssignLevelChoice] = useState<number>(1);
  const [savingAssign, setSavingAssign] = useState(false);

  // Modal: Award Direct Bonus
  const [awardBonusTarget, setAwardBonusTarget] = useState<UnifiedMatrixUser | null>(null);
  const [awardBonusAmount, setAwardBonusAmount] = useState<string>("100000");
  const [awardBonusType, setAwardBonusType] = useState<string>("Bonus Prestasi Matrix");
  const [awardBonusNote, setAwardBonusNote] = useState<string>("Kualifikasi kinerjanya di jaringan hybrid");
  const [awardBonusPhase, setAwardBonusPhase] = useState<number>(1);
  const [savingAward, setSavingAward] = useState(false);

  // Modal: Qualify to Phase 3
  const [qualifyUserTarget, setQualifyUserTarget] = useState<UnifiedMatrixUser | null>(null);
  const [savingQualify, setSavingQualify] = useState(false);

  // Modal: Mission Add/Edit
  const [missionModalOpen, setMissionModalOpen] = useState(false);
  const [editMissionTarget, setEditMissionTarget] = useState<MatrixMission | null>(null);
  const [missionForm, setMissionForm] = useState({
    title: "",
    phase: 1,
    description: "",
    targetType: "downlines",
    targetCount: 1,
    rewardPoints: 1000,
    rewardBonus: 0,
  });
  const [savingMission, setSavingMission] = useState(false);

  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);

  const fetchMatrixData = async (phaseParam = treePhase) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/matrix?phase=${phaseParam}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal memuat data matriks");

      setMembers(data.tree ?? []);
      setUnifiedUsers(data.unifiedUsers ?? []);
      setTiers(data.tiers ?? []);
      setMissions(data.missions ?? []);
      if (data.stats) setStats(data.stats);
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : "Gagal memuat matriks",
        tone: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatrixData(treePhase);
  }, [treePhase]);

  // Pisahkan tiers secara murni per Phase:
  const phaseTiers = useMemo(() => {
    return tiers.filter((t) => t.phase === selectedPhase);
  }, [tiers, selectedPhase]);

  // Hitung total potensi bonus kumulatif untuk phase yang dipilih
  const phaseTotalPotential = useMemo(() => {
    return phaseTiers.reduce((acc, t) => acc + (t.bonusSponsor + t.bonusSpillover + t.bonusLevel), 0);
  }, [phaseTiers]);

  // Filter unified members by query
  const filteredUnifiedUsers = useMemo(() => {
    if (!searchQuery.trim()) return unifiedUsers;
    const q = searchQuery.toLowerCase();
    return unifiedUsers.filter(
      (item) =>
        item.user.name.toLowerCase().includes(q) ||
        item.user.email.toLowerCase().includes(q) ||
        (item.user.accessCode && item.user.accessCode.toLowerCase().includes(q)) ||
        (item.phase1 && item.phase1.tingkat.toLowerCase().includes(q)) ||
        (item.phase2 && item.phase2.tingkat.toLowerCase().includes(q)) ||
        (item.phase3 && item.phase3.tingkat.toLowerCase().includes(q)),
    );
  }, [unifiedUsers, searchQuery]);

  // Save Tier
  const handleSaveTier = async () => {
    if (!editTierTarget) return;
    setSavingTier(true);
    try {
      const res = await fetch("/api/admin/matrix", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tierId: editTierTarget.id,
          ...tierForm,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal menyimpan ketentuan");

      setTiers((prev) =>
        prev.map((t) => (t.id === editTierTarget.id ? { ...t, ...tierForm } : t)),
      );
      setToast({ message: data.message ?? "Ketentuan bonus berhasil diperbarui", tone: "success" });
      setEditTierTarget(null);
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : "Gagal menyimpan", tone: "error" });
    } finally {
      setSavingTier(false);
    }
  };

  // Direct Award Bonus to Member
  const handleAwardBonusSubmit = async () => {
    if (!awardBonusTarget) return;
    const amt = Number(awardBonusAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setToast({ message: "Masukkan jumlah bonus yang valid.", tone: "error" });
      return;
    }
    setSavingAward(true);
    try {
      const res = await fetch("/api/admin/matrix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "award_matrix_bonus",
          userId: awardBonusTarget.user.id,
          bonusType: awardBonusType,
          amount: amt,
          phase: awardBonusPhase,
          note: awardBonusNote,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal menyalurkan bonus");

      setToast({ message: data.message ?? "Bonus berhasil disalurkan!", tone: "success" });
      setAwardBonusTarget(null);
      fetchMatrixData(treePhase);
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : "Gagal menyalurkan bonus", tone: "error" });
    } finally {
      setSavingAward(false);
    }
  };

  // Save Manual Assign Level
  const handleSaveAssignLevel = async () => {
    if (!assignUserTarget) return;
    setSavingAssign(true);
    try {
      const memberNode =
        assignPhaseChoice === 1
          ? assignUserTarget.phase1
          : assignPhaseChoice === 2
            ? assignUserTarget.phase2
            : assignUserTarget.phase3;

      if (!memberNode) {
        throw new Error("Pengguna belum terdaftar di phase yang dipilih. Kualifikasikan terlebih dahulu.");
      }

      const res = await fetch("/api/admin/matrix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "assign_level",
          memberId: memberNode.id,
          level: assignLevelChoice,
          phase: assignPhaseChoice,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal mengubah tingkat");

      setToast({ message: data.message ?? "Tingkat anggota berhasil diubah", tone: "success" });
      setAssignUserTarget(null);
      fetchMatrixData(treePhase);
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : "Gagal mengubah tingkat", tone: "error" });
    } finally {
      setSavingAssign(false);
    }
  };

  // Qualify User to Phase 3
  const handleQualifyPhase3 = async () => {
    if (!qualifyUserTarget) return;
    setSavingQualify(true);
    try {
      const res = await fetch("/api/admin/matrix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "qualify_phase3",
          userId: qualifyUserTarget.user.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal kualifikasi");

      setToast({
        message: `${qualifyUserTarget.user.name} berhasil dipromosikan ke Phase 3 (Manager 1)!`,
        tone: "success",
      });
      setQualifyUserTarget(null);
      fetchMatrixData(treePhase);
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : "Gagal kualifikasi", tone: "error" });
    } finally {
      setSavingQualify(false);
    }
  };

  // Save Mission
  const handleSaveMission = async () => {
    setSavingMission(true);
    try {
      const res = await fetch("/api/admin/matrix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_mission",
          missionId: editMissionTarget?.id ?? null,
          ...missionForm,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal menyimpan misi");

      setToast({ message: data.message ?? "Misi berhasil disimpan", tone: "success" });
      setMissionModalOpen(false);
      setEditMissionTarget(null);
      fetchMatrixData(treePhase);
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : "Gagal menyimpan misi", tone: "error" });
    } finally {
      setSavingMission(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Banner Alert */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-purple-200/90 bg-gradient-to-r from-purple-50 via-rose-50 to-white p-4.5 shadow-sm">
        <div className="flex items-center gap-3.5">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-purple-600 to-master-700 text-white font-bold text-sm shadow-md">
            <Crown className="h-5 w-5" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-extrabold text-purple-950">
                Hybrid Matrix Spillover 3 Phase — Panel Kontrol Presisi
              </p>
              <span className="rounded-full bg-purple-100 text-purple-800 px-2.5 py-0.5 text-[10px] font-bold tracking-wide">
                masterpoin.online
              </span>
            </div>
            <p className="mt-0.5 text-xs text-purple-900/80 leading-relaxed max-w-2xl">
              Tiap Phase kini <b>dipisahkan secara jelas dan spesifik</b> (Phase 1: 2 Level, Phase 2: 17 Level, Phase 3: 17 Level) dengan rincian bonus per level, kualifikasi, dan integrasi pendaftaran.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => fetchMatrixData(treePhase)}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-xl border border-purple-300 bg-white px-3.5 py-2 text-xs font-bold text-purple-900 shadow-sm hover:bg-purple-50 active:scale-95 transition"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin text-purple-600")} />
          Segarkan Data
        </button>
      </div>

      {/* Top Stats Overview */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="card p-4 transition hover:border-sky-200">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wider text-sky-700">Anggota Phase 1</p>
            <span className="h-2 w-2 rounded-full bg-sky-500" />
          </div>
          <p className="mt-1 text-2xl font-extrabold text-slate-900">{stats.totalPhase1}</p>
          <p className="text-[10.5px] text-slate-500 font-medium">10-Spillover (Training 1–2)</p>
        </div>

        <div className="card p-4 transition hover:border-emerald-200">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Anggota Phase 2</p>
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
          </div>
          <p className="mt-1 text-2xl font-extrabold text-slate-900">{stats.totalPhase2}</p>
          <p className="text-[10.5px] text-slate-500 font-medium">Binary 17 Level (Magang ➔ SPV)</p>
        </div>

        <div className="card p-4 transition hover:border-purple-200">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wider text-purple-700">Anggota Phase 3</p>
            <span className="h-2 w-2 rounded-full bg-purple-500" />
          </div>
          <p className="mt-1 text-2xl font-extrabold text-slate-900">{stats.totalPhase3}</p>
          <p className="text-[10.5px] text-slate-500 font-medium">Eksekutif (Manager ➔ Komisaris)</p>
        </div>

        <div className="card p-4 transition hover:border-emerald-200">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Bonus Sponsor & Spillover</p>
          <p className="mt-1 text-lg font-extrabold text-emerald-600">
            {formatRupiah(stats.totalBonusSponsorSpillover)}
          </p>
          <p className="text-[10.5px] text-slate-400">Total Akumulasi Terhitung</p>
        </div>

        <div className="col-span-2 sm:col-span-1 card p-4 transition hover:border-purple-200">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Semua Bonus</p>
          <p className="mt-1 text-lg font-extrabold text-purple-700">{formatRupiah(stats.totalBonuses)}</p>
          <p className="text-[10.5px] text-slate-400">Sponsor, Spillover & Level</p>
        </div>
      </div>

      {/* Main Feature Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rose-100 pb-2">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveSubTab("tiers")}
            className={cn(
              "flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold transition shadow-sm",
              activeSubTab === "tiers"
                ? "bg-master-600 text-white"
                : "bg-white text-slate-600 border border-rose-100 hover:bg-rose-50",
            )}
          >
            <Coins className="h-4 w-4" />
            Tabel Bonus Spesifik Per Phase (1, 2, & 3 Terpisah)
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab("members")}
            className={cn(
              "flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold transition shadow-sm",
              activeSubTab === "members"
                ? "bg-master-600 text-white"
                : "bg-white text-slate-600 border border-rose-100 hover:bg-rose-50",
            )}
          >
            <UserCog className="h-4 w-4" />
            Kontrol Anggota & Salurkan Bonus ({unifiedUsers.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab("tree")}
            className={cn(
              "flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold transition shadow-sm",
              activeSubTab === "tree"
                ? "bg-master-600 text-white"
                : "bg-white text-slate-600 border border-rose-100 hover:bg-rose-50",
            )}
          >
            <Network className="h-4 w-4" />
            Visualizer Pohon Spillover
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab("missions")}
            className={cn(
              "flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold transition shadow-sm",
              activeSubTab === "missions"
                ? "bg-master-600 text-white"
                : "bg-white text-slate-600 border border-rose-100 hover:bg-rose-50",
            )}
          >
            <Trophy className="h-4 w-4" />
            Misi & Tantangan Bonus ({missions.length})
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* TAB 1: TABEL BONUS JELAS PER LEVEL (PHASE 1, 2, 3 TERPISAH)    */}
      {/* ============================================================== */}
      {activeSubTab === "tiers" && (
        <div className="space-y-4">
          {/* Phase Selector Tabs: Memisahkan Phase 1, Phase 2, dan Phase 3 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {[
              {
                phase: 1 as const,
                title: "Phase 1: Training Matrix",
                levelsText: "2 Level (Training 1 & 2)",
                targetTotal: "Total Target: 110 User",
                icon: Layers,
                colorActive: "border-sky-500 bg-sky-50/80 text-sky-950",
                colorBadge: "bg-sky-600 text-white",
              },
              {
                phase: 2 as const,
                title: "Phase 2: Karir Hybrid",
                levelsText: "17 Level (Magang ➔ Supervisor)",
                targetTotal: "Total Target: 131.072 User",
                icon: Binary,
                colorActive: "border-emerald-500 bg-emerald-50/80 text-emerald-950",
                colorBadge: "bg-emerald-600 text-white",
              },
              {
                phase: 3 as const,
                title: "Phase 3: Eksekutif",
                levelsText: "17 Level (Manager ➔ Komisaris)",
                targetTotal: "Total Target: 131.072 User",
                icon: Crown,
                colorActive: "border-purple-500 bg-purple-50/80 text-purple-950",
                colorBadge: "bg-purple-600 text-white",
              },
            ].map((p) => {
              const Icon = p.icon;
              const isSelected = selectedPhase === p.phase;
              return (
                <button
                  key={p.phase}
                  type="button"
                  onClick={() => setSelectedPhase(p.phase)}
                  className={cn(
                    "flex flex-col text-left p-4 rounded-2xl border-2 transition active:scale-[0.99] shadow-sm",
                    isSelected
                      ? p.colorActive
                      : "border-rose-100/90 bg-white hover:border-master-200 text-slate-700",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className={cn("inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold", isSelected ? p.colorBadge : "bg-rose-50 text-master-800")}>
                      <Icon className="h-3.5 w-3.5" />
                      Phase {p.phase}
                    </span>
                    <span className="text-[11px] font-extrabold text-slate-400">
                      {p.phase === 1 ? "10-Wide Decimal" : "2-Wide Binary"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-extrabold">{p.title}</p>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">{p.levelsText}</p>
                  <p className="text-[10.5px] font-semibold text-slate-400 mt-1">{p.targetTotal}</p>
                </button>
              );
            })}
          </div>

          {/* Phase Header Info Card */}
          <div className="card p-5 border-l-4 border-l-master-600 bg-gradient-to-r from-rose-50/40 via-white to-white">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <span className="inline-block font-extrabold text-[11px] uppercase tracking-wider text-master-700">
                  {PHASE_HEADER_INFO[selectedPhase].badge}
                </span>
                <h2 className="mt-1 text-base font-extrabold text-slate-900">
                  {PHASE_HEADER_INFO[selectedPhase].title}
                </h2>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed max-w-3xl">
                  {PHASE_HEADER_INFO[selectedPhase].subtitle}
                </p>
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                <div className="rounded-xl border border-rose-100 bg-white px-3 py-2 text-center shadow-xs">
                  <p className="text-[10px] font-bold uppercase text-slate-400">Jumlah Tingkat</p>
                  <p className="text-sm font-extrabold text-master-900">{phaseTiers.length} Level</p>
                </div>
                <div className="rounded-xl border border-rose-100 bg-white px-3 py-2 text-center shadow-xs">
                  <p className="text-[10px] font-bold uppercase text-slate-400">Total Potensi Bonus Level</p>
                  <p className="text-sm font-extrabold text-emerald-700">{formatRupiah(phaseTotalPotential)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Tabel Presisi Per Level Untuk Phase Yang Dipilih */}
          <div className="card overflow-x-auto shadow-sm">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-rose-100 bg-rose-50/60 text-[11px] font-extrabold uppercase tracking-wider text-slate-700">
                  <th className="p-3.5">Level</th>
                  <th className="p-3.5">Tingkat Jabatan</th>
                  <th className="p-3.5">Jumlah User (Kapasitas)</th>
                  <th className="p-3.5">Bonus Sponsor</th>
                  <th className="p-3.5">Bonus Spillover</th>
                  <th className="p-3.5">Bonus Level</th>
                  <th className="p-3.5">Total Bonus / Level</th>
                  <th className="p-3.5">Reward / Hadiah Fisik</th>
                  <th className="p-3.5">Pengali Check-In</th>
                  <th className="p-3.5">Poin Rutinitas</th>
                  <th className="p-3.5 text-right">Kontrol</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rose-50">
                {phaseTiers.map((tier) => {
                  const totalLevelBonus = tier.bonusSponsor + tier.bonusSpillover + tier.bonusLevel;
                  return (
                    <tr
                      key={tier.id}
                      className="hover:bg-rose-50/40 transition group"
                    >
                      <td className="p-3.5 font-mono text-xs font-extrabold text-slate-900">
                        {String(tier.level).padStart(2, "0")}.
                      </td>
                      <td className="p-3.5">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 border border-rose-200 px-3 py-1 font-extrabold text-xs text-master-950">
                          {tier.tingkat}
                        </span>
                      </td>
                      <td className="p-3.5 font-extrabold text-slate-900">
                        {formatNumber(tier.userTarget)}{" "}
                        <span className="text-[10px] text-slate-400 font-medium">user</span>
                      </td>
                      <td className="p-3.5 font-bold text-emerald-700">
                        {formatRupiah(tier.bonusSponsor)}
                      </td>
                      <td className="p-3.5 font-bold text-sky-700">
                        {formatRupiah(tier.bonusSpillover)}
                      </td>
                      <td className="p-3.5 font-extrabold text-purple-700">
                        {formatRupiah(tier.bonusLevel)}
                      </td>
                      <td className="p-3.5 font-extrabold text-slate-950 bg-rose-50/20">
                        {formatRupiah(totalLevelBonus)}
                      </td>
                      <td className="p-3.5 text-slate-800">
                        <p className="font-bold">{tier.rewardName ?? "-"}</p>
                        {tier.rewardValue > 0 && (
                          <span className="text-[10.5px] text-slate-500 block font-medium">
                            Nilai: {formatRupiah(tier.rewardValue)}
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 font-extrabold text-amber-700">
                        {tier.checkinMultiplier}%
                      </td>
                      <td className="p-3.5 font-extrabold text-emerald-600">
                        +{tier.routinePointsBonus}
                      </td>
                      <td className="p-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setEditTierTarget(tier);
                            setTierForm({
                              tingkat: tier.tingkat,
                              userTarget: tier.userTarget,
                              bonusSponsor: tier.bonusSponsor,
                              bonusSpillover: tier.bonusSpillover,
                              bonusLevel: tier.bonusLevel,
                              rewardName: tier.rewardName ?? "",
                              rewardValue: tier.rewardValue,
                              checkinMultiplier: tier.checkinMultiplier,
                              routinePointsBonus: tier.routinePointsBonus,
                              requirementNote: tier.requirementNote ?? "",
                            });
                          }}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 py-1.5 text-xs font-bold text-master-800 shadow-xs hover:bg-rose-50 active:scale-95 transition"
                        >
                          <Edit className="h-3.5 w-3.5 text-master-600" />
                          Edit Nilai
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

      {/* ============================================================== */}
      {/* TAB 2: KONTROL ANGGOTA & SALURKAN BONUS LANGSUNG              */}
      {/* ============================================================== */}
      {activeSubTab === "members" && (
        <div className="space-y-4">
          <div className="card p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-slate-900">
                Pusat Kontrol Anggota Hybrid (Phase 1, 2, & 3)
              </p>
              <p className="text-[11.5px] text-slate-500">
                Data anggota ditampilkan dengan pembagian posisi tiap Phase secara presisi. Salurkan bonus langsung atau tetapkan tingkat jabatan anggota.
              </p>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Cari anggota / nomor akses..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="rounded-xl border border-rose-200 bg-white pl-8 pr-3 py-1.5 text-xs text-slate-800 outline-none focus:border-master-400 w-64"
              />
            </div>
          </div>

          <div className="card overflow-x-auto shadow-sm">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-rose-100 bg-rose-50/50 text-[10.5px] font-bold uppercase tracking-wider text-slate-600">
                  <th className="p-3.5">Anggota</th>
                  <th className="p-3.5">Nomor Akses</th>
                  <th className="p-3.5">Phase 1 (Training)</th>
                  <th className="p-3.5">Phase 2 (Karir Hybrid)</th>
                  <th className="p-3.5">Phase 3 (Eksekutif)</th>
                  <th className="p-3.5">Total Bonus</th>
                  <th className="p-3.5 text-right">Tindakan Kontrol</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rose-50">
                {filteredUnifiedUsers.map((item) => (
                  <tr key={item.user.id} className="hover:bg-rose-50/30 transition">
                    <td className="p-3.5">
                      <div className="flex items-center gap-2.5">
                        {item.user.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.user.avatarUrl}
                            alt={item.user.name}
                            className="h-8 w-8 rounded-full object-cover border border-rose-200"
                          />
                        ) : (
                          <span className="grid h-8 w-8 place-items-center rounded-full bg-rose-100 font-bold text-master-900 text-xs">
                            {initials(item.user.name)}
                          </span>
                        )}
                        <div>
                          <p className="font-bold text-slate-900">{item.user.name}</p>
                          <p className="text-[10px] text-slate-400">{item.user.email}</p>
                        </div>
                      </div>
                    </td>

                    <td className="p-3.5">
                      {item.user.accessCode ? (
                        <span className="font-mono text-xs font-bold text-master-800 bg-rose-50 px-2.5 py-0.5 rounded-md border border-rose-200">
                          {item.user.accessCode}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400">-</span>
                      )}
                    </td>

                    {/* Phase 1 */}
                    <td className="p-3.5">
                      {item.phase1 ? (
                        <div>
                          <span className="font-bold text-sky-800">{item.phase1.tingkat}</span>
                          <p className="text-[10px] text-slate-500 font-medium">
                            Downline: {item.phase1.directDownlines}/10 • Jaringan: {item.phase1.totalDownlines}
                          </p>
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>

                    {/* Phase 2 */}
                    <td className="p-3.5">
                      {item.phase2 ? (
                        <div>
                          <span className="font-bold text-emerald-800">{item.phase2.tingkat}</span>
                          <p className="text-[10px] text-slate-500 font-medium">
                            Kaki: {item.phase2.directDownlines}/2 • Jaringan: {item.phase2.totalDownlines}
                          </p>
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>

                    {/* Phase 3 */}
                    <td className="p-3.5">
                      {item.phase3 ? (
                        <div>
                          <span className="font-bold text-purple-800">{item.phase3.tingkat}</span>
                          <span className="block text-[10px] text-purple-600 font-semibold">Terkualifikasi</span>
                        </div>
                      ) : (
                        <span className="text-[10.5px] text-slate-400 italic">Belum Kualifikasi</span>
                      )}
                    </td>

                    {/* Total Bonus */}
                    <td className="p-3.5">
                      <span className="font-mono font-extrabold text-emerald-700 text-xs">
                        {formatRupiah(item.totalBonus)}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Award Bonus */}
                        <button
                          type="button"
                          onClick={() => {
                            setAwardBonusTarget(item);
                            setAwardBonusAmount("100000");
                            setAwardBonusType("Bonus Prestasi Matrix");
                            setAwardBonusNote("Pencairan bonus kinerja jaringan");
                            setAwardBonusPhase(2);
                          }}
                          className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 active:scale-95 transition"
                          title="Salurkan Bonus Langsung ke Saldo Akun"
                        >
                          <Coins className="h-3.5 w-3.5" />
                          Beri Bonus
                        </button>

                        {/* Assign Level */}
                        <button
                          type="button"
                          onClick={() => {
                            setAssignUserTarget(item);
                            setAssignPhaseChoice(1);
                            setAssignLevelChoice(item.phase1?.level ?? 1);
                          }}
                          className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-white px-2.5 py-1.5 text-xs font-bold text-master-800 shadow-xs hover:bg-rose-50"
                          title="Tetapkan Tingkat Jabatan"
                        >
                          <UserCheck className="h-3.5 w-3.5 text-master-600" />
                          Tingkat
                        </button>

                        {/* Qualify P3 */}
                        {!item.phase3 && (
                          <button
                            type="button"
                            onClick={() => setQualifyUserTarget(item)}
                            className="inline-flex items-center gap-1 rounded-xl bg-purple-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-purple-700 shadow-xs"
                            title="Promosikan ke Phase 3 Eksekutif"
                          >
                            <Crown className="h-3 w-3" />
                            ➔ P3
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 3: VISUALIZER POHON SPILLOVER                             */}
      {/* ============================================================== */}
      {activeSubTab === "tree" && (
        <div className="space-y-4">
          <div className="card p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-slate-900">
                Pohon Limpahan Matriks (Spillover Tree Explorer)
              </p>
              <p className="text-[11.5px] text-slate-500">
                Pilih phase untuk memeriksa penempatan slot parent dan downline jaringan dari atas ke bawah.
              </p>
            </div>

            {/* Tree Phase Selector */}
            <div className="flex items-center gap-1 rounded-xl border border-rose-200 bg-white p-1">
              {[
                { phase: 1, label: "Phase 1 (10-Decimal)" },
                { phase: 2, label: "Phase 2 (2-Binary)" },
                { phase: 3, label: "Phase 3 (2-Executive)" },
              ].map((p) => (
                <button
                  key={p.phase}
                  type="button"
                  onClick={() => setTreePhase(p.phase)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-bold transition",
                    treePhase === p.phase
                      ? "bg-master-50 text-master-800 border border-master-300"
                      : "text-slate-500 hover:text-slate-800",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {members.map((node) => (
              <div
                key={node.member.id}
                className="rounded-2xl border border-rose-100 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-master-500 to-master-700 text-white font-bold text-xs">
                      {initials(node.user.name)}
                    </span>
                    <div>
                      <p className="text-xs font-bold text-slate-900 leading-tight">{node.user.name}</p>
                      <p className="text-[10px] text-slate-400">{node.user.email}</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-rose-50 border border-rose-200 px-2 py-0.5 text-[10px] font-bold text-master-900">
                    Level {node.member.level}
                  </span>
                </div>

                <div className="mt-3 rounded-xl bg-rose-50/50 p-2.5 space-y-1 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Jabatan:</span>
                    <span className="font-bold text-master-900">{node.member.tingkat}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Direct Downline:</span>
                    <span className="font-bold text-slate-800">
                      {node.member.directDownlines} / {treePhase === 1 ? "10" : "2"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Total Downlines:</span>
                    <span className="font-bold text-slate-800">{node.member.totalDownlines} orang</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Slot Posisi:</span>
                    <span className="font-mono text-slate-700">Slot #{node.member.position + 1}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 4: MANAJEMEN MISI & TANTANGAN BONUS                       */}
      {/* ============================================================== */}
      {activeSubTab === "missions" && (
        <div className="space-y-4">
          <div className="card p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-slate-900">Manajemen Misi & Tantangan Bonus Matrix</p>
              <p className="text-[11.5px] text-slate-500">
                Atur tantangan untuk mendorong kecepatan limpahan spillover, streak check-in, dan rutinitas harian anggota.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditMissionTarget(null);
                setMissionForm({
                  title: "",
                  phase: 1,
                  description: "",
                  targetType: "downlines",
                  targetCount: 5,
                  rewardPoints: 20000,
                  rewardBonus: 50000,
                });
                setMissionModalOpen(true);
              }}
              className="btn-primary text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              Tambah Misi Baru
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {missions.map((mission) => (
              <div
                key={mission.id}
                className="rounded-2xl border border-rose-100 bg-white p-4 shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-bold text-slate-900">{mission.title}</p>
                    <span className="rounded-full bg-purple-50 text-purple-700 px-2 py-0.5 text-[10px] font-bold uppercase">
                      Phase {mission.phase}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">{mission.description}</p>

                  <div className="mt-3 rounded-xl bg-rose-50/50 p-2.5 text-[11px] space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Syarat Target:</span>
                      <span className="font-bold text-slate-800 capitalize">
                        {mission.targetCount} {mission.targetType}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Hadiah Poin:</span>
                      <span className="font-bold text-emerald-600">+{formatNumber(mission.rewardPoints)} poin</span>
                    </div>
                    {mission.rewardBonus > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Bonus Tunai:</span>
                        <span className="font-bold text-purple-700">{formatRupiah(mission.rewardBonus)}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-rose-50 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setEditMissionTarget(mission);
                      setMissionForm({
                        title: mission.title,
                        phase: mission.phase,
                        description: mission.description ?? "",
                        targetType: mission.targetType,
                        targetCount: mission.targetCount,
                        rewardPoints: mission.rewardPoints,
                        rewardBonus: mission.rewardBonus,
                      });
                      setMissionModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-2.5 py-1 text-[11px] font-bold text-master-800 hover:bg-rose-50"
                  >
                    <Edit className="h-3 w-3 text-master-600" />
                    Edit Misi
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 1: EDIT KETENTUAN TIER LENGKAP                          */}
      {/* ============================================================== */}
      <Modal
        open={Boolean(editTierTarget)}
        onClose={() => setEditTierTarget(null)}
        title={editTierTarget ? `Atur Ketentuan: ${editTierTarget.tingkat} (Phase ${editTierTarget.phase} • Level ${editTierTarget.level})` : ""}
        description="Ubah nilai bonus sponsor, bonus spillover, bonus level, hadiah, pengali check-in, dan poin rutinitas secara spesifik."
        size="lg"
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={() => setEditTierTarget(null)}>
              Batal
            </button>
            <button type="button" className="btn-primary" onClick={handleSaveTier} disabled={savingTier}>
              {savingTier ? <Spinner /> : <Save className="h-4 w-4" />}
              Simpan Ketentuan
            </button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="label">Nama Tingkat Jabatan</label>
            <input
              type="text"
              className="input font-bold"
              value={tierForm.tingkat}
              onChange={(e) => setTierForm({ ...tierForm, tingkat: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Target Jumlah User</label>
            <input
              type="number"
              className="input font-bold"
              value={tierForm.userTarget}
              onChange={(e) => setTierForm({ ...tierForm, userTarget: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="label">Bonus Sponsor (Rp)</label>
            <input
              type="number"
              className="input font-bold text-emerald-700"
              value={tierForm.bonusSponsor}
              onChange={(e) => setTierForm({ ...tierForm, bonusSponsor: Number(e.target.value) })}
            />
          </div>

          <div>
            <label className="label">Bonus Spillover (Rp)</label>
            <input
              type="number"
              className="input font-bold text-sky-700"
              value={tierForm.bonusSpillover}
              onChange={(e) => setTierForm({ ...tierForm, bonusSpillover: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="label">Bonus Capai Level (Rp)</label>
            <input
              type="number"
              className="input font-bold text-purple-700"
              value={tierForm.bonusLevel}
              onChange={(e) => setTierForm({ ...tierForm, bonusLevel: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="label">Nilai Reward (Rp)</label>
            <input
              type="number"
              className="input font-bold"
              value={tierForm.rewardValue}
              onChange={(e) => setTierForm({ ...tierForm, rewardValue: Number(e.target.value) })}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="label">Nama Hadiah / Reward</label>
            <input
              type="text"
              className="input"
              placeholder="Contoh: Logam Mulia / Laptop Pro / Mobil Listrik"
              value={tierForm.rewardName}
              onChange={(e) => setTierForm({ ...tierForm, rewardName: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Pengali Check-In (%)</label>
            <input
              type="number"
              className="input font-bold text-amber-700"
              value={tierForm.checkinMultiplier}
              onChange={(e) => setTierForm({ ...tierForm, checkinMultiplier: Number(e.target.value) })}
            />
          </div>

          <div>
            <label className="label">Tambahan Poin Rutinitas</label>
            <input
              type="number"
              className="input font-bold text-emerald-600"
              value={tierForm.routinePointsBonus}
              onChange={(e) => setTierForm({ ...tierForm, routinePointsBonus: Number(e.target.value) })}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Catatan Persyaratan Kualifikasi</label>
            <textarea
              className="input min-h-[48px] resize-none"
              placeholder="Syarat downline..."
              value={tierForm.requirementNote}
              onChange={(e) => setTierForm({ ...tierForm, requirementNote: e.target.value })}
            />
          </div>
        </div>
      </Modal>

      {/* ============================================================== */}
      {/* MODAL 2: SALURKAN BONUS LANGSUNG KE ANGGOTA                    */}
      {/* ============================================================== */}
      <Modal
        open={Boolean(awardBonusTarget)}
        onClose={() => setAwardBonusTarget(null)}
        title={awardBonusTarget ? `Salurkan Bonus: ${awardBonusTarget.user.name}` : ""}
        description="Bonus akan langsung dicairkan ke saldo buku besar pengguna dan tercatat dalam mutasi resmi."
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={() => setAwardBonusTarget(null)}>
              Batal
            </button>
            <button type="button" className="btn bg-emerald-600 text-white hover:bg-emerald-700" onClick={handleAwardBonusSubmit} disabled={savingAward}>
              {savingAward ? <Spinner /> : <Send className="h-4 w-4" />}
              Salurkan Bonus Sekarang
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Nominal Bonus (Rp)</label>
              <input
                type="number"
                className="input font-bold text-emerald-700 text-base"
                value={awardBonusAmount}
                onChange={(e) => setAwardBonusAmount(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Terkait Phase</label>
              <select
                className="input font-bold"
                value={awardBonusPhase}
                onChange={(e) => setAwardBonusPhase(Number(e.target.value))}
              >
                <option value={1}>Phase 1 (Training)</option>
                <option value={2}>Phase 2 (Karir Hybrid)</option>
                <option value={3}>Phase 3 (Eksekutif)</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Jenis Bonus</label>
            <input
              type="text"
              className="input"
              value={awardBonusType}
              onChange={(e) => setAwardBonusType(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Catatan Mutasi</label>
            <input
              type="text"
              className="input"
              value={awardBonusNote}
              onChange={(e) => setAwardBonusNote(e.target.value)}
            />
          </div>
        </div>
      </Modal>

      {/* ============================================================== */}
      {/* MODAL 3: UBAH TINGKAT JABATAN SECARA SPESIFIK                  */}
      {/* ============================================================== */}
      <Modal
        open={Boolean(assignUserTarget)}
        onClose={() => setAssignUserTarget(null)}
        title={assignUserTarget ? `Atur Tingkat: ${assignUserTarget.user.name}` : ""}
        description="Pilih Phase dan Level tingkat baru yang ingin ditetapkan."
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={() => setAssignUserTarget(null)}>
              Batal
            </button>
            <button type="button" className="btn-primary" onClick={handleSaveAssignLevel} disabled={savingAssign}>
              {savingAssign ? <Spinner /> : <UserCheck className="h-4 w-4" />}
              Terapkan Tingkat
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Phase Matriks</label>
              <select
                className="input font-bold"
                value={assignPhaseChoice}
                onChange={(e) => {
                  const p = Number(e.target.value);
                  setAssignPhaseChoice(p);
                  setAssignLevelChoice(1);
                }}
              >
                <option value={1}>Phase 1 (Training)</option>
                <option value={2}>Phase 2 (Magang ➔ SPV)</option>
                <option value={3}>Phase 3 (Manager ➔ Komisaris)</option>
              </select>
            </div>
            <div>
              <label className="label">Tingkat Baru</label>
              <select
                className="input font-bold"
                value={assignLevelChoice}
                onChange={(e) => setAssignLevelChoice(Number(e.target.value))}
              >
                {tiers
                  .filter((t) => t.phase === assignPhaseChoice)
                  .map((t) => (
                    <option key={t.id} value={t.level}>
                      Level {String(t.level).padStart(2, "0")} • {t.tingkat}
                    </option>
                  ))}
              </select>
            </div>
          </div>
        </div>
      </Modal>

      {/* ============================================================== */}
      {/* MODAL 4: PROMOSI KE PHASE 3                                    */}
      {/* ============================================================== */}
      <Modal
        open={Boolean(qualifyUserTarget)}
        onClose={() => setQualifyUserTarget(null)}
        title="Promosikan ke Phase 3 Eksekutif"
        description={
          qualifyUserTarget
            ? `Kualifikasikan ${qualifyUserTarget.user.name} masuk ke Matriks Eksekutif Phase 3 (Manager 1)?`
            : ""
        }
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={() => setQualifyUserTarget(null)}>
              Batal
            </button>
            <button
              type="button"
              className="btn bg-purple-600 text-white hover:bg-purple-700"
              onClick={handleQualifyPhase3}
              disabled={savingQualify}
            >
              {savingQualify ? <Spinner /> : <Crown className="h-4 w-4" />}
              Ya, Promosikan ke Phase 3
            </button>
          </>
        }
      >
        <p className="text-xs text-slate-600 leading-relaxed rounded-xl bg-purple-50 p-3">
          Pengguna akan secara otomatis ditempatkan di posisi tersedia terdepan di Matriks Binary Phase 3 (Tingkat Manager 1) dan berhak meraih jenjang Manager hingga Komisaris.
        </p>
      </Modal>

      {/* ============================================================== */}
      {/* MODAL 5: TAMBAH / EDIT MISI                                    */}
      {/* ============================================================== */}
      <Modal
        open={missionModalOpen}
        onClose={() => {
          setMissionModalOpen(false);
          setEditMissionTarget(null);
        }}
        title={editMissionTarget ? "Edit Misi Matrix" : "Tambah Misi Matrix Baru"}
        description="Atur syarat dan hadiah yang diberikan kepada anggota saat menyelesaikan misi."
        footer={
          <>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setMissionModalOpen(false);
                setEditMissionTarget(null);
              }}
            >
              Batal
            </button>
            <button type="button" className="btn-primary" onClick={handleSaveMission} disabled={savingMission}>
              {savingMission ? <Spinner /> : <Save className="h-4 w-4" />}
              Simpan Misi
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="label">Judul Misi</label>
            <input
              type="text"
              className="input font-bold"
              placeholder="Contoh: Misi Juara Magang"
              value={missionForm.title}
              onChange={(e) => setMissionForm({ ...missionForm, title: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Deskripsi Misi</label>
            <textarea
              className="input min-h-[60px] resize-none"
              placeholder="Instruksi penyelesaian..."
              value={missionForm.description}
              onChange={(e) => setMissionForm({ ...missionForm, description: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Terkait Phase</label>
              <select
                className="input font-bold"
                value={missionForm.phase}
                onChange={(e) => setMissionForm({ ...missionForm, phase: Number(e.target.value) })}
              >
                <option value={1}>Phase 1 (Training)</option>
                <option value={2}>Phase 2 (Karir Hybrid)</option>
                <option value={3}>Phase 3 (Eksekutif)</option>
              </select>
            </div>
            <div>
              <label className="label">Tipe Target</label>
              <select
                className="input"
                value={missionForm.targetType}
                onChange={(e) => setMissionForm({ ...missionForm, targetType: e.target.value })}
              >
                <option value="downlines">Target Jumlah Downline</option>
                <option value="tingkat">Target Capai Tingkat Level</option>
                <option value="checkin">Target Streak Check-In</option>
                <option value="routine">Target Rutinitas Selesai</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Jumlah Target</label>
              <input
                type="number"
                className="input font-bold"
                value={missionForm.targetCount}
                onChange={(e) => setMissionForm({ ...missionForm, targetCount: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="label">Hadiah Poin Master</label>
              <input
                type="number"
                className="input font-bold text-emerald-700"
                value={missionForm.rewardPoints}
                onChange={(e) => setMissionForm({ ...missionForm, rewardPoints: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="label">Bonus Tunai (Rp)</label>
              <input
                type="number"
                className="input font-bold text-purple-700"
                value={missionForm.rewardBonus}
                onChange={(e) => setMissionForm({ ...missionForm, rewardBonus: Number(e.target.value) })}
              />
            </div>
          </div>
        </div>
      </Modal>

      <Toast message={toast?.message ?? null} tone={toast?.tone} onClose={() => setToast(null)} />
    </div>
  );
}
