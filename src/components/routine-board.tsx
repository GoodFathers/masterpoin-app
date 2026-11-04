"use client";

import { useMemo, useState } from "react";
import {
  Check,
  Clock,
  Filter,
  Loader2,
  Pencil,
  Plus,
  Sparkles,
  Sunrise,
  Trash2,
} from "lucide-react";
import { EmptyState, Modal, ProgressBar, Spinner, Toast } from "@/components/ui";
import { RELIGIONS, RELIGION_LABELS, ROUTINE_CATEGORIES, ROUTINE_WINDOW } from "@/lib/constants";
import { formatDateKeyLong, formatNumber, timeToMinutes, weekdayShort } from "@/lib/time";
import { cn } from "@/lib/utils";

export type RoutineItem = {
  id: number;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string;
  category: string;
  religion: string;
  points: number;
  isActive: boolean;
  done: boolean;
};

type FormState = {
  id?: number;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  category: string;
  religion: string;
  points: number;
};

const EMPTY_FORM: FormState = {
  title: "",
  description: "",
  startTime: "04:00",
  endTime: "04:30",
  category: "ibadah",
  religion: "semua",
  points: 50,
};

const CATEGORY_STYLE: Record<string, string> = {
  ibadah: "bg-master-50 text-master-700 border-master-100",
  kesehatan: "bg-emerald-50 text-emerald-700 border-emerald-100",
  produktivitas: "bg-sky-50 text-sky-700 border-sky-100",
  keluarga: "bg-amber-50 text-amber-700 border-amber-100",
  sosial: "bg-violet-50 text-violet-700 border-violet-100",
};

function blockLabel(time: string): string {
  const minutes = timeToMinutes(time);
  if (minutes < 360) return "Awal Hari • 03.30";
  if (minutes < 660) return "Pagi";
  if (minutes < 900) return "Siang";
  if (minutes < 1110) return "Sore";
  return "Malam • hingga 22.00";
}

