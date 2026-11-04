"use client";

import { useRef, useState } from "react";
import {
  BadgeCheck,
  Ban,
  Clock3,
  ImageUp,
  Info,
  Loader2,
  QrCode,
  RefreshCw,
  Send,
  ShieldCheck,
  Trash2,
  Wallet,
} from "lucide-react";
import { EmptyState, Modal, StatusBadge, Toast } from "@/components/ui";
import { MasterTimerCard } from "@/components/live-points";
import { ACCESS_FEE, QRIS } from "@/lib/constants";
import { formatDateTimeWib, formatNumber, formatRupiah } from "@/lib/time";
import { cn } from "@/lib/utils";

type AccessRequestItem = {
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
};

const STATUS_TIMELINE = [
  { key: "pending", label: "Permohonan dikirim", desc: "Menunggu verifikasi admin" },
  { key: "approved", label: "Pembayaran diverifikasi", desc: "Timer 365 hari dimulai" },
];

export function AccessPanel({
  initialRequests,
  initialStatus,
  timerStartedAt,
  userName,
}: {
  initialRequests: AccessRequestItem[];
  initialStatus: string;
  timerStartedAt: string | null;
  userName: string;
}) {
  const [requests, setRequests] = useState<AccessRequestItem[]>(initialRequests);
  const [accessStatus, setAccessStatus] = useState(initialStatus);
  const [uniqueCode, setUniqueCode] = useState(() => String(Math.floor(Math.random() * 900) + 100));
  const [senderName, setSenderName] = useState(userName);
  const [note, setNote] = useState("");
  const [proof, setProof] = useState<{ dataUrl: string; name: string; size: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<AccessRequestItem | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const amount = ACCESS_FEE + Number(uniqueCode || 0);
  const pending = requests.find((item) => item.status === "pending") ?? null;
  const isActive = accessStatus === "active";
  const latest = requests[0] ?? null;
  const canApply = !isActive && !pending;

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setToast({ message: "Bukti pembayaran harus berupa gambar (JPG/PNG).", tone: "error" });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setToast({ message: "Ukuran file maksimal 2 MB.", tone: "error" });
      return;
    }
    setUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      setProof({ dataUrl: String(reader.result), name: file.name, size: file.size });
      setUploading(false);
      setToast({ message: "Bukti pembayaran siap dikirim.", tone: "success" });
    };
    reader.onerror = () => {
      setUploading(false);
      setToast({ message: "Gagal membaca file. Coba lagi.", tone: "error" });
    };
    reader.readAsDataURL(file);
  };

  const submit = async () => {
    if (!proof) {
      setToast({ message: "Wajib mengunggah bukti pembayaran QRIS.", tone: "error" });
      return;
    }
    if (senderName.trim().length < 3) {
      setToast({ message: "Nama pengirim minimal 3 karakter.", tone: "error" });
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch("/api/access-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proofUrl: proof.dataUrl,
          proofName: proof.name,
          senderName,
          note,
          uniqueCode: Number(uniqueCode),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Gagal mengirim permohonan");
      const created = data.request as AccessRequestItem;
      setRequests((prev) => [created, ...prev]);
      setAccessStatus("pending");
      setProof(null);
      setNote("");
      if (fileRef.current) fileRef.current.value = "";
      setToast({ message: "Permohonan akses terkirim. Menunggu verifikasi admin.", tone: "success" });
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : "Gagal mengirim", tone: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  const doCancel = async () => {
    if (!cancelTarget) return;
    const target = cancelTarget;
    setCancelTarget(null);
    const previous = requests;
    setRequests((prev) => prev.map((item) => (item.id === target.id ? { ...item, status: "cancelled" } : item)));
    setAccessStatus("inactive");
    try {
      const response = await fetch(`/api/access-requests/${target.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Gagal membatalkan");
      }
      setToast({ message: "Permohonan dibatalkan. Kamu bisa mengajukan ulang.", tone: "success" });
    } catch (error) {
      setRequests(previous);
      setAccessStatus("pending");
      setToast({ message: error instanceof Error ? error.message : "Gagal membatalkan", tone: "error" });
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-master-500">Aktivasi Timer</p>
          <h1 className="mt-1 text-[26px] font-extrabold tracking-tight text-master-950">Permohonan Akses Pengguna</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Bayar via QRIS dengan 3 angka unik, unggah bukti pembayaran, lalu timer 365 hari mulai berjalan dari detik
            ke-0 setelah admin memverifikasi.
          </p>
        </div>
        <StatusBadge
          status={accessStatus}
          label={isActive ? "Akses Aktif" : accessStatus === "pending" ? "Menunggu Verifikasi" : "Belum Aktif"}
        />
      </div>

      {isActive ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <MasterTimerCard timerStartedAt={timerStartedAt} accessStatus={accessStatus} />
          <div className="card p-5">
            <div className="flex items-center gap-2 text-emerald-700">
              <BadgeCheck className="h-5 w-5" />
              <p className="text-base font-bold">Akses sudah aktif</p>
            </div>
            <p className="mt-1.5 text-[12px] leading-relaxed text-slate-500">
              Timer berjalan otomatis dan poin bertambah setiap detik. Tidak perlu mengajukan permohonan
              baru.
            </p>
            <div className="mt-3 rounded-2xl bg-emerald-50/70 p-3 text-[11.5px] text-emerald-800">
              <p className="font-semibold">Status timer</p>
              <p className="mt-0.5">
                Dimulai {timerStartedAt ? formatDateTimeWib(timerStartedAt) : "-"} • berakhir otomatis setelah 365
                hari.
              </p>
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-2xl bg-rose-50/70 p-3 text-[11px] text-master-800">
              <ShieldCheck className="h-4 w-4 shrink-0" /> Poin dari timer otomatis masuk ke saldo pada Beranda.
            </div>
          </div>
        </div>
      ) : pending ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <div className="card p-5">
            <div className="flex items-center gap-2 text-amber-700">
              <Clock3 className="h-5 w-5" />
              <p className="text-base font-bold">Permohonan sedang diverifikasi</p>
            </div>
            <p className="mt-1 text-[12px] text-slate-500">
              Dikirim {formatDateTimeWib(pending.createdAt)} • nominal {formatRupiah(pending.amount)}
            </p>

            <ol className="mt-4 space-y-3">
              {STATUS_TIMELINE.map((step, index) => {
                const reached = index === 0;
                return (
                  <li key={step.key} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span
                        className={cn(
                          "grid h-7 w-7 place-items-center rounded-full border-2 text-[11px] font-bold",
                          reached
                            ? "border-amber-400 bg-amber-50 text-amber-700"
                            : "border-dashed border-slate-200 text-slate-300",
                        )}
                      >
                        {index + 1}
                      </span>
                      {index < STATUS_TIMELINE.length - 1 ? <span className="my-1 h-8 w-0.5 bg-slate-100" /> : null}
                    </div>
                    <div>
                      <p className={cn("text-[12.5px] font-semibold", reached ? "text-slate-800" : "text-slate-400")}>
                        {step.label}
                      </p>
                      <p className="text-[11px] text-slate-400">{step.desc}</p>
                    </div>
                  </li>
                );
              })}
            </ol>

            {pending.proofUrl ? (
              <button
                type="button"
                onClick={() => setPreview(pending.proofUrl)}
                className="mt-4 flex w-full items-center gap-3 rounded-2xl border border-rose-100 bg-rose-50/50 p-2.5 text-left transition hover:bg-rose-50"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={pending.proofUrl} alt="Bukti pembayaran" className="h-14 w-11 rounded-lg object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-semibold text-slate-800">{pending.proofName}</p>
                  <p className="text-[10.5px] text-slate-500">Bukti pembayaran • klik untuk memperbesar</p>
                </div>
              </button>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-secondary text-[12px]"
                onClick={() => setPreview(proof?.dataUrl ?? pending.proofUrl)}
                disabled={!pending.proofUrl}
              >
                <ImageUp className="h-3.5 w-3.5" /> Lihat bukti
              </button>
              <button
                type="button"
                className="btn text-[12px] text-rose-600 hover:bg-rose-50"
                onClick={() => setCancelTarget(pending)}
              >
                <Ban className="h-3.5 w-3.5" /> Batalkan permohonan
              </button>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="bg-gradient-to-br from-master-600 to-master-800 px-4 py-3 text-white">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-100/80">Nominal QRIS</p>
              <p className="timer-digits text-2xl font-extrabold">{formatRupiah(pending.amount)}</p>
              <p className="text-[11px] text-rose-100/80">
                Biaya akses {formatRupiah(ACCESS_FEE)} + kode unik {pending.uniqueCode}
              </p>
            </div>
            <div className="space-y-3 p-4">
              <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                <Info className="h-3.5 w-3.5" /> Simpan bukti bayar sampai akses diverifikasi admin.
              </div>
              <div className="rounded-xl border border-rose-100 p-2 text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/qris?amount=${pending.amount}`}
                  alt="Kode QRIS pembayaran"
                  className="mx-auto h-44 w-44"
                />
                <p className="text-[10px] text-slate-400">QRIS statis • {QRIS.nmid}</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
          {/* QRIS */}
          <section className="card overflow-hidden">
            <div className="flex items-center justify-between bg-gradient-to-br from-master-600 via-master-700 to-master-900 px-4 py-3 text-white">
              <div className="flex items-center gap-2">
                <QrCode className="h-4 w-4" />
                <p className="text-[12px] font-bold tracking-wide">QRIS • {QRIS.acquirer}</p>
              </div>
              <span className="rounded-full bg-white/15 px-2 py-0.5 text-[9.5px] font-semibold">GPN</span>
            </div>
            <div className="p-4">
              <div className="rounded-2xl border border-rose-100 bg-white p-3 text-center shadow-inner">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/qris?amount=${amount}`} alt="Kode QRIS" className="mx-auto h-52 w-52" />
                <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-slate-400">Scan dengan aplikasi bank</p>
              </div>

              <div className="mt-4 rounded-2xl border border-rose-100 bg-rose-50/50 p-3.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-master-500">Merchant</p>
                <p className="text-[13px] font-bold text-master-950">{QRIS.merchant}</p>
                <p className="text-[10.5px] text-slate-500">
                  NMID {QRIS.nmid} • {QRIS.city}
                </p>

                <div className="mt-3 space-y-1.5 text-[11.5px]">
                  <div className="flex justify-between text-slate-600">
                    <span>Biaya aktivasi akses</span>
                    <span className="font-semibold">{formatRupiah(ACCESS_FEE)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>3 angka unik pembayaran</span>
                    <span className="font-semibold text-master-700">{uniqueCode}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between border-t border-dashed border-rose-200 pt-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-master-700">
                      Total bayar
                    </span>
                    <span className="timer-digits text-lg font-extrabold text-master-900">
                      {formatRupiah(amount)}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setUniqueCode(String(Math.floor(Math.random() * 900) + 100))}
                  className="mt-2 flex items-center gap-1 text-[10.5px] font-semibold text-master-600 hover:underline"
                >
                  <RefreshCw className="h-3 w-3" /> Ganti kode unik
                </button>
              </div>

              <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-[10.5px] leading-relaxed text-amber-800">
                Nominal transfer <span className="font-bold">harus sama</span> hingga 3 angka terakhir, agar sistem
                mengenali pembayaranmu. Contoh: {formatRupiah(amount)}.
              </p>
            </div>
          </section>

          {/* FORM UPLOAD */}
          <section className="card p-5">
            <h2 className="text-base font-bold text-master-950">Konfirmasi & unggah bukti</h2>
            <p className="mt-1 text-[11.5px] text-slate-500">
              Setelah membayar QRIS, unggah screenshot bukti pembayaran. Permohonan akan diverifikasi admin.
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="label" htmlFor="sender">
                  Nama pengirim / pemilik rekening
                </label>
                <input
                  id="sender"
                  className="input"
                  value={senderName}
                  onChange={(event) => setSenderName(event.target.value)}
                  placeholder="Nama sesuai mutasi bank"
                />
              </div>

              <div>
                <label className="label" htmlFor="proof">
                  Bukti pembayaran (wajib)
                </label>
                <input
                  ref={fileRef}
                  id="proof"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => handleFile(event.target.files?.[0])}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    handleFile(event.dataTransfer.files?.[0]);
                  }}
                  className={cn(
                    "flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-6 text-center transition",
                    proof
                      ? "border-emerald-300 bg-emerald-50/40"
                      : "border-rose-200 bg-rose-50/40 hover:border-master-400 hover:bg-rose-50",
                  )}
                >
                  {uploading ? (
                    <Loader2 className="h-6 w-6 animate-spin text-master-500" />
                  ) : proof?.dataUrl ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={proof.dataUrl} alt="Pratinjau bukti" className="h-24 rounded-lg object-contain" />
                      <p className="text-[11.5px] font-semibold text-emerald-700">{proof.name}</p>
                      <p className="text-[10px] text-slate-500">
                        {Math.round(proof.size / 1024)} KB • klik untuk mengganti
                      </p>
                    </>
                  ) : (
                    <>
                      <span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-master-600 shadow-sm">
                        <ImageUp className="h-5 w-5" />
                      </span>
                      <p className="text-[12px] font-semibold text-master-900">Klik atau seret gambar ke sini</p>
                      <p className="text-[10.5px] text-slate-500">JPG / PNG • maksimal 2 MB</p>
                    </>
                  )}
                </button>
              </div>

              <div>
                <label className="label" htmlFor="note">
                  Catatan untuk admin (opsional)
                </label>
                <textarea
                  id="note"
                  className="input min-h-[64px] resize-none"
                  value={note}
                  maxLength={300}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Contoh: pembayaran dari BCA mobile a.n. Kurniawan."
                />
              </div>

              <div className="flex items-center justify-between rounded-2xl bg-master-50/70 px-3 py-2 text-[11.5px]">
                <span className="flex items-center gap-1.5 text-slate-600">
                  <Wallet className="h-3.5 w-3.5 text-master-600" /> Total dibayar
                </span>
                <span className="font-bold text-master-900">{formatRupiah(amount)}</span>
              </div>

              <button type="button" onClick={submit} disabled={submitting || uploading} className="btn-primary w-full">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {submitting ? "Mengirim permohonan..." : "Kirim permohonan akses"}
              </button>
              <p className="text-center text-[10px] text-slate-400">
                Dengan mengirim, kamu menyetujui verifikasi data pembayaran oleh admin Master.
              </p>
            </div>
          </section>
        </div>
      )}

      <section className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-master-950">Riwayat Permohonan Akses</h2>
            <p className="text-[11px] text-slate-500">Semua permohonan beserta hasil verifikasi admin.</p>
          </div>
          {requests.length > 0 ? (
            <span className="text-[11px] text-slate-400">{requests.length} permohonan</span>
          ) : null}
        </div>

        {requests.length === 0 ? (
          <EmptyState
            className="mt-4"
            icon={<QrCode className="h-5 w-5" />}
            title="Belum ada permohonan akses"
            description="Lakukan pembayaran QRIS di atas dan unggah buktinya untuk memulai timer 365 hari."
          />
        ) : (
          <ul className="mt-3 divide-y divide-rose-50">
            {requests.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="text-[12.5px] font-semibold text-slate-800">{formatRupiah(item.amount)}</p>
                    <StatusBadge status={item.status} />
                  </div>
                  <p className="mt-0.5 text-[10.5px] text-slate-400">
                    Kode unik {item.uniqueCode} • diajukan {formatDateTimeWib(item.createdAt)}
                    {item.reviewedAt ? ` • diproses ${formatDateTimeWib(item.reviewedAt)}` : ""}
                  </p>
                  {item.adminNote ? (
                    <p className="mt-1 rounded-lg bg-rose-50/70 px-2 py-1 text-[10.5px] text-master-800">
                      Catatan admin: {item.adminNote}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-1">
                  {item.proofUrl ? (
                    <button
                      type="button"
                      onClick={() => setPreview(item.proofUrl)}
                      className="rounded-lg border border-rose-100 px-2 py-1 text-[10.5px] font-semibold text-master-700 hover:bg-rose-50"
                    >
                      Bukti
                    </button>
                  ) : null}
                  {item.status === "pending" ? (
                    <button
                      type="button"
                      onClick={() => setCancelTarget(item)}
                      className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      aria-label="Batalkan permohonan"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Modal open={Boolean(preview)} onClose={() => setPreview(null)} title="Bukti pembayaran" size="lg">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Bukti pembayaran" className="max-h-[65vh] w-full rounded-2xl object-contain" />
        ) : null}
      </Modal>

      <Modal
        open={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        title="Batalkan permohonan akses?"
        description="Kamu bisa mengajukan permohonan baru kapan saja."
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={() => setCancelTarget(null)}>
              Kembali
            </button>
            <button type="button" className="btn-danger" onClick={doCancel}>
              Ya, batalkan
            </button>
          </>
        }
      >
        <p className="rounded-2xl bg-rose-50 p-3 text-[12px] text-rose-800">
          {cancelTarget ? `Permohonan ${formatRupiah(cancelTarget.amount)} akan dibatalkan.` : ""}
        </p>
      </Modal>

      <Toast message={toast?.message ?? null} tone={toast?.tone} onClose={() => setToast(null)} />
      {!canApply && !isActive && !pending && latest ? (
        <p className="text-center text-[11px] text-slate-400">
          Permohonan terakhir {latest.status}. Silakan ajukan ulang dengan nominal & kode unik baru.
        </p>
      ) : null}
    </div>
  );
}
