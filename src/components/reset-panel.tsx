"use client";

import { useState } from "react";
import { AlertTriangle, Clock, PowerOff, RotateCcw, ShieldAlert, Sparkles, Wallet } from "lucide-react";
import { Modal, Spinner, Toast } from "@/components/ui";
import { cn } from "@/lib/utils";

type ResetAction = "reset_balances_and_timers" | "reset_timers_only" | "deactivate_timers_only";

const ACTIONS: {
  key: ResetAction;
  title: string;
  desc: string;
  icon: typeof RotateCcw;
  tone: "danger" | "warning" | "neutral";
}[] = [
  {
    key: "reset_balances_and_timers",
    title: "Reset Total: Saldo Poin + Timer + Akses",
    desc: "Menghapus seluruh saldo poin, riwayat check-in, rutinitas, penukaran, akumulasi bonus matriks, menghentikan semua Timer (kembali 0 detik), dan menonaktifkan seluruh akun pengguna.",
    icon: RotateCcw,
    tone: "danger",
  },
  {
    key: "reset_timers_only",
    title: "Reset Timer Saja (0 Detik)",
    desc: "Menghentikan dan mengembalikan seluruh Timer ke 0 detik. Saldo poin, riwayat, dan status akun tetap tersimpan.",
    icon: Clock,
    tone: "warning",
  },
  {
    key: "deactivate_timers_only",
    title: "Nonaktifkan Semua Akses & Timer",
    desc: "Mengubah status seluruh akun pengguna menjadi Belum Aktif sehingga timer berhenti berjalan. Saldo poin tetap tersimpan.",
    icon: PowerOff,
    tone: "neutral",
  },
];

export function ResetPanel() {
  const [target, setTarget] = useState<ResetAction | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [running, setRunning] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);

  const activeAction = ACTIONS.find((a) => a.key === target) ?? null;

  const runReset = async () => {
    if (!target) return;
    if (confirmText.trim().toUpperCase() !== "RESET") {
      setToast({ message: "Ketik RESET (huruf besar) untuk melanjutkan.", tone: "error" });
      return;
    }
    setRunning(true);
    try {
      const res = await fetch("/api/admin/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: target, confirm: confirmText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal menjalankan reset");

      setToast({ message: data.message ?? "Reset berhasil dijalankan.", tone: "success" });
      setTarget(null);
      setConfirmText("");
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : "Gagal menjalankan reset", tone: "error" });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-amber-300 bg-gradient-to-r from-amber-50 via-rose-50 to-white p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-amber-500 text-white shadow-sm">
            <ShieldAlert className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-extrabold text-amber-950">Zona Berbahaya — Kontrol Reset Sistem</p>
            <p className="mt-0.5 text-[11.5px] leading-relaxed text-amber-900/80 max-w-3xl">
              Panel ini hanya dapat diakses oleh <b>Super Admin</b>. Setiap tindakan reset bersifat permanen dan langsung
              tersimpan di database. Pastikan Anda sudah memiliki cadangan data bila diperlukan.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <div
              key={action.key}
              className={cn(
                "flex flex-col justify-between rounded-2xl border bg-white p-4 shadow-sm transition hover:shadow-md",
                action.tone === "danger" && "border-rose-200",
                action.tone === "warning" && "border-amber-200",
                action.tone === "neutral" && "border-slate-200",
              )}
            >
              <div>
                <span
                  className={cn(
                    "grid h-10 w-10 place-items-center rounded-xl text-white shadow-sm",
                    action.tone === "danger" && "bg-master-600",
                    action.tone === "warning" && "bg-amber-500",
                    action.tone === "neutral" && "bg-slate-600",
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <p className="mt-3 text-xs font-extrabold text-slate-900">{action.title}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{action.desc}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setTarget(action.key);
                  setConfirmText("");
                }}
                className={cn(
                  "mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-white shadow-sm transition active:scale-[0.98]",
                  action.tone === "danger" && "bg-master-600 hover:bg-master-700",
                  action.tone === "warning" && "bg-amber-500 hover:bg-amber-600",
                  action.tone === "neutral" && "bg-slate-700 hover:bg-slate-800",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                Jalankan
              </button>
            </div>
          );
        })}
      </div>

      <div className="card p-4">
        <p className="flex items-center gap-2 text-xs font-bold text-slate-800">
          <Sparkles className="h-3.5 w-3.5 text-master-600" /> Yang terjadi setelah reset total
        </p>
        <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
          {[
            { icon: Wallet, text: "Saldo poin seluruh akun menjadi 0 poin" },
            { icon: Clock, text: "Semua Timer berhenti dan kembali ke 0 detik" },
            { icon: PowerOff, text: "Status akses pengguna kembali Belum Aktif" },
            { icon: AlertTriangle, text: "Riwayat check-in, rutinitas & penukaran dikosongkan" },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.text} className="flex items-center gap-2 rounded-xl bg-rose-50/60 px-3 py-2 text-[11px] font-medium text-slate-700">
                <Icon className="h-3.5 w-3.5 shrink-0 text-master-600" />
                {item.text}
              </div>
            );
          })}
        </div>
      </div>

      <Modal
        open={Boolean(target)}
        onClose={() => {
          if (!running) {
            setTarget(null);
            setConfirmText("");
          }
        }}
        title="Konfirmasi Reset Sistem"
        description={activeAction?.desc}
        footer={
          <>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setTarget(null);
                setConfirmText("");
              }}
              disabled={running}
            >
              Batal
            </button>
            <button
              type="button"
              className="btn-danger"
              onClick={runReset}
              disabled={running || confirmText.trim().toUpperCase() !== "RESET"}
            >
              {running ? <Spinner /> : <RotateCcw className="h-4 w-4" />}
              Ya, Jalankan Reset
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-[11.5px] leading-relaxed text-rose-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            Tindakan ini permanen dan tidak dapat dibatalkan. Ketik <b>RESET</b> pada kolom di bawah untuk mengonfirmasi.
          </div>
          <div>
            <label className="label" htmlFor="reset-confirm">
              Konfirmasi
            </label>
            <input
              id="reset-confirm"
              className="input font-mono font-bold tracking-widest"
              placeholder="RESET"
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              autoComplete="off"
            />
          </div>
        </div>
      </Modal>

      <Toast message={toast?.message ?? null} tone={toast?.tone} onClose={() => setToast(null)} />
    </div>
  );
}
