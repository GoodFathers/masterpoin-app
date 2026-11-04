"use client";

import { useMemo, useState } from "react";
import { Coins, Gift, Loader2, PackageCheck, Sparkles, Wallet } from "lucide-react";
import { EmptyState, Modal, Spinner, StatusBadge, Toast } from "@/components/ui";
import { LiveBalance } from "@/components/live-points";
import { formatDateTimeWib, formatNumber } from "@/lib/time";
import { cn } from "@/lib/utils";

type Reward = {
  id: number;
  name: string;
  description: string | null;
  category: string;
  pointsCost: number;
  stock: number;
};

type Redemption = {
  id: number;
  rewardId: number;
  name: string;
  category: string;
  pointsSpent: number;
  status: string;
  createdAt: string;
};

const CATEGORY_ICON: Record<string, string> = {
  saldo: "💳",
  pulsa: "📱",
  data: "🌐",
  sembako: "🛒",
  donasi: "🤝",
  merch: "🎁",
};

export function RewardsGallery({
  catalog,
  redemptions,
  ledgerPoints,
  timerStartedAt,
  initialBalance,
}: {
  catalog: Reward[];
  redemptions: Redemption[];
  ledgerPoints: number;
  timerStartedAt: string | null;
  initialBalance: number;
}) {
  const [items, setItems] = useState(catalog);
  const [myRedemptions, setMyRedemptions] = useState(redemptions);
  const [balance, setBalance] = useState(initialBalance);
  const [tab, setTab] = useState<"katalog" | "riwayat">("katalog");
  const [category, setCategory] = useState("semua");
  const [target, setTarget] = useState<Reward | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);

  const categories = useMemo(() => ["semua", ...Array.from(new Set(catalog.map((item) => item.category)))], [catalog]);
  const filtered = category === "semua" ? items : items.filter((item) => item.category === category);

  const redeem = async () => {
    if (!target) return;
    const reward = target;
    setSubmitting(true);
    try {
      const response = await fetch("/api/rewards/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rewardId: reward.id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Gagal menukar poin");
      setBalance(data.balance);
      setItems((prev) =>
        prev.map((item) => (item.id === reward.id ? { ...item, stock: Math.max(0, item.stock - 1) } : item)),
      );
      setMyRedemptions((prev) => [
        {
          id: data.redemptionId,
          rewardId: reward.id,
          name: reward.name,
          category: reward.category,
          pointsSpent: reward.pointsCost,
          status: "diproses",
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      setTarget(null);
      setToast({ message: `Berhasil menukar ${formatNumber(reward.pointsCost)} poin`, tone: "success" });
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : "Gagal menukar", tone: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-master-500">Katalog Hadiah</p>
          <h1 className="mt-1 text-[26px] font-extrabold tracking-tight text-master-950">Tukar Poin</h1>
          <p className="mt-1 text-sm text-slate-500">Poin dari timer, check-in, dan rutinitas bisa ditukar hadiah nyata.</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-master-600 to-master-800 px-4 py-2.5 text-white shadow-lg shadow-master-700/25">
          <p className="text-[9.5px] font-semibold uppercase tracking-[0.16em] text-rose-100/80">Saldo tersedia</p>
          <LiveBalance
            ledgerPoints={ledgerPoints}
            timerStartedAt={timerStartedAt}
            className="timer-digits text-lg font-extrabold"
            suffix="poin"
            showDelta={false}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl border border-rose-100 bg-white p-1">
          {(["katalog", "riwayat"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-[12px] font-semibold capitalize transition",
                tab === value ? "bg-master-600 text-white" : "text-slate-500 hover:text-master-700",
              )}
            >
              {value === "katalog" ? "Katalog" : "Penukaran Saya"}
            </button>
          ))}
        </div>
        {tab === "katalog" ? (
          <div className="ml-auto flex flex-wrap gap-1.5">
            {categories.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setCategory(item)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[10.5px] font-semibold capitalize transition",
                  category === item
                    ? "border-master-400 bg-master-50 text-master-800"
                    : "border-rose-100 bg-white text-slate-500 hover:border-master-200",
                )}
              >
                {item}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {tab === "katalog" ? (
        filtered.length === 0 ? (
          <div className="card p-5">
            <EmptyState icon={<Gift className="h-5 w-5" />} title="Belum ada hadiah" description="Katalog hadiah akan segera tersedia." />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((reward) => {
              const affordable = balance >= reward.pointsCost;
              const missing = reward.pointsCost - balance;
              return (
                <div key={reward.id} className="card flex flex-col p-4 transition hover:-translate-y-0.5 hover:shadow-lg">
                  <div className="flex items-start justify-between">
                    <span className="grid h-11 w-11 place-items-center rounded-2xl bg-rose-50 text-xl">
                      {CATEGORY_ICON[reward.category] ?? "🎁"}
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide",
                        reward.stock > 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-600",
                      )}
                    >
                      {reward.stock > 0 ? `Stok ${reward.stock}` : "Habis"}
                    </span>
                  </div>
                  <h3 className="mt-2.5 text-[13.5px] font-bold leading-snug text-master-950">{reward.name}</h3>
                  <p className="mt-1 flex-1 text-[11px] leading-relaxed text-slate-500">{reward.description}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="flex items-center gap-1 text-[13px] font-extrabold text-master-800">
                      <Coins className="h-3.5 w-3.5 text-amber-500" /> {formatNumber(reward.pointsCost)}
                      <span className="text-[10px] font-medium text-slate-400">poin</span>
                    </span>
                    <button
                      type="button"
                      disabled={!affordable || reward.stock <= 0}
                      onClick={() => setTarget(reward)}
                      className={cn("btn px-3 py-1.5 text-[11.5px]", affordable && reward.stock > 0 ? "btn-primary" : "bg-slate-100 text-slate-400")}
                    >
                      {affordable ? "Tukar" : `Kurang ${formatNumber(missing)}`}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : myRedemptions.length === 0 ? (
        <div className="card p-5">
          <EmptyState
            icon={<PackageCheck className="h-5 w-5" />}
            title="Belum ada penukaran"
            description="Tukar poinmu dengan hadiah dari katalog. Proses verifikasi maksimal 1x24 jam."
          />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <ul className="divide-y divide-rose-50">
            {myRedemptions.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-rose-50 text-base">
                  {CATEGORY_ICON[item.category] ?? "🎁"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-semibold text-slate-800">{item.name}</p>
                  <p className="text-[10.5px] text-slate-400">{formatDateTimeWib(item.createdAt)}</p>
                </div>
                <span className="timer-digits text-[12px] font-bold text-rose-600">-{formatNumber(item.pointsSpent)}</span>
                <StatusBadge status={item.status} />
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card flex flex-wrap items-center gap-3 p-4">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-master-50 text-master-700">
          <Sparkles className="h-4 w-4" />
        </span>
        <p className="flex-1 text-[11.5px] leading-relaxed text-slate-500">
          Poin timer terus bertambah setiap detik, jadi saldo bisa berubah saat kamu berada di halaman ini. Hadiah
          diproses admin maksimal 1x24 jam kerja.
        </p>
        <span className="flex items-center gap-1 text-[10.5px] font-semibold text-master-700">
          <Wallet className="h-3.5 w-3.5" /> {formatNumber(balance)} poin tersedia
        </span>
      </div>

      <Modal
        open={Boolean(target)}
        onClose={() => setTarget(null)}
        title="Konfirmasi penukaran poin"
        description="Poin akan dipotong dari saldo buku besar dan permintaan dikirim ke admin."
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={() => setTarget(null)}>
              Batal
            </button>
            <button type="button" className="btn-primary" onClick={redeem} disabled={submitting}>
              {submitting ? <Spinner /> : <Gift className="h-4 w-4" />} Tukar sekarang
            </button>
          </>
        }
      >
        {target ? (
          <div className="space-y-3">
            <div className="rounded-2xl bg-rose-50/60 p-3">
              <p className="text-[12.5px] font-semibold text-master-950">{target.name}</p>
              <p className="mt-0.5 text-[11px] text-slate-500">{target.description}</p>
            </div>
            <div className="space-y-1.5 text-[12px]">
              <div className="flex justify-between text-slate-600">
                <span>Harga hadiah</span>
                <span className="font-semibold">{formatNumber(target.pointsCost)} poin</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Saldo saat ini</span>
                <span className="font-semibold">{formatNumber(balance)} poin</span>
              </div>
              <div className="flex justify-between border-t border-dashed border-rose-200 pt-1.5 font-bold text-master-900">
                <span>Sisa saldo</span>
                <span>{formatNumber(balance - target.pointsCost)} poin</span>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      <Toast message={toast?.message ?? null} tone={toast?.tone} onClose={() => setToast(null)} />
      {submitting ? (
        <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Memproses penukaran...
        </div>
      ) : null}
    </div>
  );
}