export function RoutineBoard({
  initialItems,
  weekly,
  userReligion,
  today,
}: {
  initialItems: RoutineItem[];
  weekly: { date: string; count: number; points: number }[];
  userReligion: string;
  today: string;
}) {
  const [items, setItems] = useState<RoutineItem[]>(initialItems);
  const [religionFilter, setReligionFilter] = useState<string>("umat-saya");
  const [categoryFilter, setCategoryFilter] = useState<string>("semua");
  const [pending, setPending] = useState<number[]>([]);
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RoutineItem | null>(null);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const religionOk =
        religionFilter === "semua"
          ? true
          : religionFilter === "umat-saya"
            ? item.religion === "semua" || item.religion === userReligion
            : item.religion === religionFilter || item.religion === "semua";
      const categoryOk = categoryFilter === "semua" || item.category === categoryFilter;
      return religionOk && categoryOk;
    });
  }, [items, religionFilter, categoryFilter, userReligion]);

  const grouped = useMemo(() => {
    const map = new Map<string, RoutineItem[]>();
    for (const item of filtered) {
      const label = blockLabel(item.startTime);
      map.set(label, [...(map.get(label) ?? []), item]);
    }
    return Array.from(map.entries()).sort(
      (a, b) => timeToMinutes(a[1][0].startTime) - timeToMinutes(b[1][0].startTime),
    );
  }, [filtered]);

  const doneToday = items.filter((item) => item.done);
  const pointsToday = doneToday.reduce((sum, item) => sum + item.points, 0);
  const progress = items.length ? (doneToday.length / items.length) * 100 : 0;
  const worshipTotal = items.filter((item) => item.category === "ibadah").length;
  const worshipDone = doneToday.filter((item) => item.category === "ibadah").length;
  const maxWeekly = Math.max(1, ...weekly.map((day) => day.points));

  const toggle = async (item: RoutineItem) => {
    const nextDone = !item.done;
    const previous = items;
    setItems((prev) => prev.map((row) => (row.id === item.id ? { ...row, done: nextDone } : row)));
    setPending((prev) => [...prev, item.id]);
    try {
      const response = await fetch("/api/routines/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ routineId: item.id, done: nextDone }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Gagal memperbarui rutinitas");
      setToast({
        message: `${item.title} ${nextDone ? "selesai" : "dibatalkan"} • ${nextDone ? "+" : "-"}${formatNumber(item.points)} poin`,
        tone: "success",
      });
    } catch (error) {
      setItems(previous);
      setToast({ message: error instanceof Error ? error.message : "Gagal memperbarui", tone: "error" });
    } finally {
      setPending((prev) => prev.filter((id) => id !== item.id));
    }
  };

  const openCreate = () => {
    setForm({
      ...EMPTY_FORM,
      religion: userReligion || "semua",
      startTime: "19:00",
      endTime: "19:30",
    });
  };

  const openEdit = (item: RoutineItem) => {
    setForm({
      id: item.id,
      title: item.title,
      description: item.description ?? "",
      startTime: item.startTime,
      endTime: item.endTime,
      category: item.category,
      religion: item.religion,
      points: item.points,
    });
  };

  const save = async () => {
    if (!form) return;
    if (form.title.trim().length < 3) {
      setToast({ message: "Nama rutinitas minimal 3 karakter.", tone: "error" });
      return;
    }
    setSaving(true);
    try {
      const isEdit = Boolean(form.id);
      const response = await fetch("/api/routines", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Gagal menyimpan rutinitas");
      const saved = data.routine as RoutineItem;
      setItems((prev) =>
        isEdit
          ? prev.map((row) => (row.id === saved.id ? { ...row, ...saved, done: row.done } : row))
          : [...prev, { ...saved, done: false }].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)),
      );
      setForm(null);
      setToast({ message: isEdit ? "Rutinitas diperbarui" : "Rutinitas baru ditambahkan", tone: "success" });
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : "Gagal menyimpan", tone: "error" });
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    const previous = items;
    setDeleteTarget(null);
    setItems((prev) => prev.filter((row) => row.id !== target.id));
    try {
      const response = await fetch(`/api/routines?id=${target.id}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Gagal menghapus");
      }
      setToast({ message: "Rutinitas dihapus", tone: "success" });
    } catch (error) {
      setItems(previous);
      setToast({ message: error instanceof Error ? error.message : "Gagal menghapus", tone: "error" });
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-master-500">Modul Rutinitas</p>
          <h1 className="mt-1 text-[26px] font-extrabold tracking-tight text-master-950">
            Rutinitas {ROUTINE_WINDOW.start.replace(":", ".")} – {ROUTINE_WINDOW.end.replace(":", ".")} WIB
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {formatDateKeyLong(today)} • aktivitas harian lengkap dengan ibadah semua agama.
          </p>
        </div>
        <button type="button" className="btn-primary text-[12.5px]" onClick={openCreate}>
          <Plus className="h-4 w-4" /> Tambah Rutinitas
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="card p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-master-500">Progres hari ini</p>
          <p className="mt-1 text-2xl font-extrabold text-master-950">
            {doneToday.length}
            <span className="text-sm font-semibold text-slate-400">/{items.length}</span>
          </p>
          <ProgressBar value={progress} className="mt-2" />
        </div>
        <div className="card p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-master-500">Poin rutinitas hari ini</p>
          <p className="mt-1 text-2xl font-extrabold text-master-950">{formatNumber(pointsToday)}</p>
          <p className="mt-1 text-[10.5px] text-slate-400">otomatis masuk ke saldo poin</p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-master-500">Ibadah</p>
          <p className="mt-1 text-2xl font-extrabold text-master-950">
            {worshipDone}
            <span className="text-sm font-semibold text-slate-400">/{worshipTotal}</span>
          </p>
          <p className="mt-1 text-[10.5px] text-slate-400">{RELIGION_LABELS[userReligion] ?? "Semua umat"}</p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-master-500">7 hari terakhir</p>
          <div className="mt-2 flex h-9 items-end gap-1">
            {weekly.map((day) => (
              <div key={day.date} className="flex-1" title={`${day.date}: ${day.points} poin`}>
                <div
                  className="w-full rounded-sm bg-gradient-to-t from-master-600 to-master-400"
                  style={{ height: `${Math.max(4, (day.points / maxWeekly) * 36)}px` }}
                />
              </div>
            ))}
          </div>
          <p className="mt-1 text-[9.5px] text-slate-400">
            {weekly.map((day) => weekdayShort(day.date).slice(0, 1)).join(" ")}
          </p>
        </div>
      </div>

      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
            <Filter className="h-3.5 w-3.5" /> Filter
          </span>
          <select
            className="rounded-xl border border-rose-200 bg-white px-2.5 py-1.5 text-[11.5px] font-medium text-slate-700 outline-none focus:border-master-400"
            value={religionFilter}
            onChange={(event) => setReligionFilter(event.target.value)}
          >
            <option value="umat-saya">Umat saya ({RELIGION_LABELS[userReligion] ?? "Semua"})</option>
            <option value="semua">Semua rutinitas</option>
            {RELIGIONS.map((religion) => (
              <option key={religion.key} value={religion.key}>
                {religion.label}
              </option>
            ))}
          </select>
          <select
            className="rounded-xl border border-rose-200 bg-white px-2.5 py-1.5 text-[11.5px] font-medium text-slate-700 outline-none focus:border-master-400"
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
          >
            <option value="semua">Semua kategori</option>
            {ROUTINE_CATEGORIES.map((category) => (
              <option key={category.key} value={category.key}>
                {category.label}
              </option>
            ))}
          </select>
          <span className="ml-auto text-[11px] text-slate-400">{filtered.length} aktivitas ditampilkan</span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card p-5">
          <EmptyState
            icon={<Sunrise className="h-5 w-5" />}
            title="Belum ada rutinitas pada filter ini"
            description="Tambahkan rutinitas baru dalam rentang 03.30 – 22.00 WIB atau ubah filter agama/kategori."
            action={
              <button type="button" className="btn-primary text-[12px]" onClick={openCreate}>
                <Plus className="h-3.5 w-3.5" /> Tambah rutinitas
              </button>
            }
          />
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([label, list]) => (
            <div key={label} className="card overflow-hidden">
              <div className="flex items-center justify-between border-b border-rose-50 bg-rose-50/40 px-4 py-2">
                <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-master-700">
                  <Sunrise className="h-3.5 w-3.5" /> {label}
                </p>
                <p className="text-[10.5px] text-slate-400">
                  {list.filter((item) => item.done).length}/{list.length} selesai
                </p>
              </div>
              <ul className="divide-y divide-rose-50">
                {list.map((item) => {
                  const isPending = pending.includes(item.id);
                  return (
                    <li key={item.id} className={cn("flex gap-3 px-4 py-3 transition", isPending && "opacity-60")}>
                      <button
                        type="button"
                        onClick={() => toggle(item)}
                        disabled={isPending}
                        aria-label={item.done ? "Batalkan" : "Tandai selesai"}
                        className={cn(
                          "mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 transition",
                          item.done
                            ? "border-emerald-500 bg-emerald-500 text-white"
                            : "border-rose-200 bg-white text-transparent hover:border-master-400",
                        )}
                      >
                        {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin text-master-500" /> : <Check className="h-4 w-4" />}
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p
                            className={cn(
                              "text-[13px] font-semibold",
                              item.done ? "text-slate-400 line-through" : "text-slate-800",
                            )}
                          >
                            {item.title}
                          </p>
                          <span
                            className={cn(
                              "rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
                              CATEGORY_STYLE[item.category] ?? "border-slate-100 bg-slate-50 text-slate-600",
                            )}
                          >
                            {ROUTINE_CATEGORIES.find((c) => c.key === item.category)?.label ?? item.category}
                          </span>
                          {item.religion !== "semua" ? (
                            <span className="rounded-full bg-rose-50 px-1.5 py-0.5 text-[9px] font-semibold text-master-700">
                              {RELIGION_LABELS[item.religion] ?? item.religion}
                            </span>
                          ) : null}
                        </div>
                        {item.description ? (
                          <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{item.description}</p>
                        ) : null}
                        <p className="mt-1 flex items-center gap-1 text-[10px] text-slate-400">
                          <Clock className="h-3 w-3" /> {item.startTime} – {item.endTime} WIB
                          <span className="mx-1">•</span>
                          <Sparkles className="h-3 w-3 text-amber-500" /> +{item.points} poin
                        </p>
                      </div>

                      <div className="flex shrink-0 items-start gap-0.5">
                        <button
                          type="button"
                          onClick={() => openEdit(item)}
                          className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-master-700"
                          aria-label="Edit rutinitas"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(item)}
                          className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                          aria-label="Hapus rutinitas"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={Boolean(form)}
        onClose={() => setForm(null)}
        title={form?.id ? "Edit rutinitas" : "Tambah rutinitas baru"}
        description="Rentang waktu harus berada di antara 03.30 – 22.00 WIB."
        size="lg"
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={() => setForm(null)}>
              Batal
            </button>
            <button type="button" className="btn-primary" onClick={save} disabled={saving}>
              {saving ? <Spinner /> : null}
              {form?.id ? "Simpan perubahan" : "Tambah rutinitas"}
            </button>
          </>
        }
      >
        {form ? (
          <div className="space-y-3">
            <div>
              <label className="label" htmlFor="routine-title">
                Nama aktivitas
              </label>
              <input
                id="routine-title"
                className="input"
                placeholder="Contoh: Sembahyang pagi & hening"
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
              />
            </div>
            <div>
              <label className="label" htmlFor="routine-desc">
                Deskripsi singkat
              </label>
              <textarea
                id="routine-desc"
                className="input min-h-[70px] resize-none"
                placeholder="Detail aktivitas, lokasi, atau panduan pelaksanaan."
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <label className="label" htmlFor="routine-start">
                  Mulai
                </label>
                <input
                  id="routine-start"
                  type="time"
                  min="03:30"
                  max="22:00"
                  className="input"
                  value={form.startTime}
                  onChange={(event) => setForm({ ...form, startTime: event.target.value })}
                />
              </div>
              <div>
                <label className="label" htmlFor="routine-end">
                  Selesai
                </label>
                <input
                  id="routine-end"
                  type="time"
                  min="03:30"
                  max="22:00"
                  className="input"
                  value={form.endTime}
                  onChange={(event) => setForm({ ...form, endTime: event.target.value })}
                />
              </div>
              <div>
                <label className="label" htmlFor="routine-points">
                  Poin
                </label>
                <input
                  id="routine-points"
                  type="number"
                  min={10}
                  max={200}
                  className="input"
                  value={form.points}
                  onChange={(event) => setForm({ ...form, points: Number(event.target.value) })}
                />
              </div>
              <div>
                <label className="label" htmlFor="routine-category">
                  Kategori
                </label>
                <select
                  id="routine-category"
                  className="input"
                  value={form.category}
                  onChange={(event) => setForm({ ...form, category: event.target.value })}
                >
                  {ROUTINE_CATEGORIES.map((category) => (
                    <option key={category.key} value={category.key}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="label" htmlFor="routine-religion">
                Untuk umat
              </label>
              <select
                id="routine-religion"
                className="input"
                value={form.religion}
                onChange={(event) => setForm({ ...form, religion: event.target.value })}
              >
                <option value="semua">Semua umat (lintas agama)</option>
                {RELIGIONS.map((religion) => (
                  <option key={religion.key} value={religion.key}>
                    {religion.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Hapus rutinitas?"
        description="Catatan penyelesaian pada tanggal sebelumnya juga akan terhapus."
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={() => setDeleteTarget(null)}>
              Batal
            </button>
            <button type="button" className="btn-danger" onClick={confirmDelete}>
              Hapus rutinitas
            </button>
          </>
        }
      >
        <p className="rounded-2xl bg-rose-50 p-3 text-[12px] text-rose-800">
          {deleteTarget?.title} • {deleteTarget?.startTime}–{deleteTarget?.endTime} WIB
        </p>
      </Modal>

      <Toast message={toast?.message ?? null} tone={toast?.tone} onClose={() => setToast(null)} />
    </div>
  );
}
