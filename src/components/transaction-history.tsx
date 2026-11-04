"use client";

import { useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Download, Receipt, RotateCw } from "lucide-react";
import { EmptyState, Toast } from "@/components/ui";
import { formatDateTimeWib, formatNumber } from "@/lib/time";
import { cn } from "@/lib/utils";

type TransactionItem = {
  id: number;
  type: string;
  title: string;
  detail: string | null;
  points: number;
  createdAt: string;
};

const FILTERS = [
  { key: "semua", label: "Semua" },
  { key: "checkin", label: "Check-in" },
  { key: "rutinitas", label: "Rutinitas" },
  { key: "redeem", label: "Penukaran" },
  { key: "akses", label: "Akses" },
  { key: "bonus", label: "Bonus" },
];

const TYPE_STYLE: Record<string, string> = {
  checkin: "bg-sky-50 text-sky-700",
  rutinitas: "bg-emerald-50 text-emerald-700",
  redeem: "bg-amber-50 text-amber-700",
  bonus: "bg-violet-50 text-violet-700",
  akses: "bg-rose-50 text-rose-700",
};

export function TransactionHistory({
  initialItems,
  initialBalance,
}: {
  initialItems: TransactionItem[];
  initialBalance: number;
}) {
  const [items, setItems] = useState(initialItems);
  const [filter, setFilter] = useState("semua");
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState(initialBalance);
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  const [firstLoad, setFirstLoad] = useState(true);

  useEffect(() => {
    if (firstLoad) {
      setFirstLoad(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/transactions?type=${filter}`)
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) return;
        if (!data.ok) throw new Error(data.error ?? "Gagal memuat riwayat");
        setItems(data.items);
        setBalance(data.balance);
      })
      .catch((error: Error) => {
        if (!cancelled) setToast({ message: error.message, tone: "error" });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const totalIn = items.filter((item) => item.points > 0).reduce((sum, item) => sum + item.points, 0);
  const totalOut = items.filter((item) => item.points < 0).reduce((sum, item) => sum + item.points, 0);

  const exportCsv = () => {
    const rows = [
      ["Tanggal", "Jenis", "Judul", "Detail", "Poin"],
      ...items.map((item) => [
        formatDateTimeWib(item.createdAt),
        item.type,
        item.title,
        item.detail ?? "",
        String(item.points),
      ]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "riwayat-poin-master.csv";
    anchor.click();
    URL.revokeObjectURL(url);
    setToast({ message: "Riwayat poin diunduh sebagai CSV", tone: "success" });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-master-500">Buku Besar Poin</p>
          <h1 className="mt-1 text-[26px] font-extrabold tracking-tight text-master-950">Riwayat Poin</h1>
          <p className="mt-1 text-sm text-slate-500">Semua mutasi poin dari aktivitas, penukaran, dan aktivasi akses.</p>
        </div>
        <button type="button" className="btn-secondary text-[12px]" onClick={exportCsv}>
          <Download className="h-4 w-4" /> Ekspor CSV
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-master-500">Poin masuk</p>
          <p className="mt-1 flex items-center gap-1 text-xl font-extrabold text-emerald-600">
            <ArrowDownLeft className="h-4 w-4" /> +{formatNumber(totalIn)}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-master-500">Poin keluar</p>
          <p className="mt-1 flex items-center gap-1 text-xl font-extrabold text-rose-600">
            <ArrowUpRight className="h-4 w-4" /> {formatNumber(totalOut)}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-master-500">Saldo tercatat</p>
          <p className="timer-digits mt-1 text-xl font-extrabold text-master-950">{formatNumber(balance)}</p>
        </div>
      </div>

      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {FILTERS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setFilter(item.key)}
              className={cn(
                "rounded-full border px-3 py-1 text-[11px] font-semibold transition",
                filter === item.key
                  ? "border-master-400 bg-master-50 text-master-800"
                  : "border-rose-100 bg-white text-slate-500 hover:border-master-200",
              )}
            >
              {item.label}
            </button>
          ))}
          {loading ? <RotateCw className="ml-auto h-3.5 w-3.5 animate-spin text-master-500" /> : null}
        </div>

        <div className="mt-3">
          {loading ? (
            <div className="space-y-2">
              {[0, 1, 2, 3, 4].map((index) => (
                <div key={index} className="flex items-center gap-3 py-2">
                  <div className="skeleton h-8 w-8 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <div className="skeleton h-3 w-1/3" />
                    <div className="skeleton h-2.5 w-1/2" />
                  </div>
                  <div className="skeleton h-3 w-16" />
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={<Receipt className="h-5 w-5" />}
              title="Belum ada mutasi poin"
              description="Aktivitas check-in dan rutinitas akan muncul di sini setelah kamu mulai."
            />
          ) : (
            <ul className="divide-y divide-rose-50">
              {items.map((item) => (
                <li key={item.id} className="flex items-center gap-3 py-2.5">
                  <span
                    className={cn(
                      "grid h-8 w-8 shrink-0 place-items-center rounded-full text-[10px] font-bold uppercase",
                      TYPE_STYLE[item.type] ?? "bg-slate-50 text-slate-600",
                    )}
                  >
                    {item.type.slice(0, 2)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-semibold text-slate-800">{item.title}</p>
                    <p className="truncate text-[10.5px] text-slate-400">
                      {formatDateTimeWib(item.createdAt)}
                      {item.detail ? ` • ${item.detail}` : ""}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "timer-digits shrink-0 text-[13px] font-bold",
                      item.points > 0 ? "text-emerald-600" : item.points < 0 ? "text-rose-600" : "text-slate-400",
                    )}
                  >
                    {item.points > 0 ? "+" : ""}
                    {formatNumber(item.points)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <Toast message={toast?.message ?? null} tone={toast?.tone} onClose={() => setToast(null)} />
    </div>
  );
}
