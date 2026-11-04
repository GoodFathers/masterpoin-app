"use client";

import { useMemo, useState, useTransition } from "react";
import { CalendarCheck2, Check, Flame, Loader2, Pencil, Sparkles, Trash2, Trophy } from "lucide-react";
import { EmptyState, Modal, Spinner, Toast } from "@/components/ui";
import { CHECKIN_BASE_POINTS, CHECKIN_STREAK_BONUS, MOODS } from "@/lib/constants";
import { addDaysToKey, formatDateKeyLong, formatDateTimeWib, formatNumber, weekdayShort } from "@/lib/time";
import { cn } from "@/lib/utils";

type HistoryItem = {
  id: number;
  date: string;
  mood: string;
  note: string | null;
  points: number;
  createdAt: string;
};

export function CheckInPanel({
  initialHistory,
  initialStreak,
  today,
}: {
  initialHistory: HistoryItem[];
  initialStreak: number;
  today: string;
}) {
  const [history, setHistory] = useState<HistoryItem[]>(initialHistory);
  const [mood, setMood] = useState<string>("semangat");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pendingIds, setPendingIds] = useState<number[]>([]);
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  const [editing, setEditing] = useState<HistoryItem | null>(null);
  const [editNote, setEditNote] = useState("");
  const [editMood, setEditMood] = useState("semangat");
  const [deleteTarget, setDeleteTarget] = useState<HistoryItem | null>(null);
  const [, startTransition] = useTransition();

  const todayEntry = useMemo(() => history.find((item) => item.date === today) ?? null, [history, today]);
  const streak = useMemo(() => {
    const set = new Set(history.map((item) => item.date));
    const anchor = set.has(today) ? today : addDaysToKey(today, -1);
    if (!set.has(anchor)) return 0;
    let count = 0;
    let cursor = anchor;
    while (set.has(cursor)) {
      count += 1;
      cursor = addDaysToKey(cursor, -1);
    }
    return count;
  }, [history, today]);

  const nextBonus = Math.min(streak, 7) * CHECKIN_STREAK_BONUS;
  const potentialPoints = CHECKIN_BASE_POINTS + nextBonus;

  const days = useMemo(
    () => Array.from({ length: 14 }, (_, index) => addDaysToKey(today, index - 13)),
    [today],
  );

  const submit = async () => {
    setSubmitting(true);
    const tempId = -Date.now();
    const optimistic: HistoryItem = {
      id: tempId,
      date: today,
      mood,
      note: note.trim() || null,
      points: potentialPoints,
      createdAt: new Date().toISOString(),
    };
    setHistory((prev) => [optimistic, ...prev]);
    try {
      const response = await fetch("/api/check-ins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mood, note }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Gagal check-in");
      setHistory((prev) => [data.checkIn, ...prev.filter((item) => item.id !== tempId)]);
      setToast({ message: `Check-in berhasil! +${formatNumber(data.points)} poin`, tone: "success" });
      setNote("");
    } catch (error) {
      setHistory((prev) => prev.filter((item) => item.id !== tempId));
      setToast({ message: error instanceof Error ? error.message : "Gagal check-in", tone: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    const target = editing;
    const previous = history;
    setHistory((prev) =>
      prev.map((item) => (item.id === target.id ? { ...item, note: editNote.trim() || null, mood: editMood } : item)),
    );
    setEditing(null);
    try {
      const response = await fetch("/api/check-ins", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: target.id, mood: editMood, note: editNote }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Gagal menyimpan");
      }
      setToast({ message: "Catatan check-in diperbarui", tone: "success" });
    } catch (error) {
      setHistory(previous);
      setToast({ message: error instanceof Error ? error.message : "Gagal menyimpan", tone: "error" });
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    const previous = history;
    setDeleteTarget(null);
    setPendingIds((prev) => [...prev, target.id]);
    setHistory((prev) => prev.filter((item) => item.id !== target.id));
    try {
      const response = await fetch(`/api/check-ins?id=${target.id}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Gagal menghapus");
      }
      setToast({ message: "Check-in dihapus, poin dikoreksi", tone: "success" });
      startTransition(() => {});
    } catch (error) {
      setHistory(previous);
      setToast({ message: error instanceof Error ? error.message : "Gagal menghapus", tone: "error" });
    } finally {
      setPendingIds((prev) => prev.filter((id) => id !== target.id));
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-master-500">Modul Check-In</p>
          <h1 className="mt-1 text-[26px] font-extrabold tracking-tight text-master-950">Check-In Harian</h1>
          <p className="mt-1 text-sm text-slate-500">
            {formatDateKeyLong(today)} • hadir setiap hari, kumpulkan bonus streak.
          </p>
        </div>
        <div className="flex gap-2">
          <div className="rounded-2xl border border-rose-100 bg-white px-3.5 py-2 text-center shadow-sm">
            <p className="text-[9.5px] font-semibold uppercase tracking-wider text-master-500">Streak</p>
            <p className="flex items-center gap-1 text-lg font-extrabold text-master-950">
              <Flame className="h-4 w-4 text-master-500" /> {streak}
            </p>
          </div>
          <div className="rounded-2xl border border-rose-100 bg-white px-3.5 py-2 text-center shadow-sm">
            <p className="text-[9.5px] font-semibold uppercase tracking-wider text-master-500">Total</p>
            <p className="flex items-center gap-1 text-lg font-extrabold text-master-950">
              <Trophy className="h-4 w-4 text-amber-500" /> {history.length}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <section className="card p-5">
          {todayEntry ? (
            <div className="text-center">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-emerald-50 text-emerald-600">
                <Check className="h-8 w-8" />
              </div>
              <h2 className="mt-3 text-lg font-bold text-master-950">Check-in hari ini selesai</h2>
              <p className="mt-1 text-xs text-slate-500">
                {formatDateTimeWib(todayEntry.createdAt)} • kamu mendapat{" "}
                <span className="font-bold text-emerald-600">+{formatNumber(todayEntry.points)} poin</span>
              </p>
              {todayEntry.note ? (
                <p className="mx-auto mt-3 max-w-sm rounded-2xl bg-rose-50/70 px-4 py-3 text-[12px] italic text-slate-600">
                  “{todayEntry.note}”
                </p>
              ) : null}
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  className="btn-secondary text-[12px]"
                  onClick={() => {
                    setEditing(todayEntry);
                    setEditMood(todayEntry.mood);
                    setEditNote(todayEntry.note ?? "");
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit catatan
                </button>
                <button
                  type="button"
                  className="btn text-[12px] text-rose-600 hover:bg-rose-50"
                  onClick={() => setDeleteTarget(todayEntry)}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Batalkan check-in
                </button>
              </div>
              <p className="mt-4 text-[10.5px] text-slate-400">
                Datang lagi besok untuk menjaga streak {streak} hari mu.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-base font-bold text-master-950">Bagaimana perasaanmu pagi ini?</h2>
                  <p className="mt-1 text-[11.5px] text-slate-500">
                    Check-in memberi {CHECKIN_BASE_POINTS} poin + bonus streak hingga{" "}
                    {CHECKIN_STREAK_BONUS * 7} poin.
                  </p>
                </div>
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-master-50 text-master-700">
                  <CalendarCheck2 className="h-5 w-5" />
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {MOODS.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setMood(item.key)}
                    className={cn(
                      "rounded-2xl border px-2 py-3 text-center transition",
                      mood === item.key
                        ? "border-master-500 bg-master-50 shadow-sm"
                        : "border-rose-100 bg-white hover:border-master-300",
                    )}
                  >
                    <span className="text-xl">{item.emoji}</span>
                    <p className="mt-1 text-[11px] font-semibold text-slate-700">{item.label}</p>
                  </button>
                ))}
              </div>

              <div className="mt-4">
                <label className="label" htmlFor="checkin-note">
                  Catatan hari ini (opsional)
                </label>
                <textarea
                  id="checkin-note"
                  className="input min-h-[86px] resize-none"
                  placeholder="Contoh: bangun 03.30, salat subuh, lanjut olahraga ringan."
                  value={note}
                  maxLength={280}
                  onChange={(event) => setNote(event.target.value)}
                />
                <p className="mt-1 text-right text-[10px] text-slate-400">{note.length}/280</p>
              </div>

              <button type="button" onClick={submit} disabled={submitting} className="btn-primary mt-2 w-full">
                {submitting ? <Spinner /> : <Sparkles className="h-4 w-4" />}
                {submitting ? "Menyimpan check-in..." : `Check-in sekarang • +${formatNumber(potentialPoints)} poin`}
              </button>
              <p className="mt-2 text-center text-[10.5px] text-slate-400">
                Streak saat ini {streak} hari {nextBonus > 0 ? `• bonus ${nextBonus} poin` : ""}
              </p>
            </>
          )}
        </section>

        <section className="card p-5">
          <h2 className="text-base font-bold text-master-950">14 Hari Terakhir</h2>
          <p className="text-[11px] text-slate-500">Konsistensi check-in harianmu.</p>
          <div className="mt-4 grid grid-cols-7 gap-1.5">
            {days.map((day) => {
              const done = history.some((item) => item.date === day);
              return (
                <div
                  key={day}
                  className={cn(
                    "rounded-xl border px-1 py-2 text-center",
                    done
                      ? "border-master-200 bg-master-50 text-master-800"
                      : "border-dashed border-slate-200 bg-slate-50/60 text-slate-400",
                  )}
                >
                  <p className="text-[9px] font-semibold uppercase">{weekdayShort(day)}</p>
                  <p className="mt-0.5 text-[11px] font-bold">{Number(day.slice(-2))}</p>
                  <span
                    className={cn(
                      "mx-auto mt-1 block h-1.5 w-1.5 rounded-full",
                      done ? "bg-master-500" : "bg-slate-300",
                    )}
                  />
                </div>
              );
            })}
          </div>

          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between rounded-2xl bg-rose-50/60 px-3 py-2 text-[11.5px]">
              <span className="text-slate-600">Check-in dasar</span>
              <span className="font-bold text-master-800">+{CHECKIN_BASE_POINTS} poin</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-rose-50/60 px-3 py-2 text-[11.5px]">
              <span className="text-slate-600">Bonus streak (maks 7 hari)</span>
              <span className="font-bold text-master-800">+{CHECKIN_STREAK_BONUS * 7} poin</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-master-900 px-3 py-2 text-[11.5px] text-white">
              <span className="text-rose-100/80">Potensi hari ini</span>
              <span className="font-bold">+{formatNumber(potentialPoints)} poin</span>
            </div>
          </div>
        </section>
      </div>

      <section className="card p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-master-950">Riwayat Check-In</h2>
            <p className="text-[11px] text-slate-500">Kelola catatan check-in yang sudah tercatat.</p>
          </div>
          {pendingIds.length > 0 ? <Loader2 className="h-4 w-4 animate-spin text-master-500" /> : null}
        </div>

        {history.length === 0 ? (
          <EmptyState
            className="mt-4"
            icon={<CalendarCheck2 className="h-5 w-5" />}
            title="Belum ada check-in"
            description="Lakukan check-in pertamamu hari ini dan mulai kumpulkan poin serta bonus streak."
          />
        ) : (
          <ul className="mt-3 divide-y divide-rose-50">
            {history.map((item) => {
              const moodItem = MOODS.find((m) => m.key === item.mood);
              const isPending = pendingIds.includes(item.id);
              return (
                <li
                  key={item.id}
                  className={cn("flex items-start gap-3 py-3 transition", isPending && "opacity-50")}
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-rose-50 text-base">
                    {moodItem?.emoji ?? "🙂"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-[12.5px] font-semibold text-slate-800">{formatDateKeyLong(item.date)}</p>
                      {item.date === today ? (
                        <span className="rounded-full bg-master-50 px-2 py-0.5 text-[9px] font-bold text-master-700">
                          HARI INI
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-slate-500">
                      {item.note || `${moodItem?.label ?? "Check-in"} • ${formatDateTimeWib(item.createdAt)}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <span className="timer-digits text-[12.5px] font-bold text-emerald-600">
                      +{formatNumber(item.points)}
                    </span>
                    <button
                      type="button"
                      className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-master-700"
                      onClick={() => {
                        setEditing(item);
                        setEditMood(item.mood);
                        setEditNote(item.note ?? "");
                      }}
                      aria-label="Edit"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      onClick={() => setDeleteTarget(item)}
                      aria-label="Hapus"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title="Edit catatan check-in"
        description="Perbarui suasana hati dan catatan check-in."
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={() => setEditing(null)}>
              Batal
            </button>
            <button type="button" className="btn-primary" onClick={saveEdit}>
              Simpan perubahan
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {MOODS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setEditMood(item.key)}
                className={cn(
                  "rounded-xl border px-2 py-2 text-[12px] font-medium transition",
                  editMood === item.key
                    ? "border-master-500 bg-master-50 text-master-800"
                    : "border-rose-100 text-slate-600",
                )}
              >
                {item.emoji} {item.label}
              </button>
            ))}
          </div>
          <div>
            <label className="label">Catatan</label>
            <textarea
              className="input min-h-[90px] resize-none"
              value={editNote}
              maxLength={280}
              onChange={(event) => setEditNote(event.target.value)}
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Hapus check-in?"
        description="Poin dari check-in ini akan dikoreksi dari saldo buku besar."
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={() => setDeleteTarget(null)}>
              Batal
            </button>
            <button type="button" className="btn-danger" onClick={confirmDelete}>
              Hapus check-in
            </button>
          </>
        }
      >
        <p className="rounded-2xl bg-rose-50 p-3 text-[12px] text-rose-800">
          {deleteTarget ? `${formatDateKeyLong(deleteTarget.date)} • +${formatNumber(deleteTarget.points)} poin` : ""}
        </p>
      </Modal>

      <Toast message={toast?.message ?? null} tone={toast?.tone} onClose={() => setToast(null)} />
    </div>
  );
}
