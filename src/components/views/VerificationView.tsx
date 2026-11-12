"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BadgeCheck,
  CheckCircle2,
  Clock,
  Headphones,
  History,
  LifeBuoy,
  ListChecks,
  Loader2,
  Lock,
  RefreshCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Ticket,
  Wrench,
  XCircle,
} from "lucide-react";
import { cn, timeAgo, waListTime } from "@/lib/wa-utils";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type VerificationStatus = "NONE" | "PENDING" | "REJECTED" | "VERIFIED";

type Criterion = { key: string; label: string; pass: boolean; detail: string };

type ProfileT = {
  businessName: string;
  ownerName: string;
  category: string;
  logoUrl?: string;
};

type LogRow = {
  id: string;
  status: string; // SUBMITTED | APPROVED | REJECTED
  note: string;
  criteria: string;
  createdAt: string;
};

type VerifDataT = {
  status: VerificationStatus;
  brandProtected: boolean;
  history: LogRow[];
  profile: ProfileT;
};

type ReviewResultT = { status: VerificationStatus; criteria: Criterion[] };

type TicketT = {
  id: string;
  code: string;
  subject: string;
  message: string;
  status: string; // OPEN | CLOSED
  createdAt: string;
};

/** Dialog buat tiket dukungan — tersimpan nyata ke database via /api/tickets. */
function CreateTicketDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (ticket: TicketT) => void;
}) {
  const { toast } = useToast();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [creating, setCreating] = useState(false);

  async function submit() {
    if (creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: subject.trim(), message: message.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ticket) throw new Error(data?.error || "Gagal membuat tiket");
      onCreated(data.ticket as TicketT);
      toast({
        title: `Tiket ${data.ticket.code} dibuat`,
        description: "Tiket tersimpan — tim dukungan merespons dalam kurang dari 1 jam.",
      });
      setSubject("");
      setMessage("");
      onOpenChange(false);
    } catch (e) {
      toast({
        title: "Gagal membuat tiket",
        description: e instanceof Error ? e.message : "Silakan coba lagi.",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setSubject(""); setMessage(""); } onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ticket className="h-5 w-5 text-primary" />
            Buat Tiket Dukungan
          </DialogTitle>
          <DialogDescription>
            Ceritakan masalah Anda — tiket tersimpan dan bisa dipantau statusnya.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="ticket-subject">Subjek</Label>
            <Input
              id="ticket-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={120}
              placeholder="cth. Lencana verifikasi tidak tampil"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ticket-message">Deskripsi masalah</Label>
            <Textarea
              id="ticket-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="Jelaskan masalah sedetail mungkin…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={creating}>
            Batal
          </Button>
          <Button onClick={() => void submit()} disabled={creating || !subject.trim() || !message.trim()}>
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ticket className="h-4 w-4" />}
            Kirim Tiket
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const BENEFITS = [
  {
    icon: BadgeCheck,
    title: "Lencana Verifikasi",
    desc: "Lencana resmi tampil di profil bisnis Anda.",
  },
  {
    icon: ShieldCheck,
    title: "Perlindungan Identitas Merek",
    desc: "Nama & logo bisnis dilindungi dari peniruan.",
  },
  {
    icon: LifeBuoy,
    title: "Dukungan Prioritas",
    desc: "Bantuan lebih cepat dari tim dukungan.",
  },
  {
    icon: Search,
    title: "Visibilitas Pencarian",
    desc: "Profil tampil lebih atas di hasil pencarian.",
  },
];

/** Kartu manfaat verifikasi — terkunci sebelum terverifikasi. */
function BenefitCard({ icon: Icon, title, desc, locked }: { icon: React.ElementType; title: string; desc: string; locked: boolean }) {
  return (
    <Card className={cn("transition-opacity", locked && "opacity-60")}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10" aria-hidden>
            <Icon className={cn("h-5 w-5", locked ? "text-muted-foreground" : "text-primary")} />
            {locked ? (
              <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-100">
                <Lock className="h-2.5 w-2.5 text-amber-600" />
              </span>
            ) : null}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium leading-tight">{title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function parseCriteria(json: string | undefined): Criterion[] | null {
  if (!json) return null;
  try {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) return null;
    const list = parsed.filter(
      (c): c is Criterion =>
        typeof c === "object" && c !== null && typeof (c as Criterion).label === "string" && typeof (c as Criterion).pass === "boolean"
    );
    return list.length > 0 ? list : null;
  } catch {
    return null;
  }
}

function StatusBadge({ status }: { status: VerificationStatus }) {
  if (status === "VERIFIED") {
    return (
      <Badge className="border-0 bg-white text-maroon-700 hover:bg-white">
        <ShieldCheck className="mr-1 h-3 w-3" /> Terverifikasi
      </Badge>
    );
  }
  if (status === "REJECTED") {
    return (
      <Badge className="border-0 bg-red-100 text-red-700 hover:bg-red-100">
        <ShieldAlert className="mr-1 h-3 w-3" /> Verifikasi ditolak
      </Badge>
    );
  }
  if (status === "PENDING") {
    return (
      <Badge className="border-0 bg-amber-100 text-amber-700 hover:bg-amber-100">
        <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" aria-hidden />
        Menunggu tinjauan
      </Badge>
    );
  }
  return <Badge variant="outline">Belum terverifikasi</Badge>;
}

export default function VerificationView() {
  const { toast } = useToast();
  const [data, setData] = useState<VerifDataT | null>(null);
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<ReviewResultT | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [brandLocal, setBrandLocal] = useState(false);
  // Tiket dukungan nyata
  const [tickets, setTickets] = useState<TicketT[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketOpen, setTicketOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/verification", { cache: "no-store" });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error || "Gagal memuat status verifikasi");
      const v = d as VerifDataT;
      setData(v);
      setBrandLocal(Boolean(v.brandProtected));
      // Tampilkan hasil review terakhir dari riwayat (agar tahan reload).
      setResult(null);
      const last = v.history?.[0];
      const lastCriteria = parseCriteria(last?.criteria);
      if (last && lastCriteria && (last.status === "APPROVED" || last.status === "REJECTED")) {
        setResult({
          status: last.status === "APPROVED" ? "VERIFIED" : "REJECTED",
          criteria: lastCriteria,
        });
      }
    } catch (e) {
      toast({
        title: "Gagal memuat status verifikasi",
        description: e instanceof Error ? e.message : "Silakan muat ulang halaman.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const status: VerificationStatus = data?.status ?? "NONE";
  const verified = status === "VERIFIED";

  const loadTickets = useCallback(async () => {
    setTicketsLoading(true);
    try {
      const res = await fetch("/api/tickets", { cache: "no-store" });
      const d = await res.json();
      if (res.ok) setTickets(((d?.tickets ?? []) as TicketT[]).slice(0, 5));
    } catch {
      /* senyap — daftar tiket bersifat pelengkap */
    } finally {
      setTicketsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (verified) void loadTickets();
  }, [verified, loadTickets]);

  const closeTicket = async (t: TicketT) => {
    try {
      const res = await fetch(`/api/tickets/${t.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CLOSED" }),
      });
      const d = await res.json();
      if (!res.ok || !d?.ticket) throw new Error(d?.error || "Gagal memperbarui tiket");
      setTickets((prev) => prev.map((x) => (x.id === t.id ? { ...x, status: "CLOSED" } : x)));
      toast({ title: `Tiket ${t.code} ditandai selesai` });
    } catch (e) {
      toast({
        title: "Gagal memperbarui tiket",
        description: e instanceof Error ? e.message : "Silakan coba lagi.",
        variant: "destructive",
      });
    }
  };

  async function submit() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/verification/submit", { method: "POST", cache: "no-store" });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error || "Gagal mengajukan verifikasi");
      const review = d as { status: VerificationStatus; criteria: Criterion[]; log: LogRow };
      setResult({ status: review.status, criteria: review.criteria });
      setData((prev) =>
        prev
          ? {
              ...prev,
              status: review.status,
              brandProtected: review.status === "VERIFIED" ? true : prev.brandProtected,
              history: [review.log, ...(prev.history ?? [])].slice(0, 10),
            }
          : prev
      );
      if (review.status === "VERIFIED") {
        setBrandLocal(true);
        toast({
          title: "Verifikasi disetujui ✅",
          description: "Semua kriteria terpenuhi. Lencana verifikasi & perlindungan merek kini aktif.",
        });
      } else {
        const failing = review.criteria.filter((c) => !c.pass).map((c) => c.label);
        toast({
          title: `Verifikasi ditolak — lengkapi: ${failing.join(", ")}`,
          description: "Perbaiki data profil bisnis Anda, lalu ajukan ulang.",
          variant: "destructive",
        });
      }
    } catch (e) {
      toast({
        title: "Gagal mengajukan verifikasi",
        description: e instanceof Error ? e.message : "Silakan coba lagi.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleBrand(v: boolean) {
    setBrandLocal(v);
    try {
      const res = await fetch("/api/verification", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ brandProtected: v }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error || "Gagal memperbarui");
      toast({
        title: v ? "Perlindungan merek diaktifkan" : "Perlindungan merek dimatikan",
        description: v
          ? "Akun yang meniru nama atau logo bisnis Anda akan dipantau & dilaporkan."
          : "Anda dapat mengaktifkannya kembali kapan saja.",
      });
    } catch (e) {
      setBrandLocal(!v);
      toast({
        title: "Gagal memperbarui",
        description: e instanceof Error ? e.message : "Silakan coba lagi.",
        variant: "destructive",
      });
    }
  }

  if (loading) {
    return (
      <div className="flex h-full flex-col">
        {/* Header — hanya desktop; di mobile judul sudah ditampilkan top bar AppShell */}
        <header className="hidden h-14 shrink-0 items-center gap-2.5 border-b border-border bg-sidebar px-4 md:flex md:px-6">
          <BadgeCheck className="h-5 w-5 text-primary" aria-hidden />
          <h1 className="text-base font-semibold">Verifikasi Bisnis</h1>
        </header>
        <div className="flex-1 overflow-y-auto wa-scrollbar p-4 md:p-6" aria-busy="true" aria-label="Memuat verifikasi">
          <div className="mx-auto w-full max-w-3xl space-y-4">
            <Skeleton className="h-32 w-full rounded-2xl" />
            <Skeleton className="h-48 w-full rounded-2xl" />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Skeleton className="h-24 rounded-2xl" />
              <Skeleton className="h-24 rounded-2xl" />
              <Skeleton className="h-24 rounded-2xl" />
              <Skeleton className="h-24 rounded-2xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const businessName = data?.profile.businessName ?? "IndiGoo";
  const passCount = result ? result.criteria.filter((c) => c.pass).length : 0;
  const canApply = status === "NONE" || status === "REJECTED";

  return (
    <div className="flex h-full flex-col">
      {/* Header — hanya desktop; di mobile judul sudah ditampilkan top bar AppShell */}
      <header className="hidden h-14 shrink-0 items-center gap-2.5 border-b border-border bg-sidebar px-4 md:flex md:px-6">
        <BadgeCheck className="h-5 w-5 text-primary" aria-hidden />
        <h1 className="text-base font-semibold">Verifikasi Bisnis</h1>
      </header>

      <div className="flex-1 overflow-y-auto wa-scrollbar">
        <div className="mx-auto w-full max-w-3xl space-y-5 p-4 md:p-6">
          {/* Hero status */}
          <section aria-label="Status verifikasi">
            <div
              className={cn(
                "overflow-hidden rounded-2xl border-0",
                verified
                  ? "bg-gradient-to-br from-maroon-500 to-maroon-600 text-white shadow-md"
                  : "border-border bg-card"
              )}
            >
              <div className="flex flex-col items-start gap-4 p-5 sm:flex-row sm:items-center md:p-6">
                <div
                  className={cn(
                    "flex h-16 w-16 shrink-0 items-center justify-center rounded-full",
                    verified
                      ? "bg-white/20"
                      : status === "REJECTED"
                        ? "bg-red-100"
                        : status === "PENDING"
                          ? "bg-amber-100"
                          : "bg-muted"
                  )}
                  aria-hidden
                >
                  {verified ? (
                    <ShieldCheck className="h-9 w-9 text-white" />
                  ) : status === "REJECTED" ? (
                    <ShieldAlert className="h-9 w-9 text-red-600" />
                  ) : status === "PENDING" ? (
                    <Loader2 className="h-9 w-9 animate-spin text-amber-600" />
                  ) : (
                    <BadgeCheck className="h-9 w-9 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className={cn("text-lg font-bold leading-tight", verified && "text-white")}>{businessName}</h2>
                    <StatusBadge status={status} />
                    {data?.brandProtected ? (
                      <Badge
                        aria-label="Perlindungan merek aktif"
                        className={cn(
                          "border-0",
                          verified
                            ? "bg-white/20 text-white hover:bg-white/20"
                            : "bg-maroon-100 text-maroon-700 hover:bg-maroon-100"
                        )}
                      >
                        <ShieldCheck className="mr-1 h-3 w-3" />
                        Perlindungan Merek Aktif
                      </Badge>
                    ) : null}
                  </div>
                  <p className={cn("mt-0.5 text-sm", verified ? "text-white/85" : "text-muted-foreground")}>
                    {data?.profile.category ?? "—"} · {data?.profile.ownerName ?? "—"}
                  </p>
                  {status === "REJECTED" ? (
                    <p className="mt-2 text-xs text-red-600">
                      Pengajuan terakhir ditolak karena ada kriteria yang belum terpenuhi — lihat hasil review di bawah.
                    </p>
                  ) : null}
                </div>
                {canApply ? (
                  <Button onClick={submit} disabled={submitting} className="shrink-0">
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {status === "REJECTED" ? "Ajukan Ulang" : "Ajukan Verifikasi"}
                  </Button>
                ) : null}
              </div>
            </div>
          </section>

          {/* Hasil review nyata (dari submit terakhir) */}
          {result ? (
            <Card>
              <CardContent className="p-4 md:p-5">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <ListChecks className="h-5 w-5 text-primary" aria-hidden />
                  <p className="text-sm font-semibold">Hasil Review</p>
                  <Badge
                    variant="outline"
                    className={cn(
                      "ml-auto",
                      passCount === result.criteria.length
                        ? "border-maroon-200 bg-maroon-50 text-maroon-700"
                        : "border-red-200 bg-red-50 text-red-700"
                    )}
                  >
                    {passCount}/{result.criteria.length} kriteria terpenuhi
                  </Badge>
                </div>
                <ul className="space-y-2.5" aria-label="Detail kriteria verifikasi">
                  {result.criteria.map((c) => (
                    <li key={c.key} className="flex items-start gap-2.5">
                      {c.pass ? (
                        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-maroon-600" aria-hidden />
                      ) : (
                        <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" aria-hidden />
                      )}
                      <div className="min-w-0">
                        <p className={cn("text-sm leading-tight", c.pass ? "font-medium" : "font-medium text-red-700")}>
                          {c.label}
                        </p>
                        <p className="text-xs text-muted-foreground">{c.detail}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          {/* Panel perbaikan saat ditolak */}
          {status === "REJECTED" ? (
            <section
              aria-label="Langkah perbaikan"
              className="rounded-2xl border border-red-200 bg-red-50 p-4 md:p-5 dark:border-red-900 dark:bg-red-950/30"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 dark:bg-red-900/50" aria-hidden>
                  <Wrench className="h-5 w-5 text-red-600 dark:text-red-300" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-red-700 dark:text-red-300">Perbaiki sebelum mengajukan ulang</p>
                  <p className="mt-1 text-xs text-red-600/90 dark:text-red-300/80">
                    Buka menu <strong>Lengkapi Profil Bisnis</strong> (Profil Bisnis di bilah sisi) untuk memperbarui data
                    yang gagal pada daftar di atas, lalu tekan <strong>Ajukan Ulang</strong>.
                  </p>
                  {result ? (
                    <ul className="mt-2 list-inside list-disc text-xs text-red-700 dark:text-red-300">
                      {result.criteria
                        .filter((c) => !c.pass)
                        .map((c) => (
                          <li key={c.key}>{c.label}</li>
                        ))}
                    </ul>
                  ) : null}
                  <Button size="sm" variant="outline" className="mt-3 border-red-300 text-red-700 hover:bg-red-100 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900/40" onClick={submit} disabled={submitting}>
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                    Ajukan Ulang
                  </Button>
                </div>
              </div>
            </section>
          ) : null}

          {/* NONE: ajakan mengajukan */}
          {status === "NONE" ? (
            <div className="rounded-2xl border border-dashed border-border p-5 text-center">
              <p className="text-sm font-medium">Siap membangun kepercayaan pelanggan?</p>
              <p className="mx-auto mb-3 mt-1 max-w-md text-xs text-muted-foreground">
                Saat Anda mengajukan, sistem meninjau profil bisnis Anda secara nyata: nama, kategori, deskripsi, alamat,
                telepon, email, jam operasional, logo, dan minimal satu kanal sosial. Hasil review tampil seketika.
              </p>
              <Button variant="outline" onClick={submit} disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Ajukan Verifikasi
              </Button>
            </div>
          ) : null}

          {/* Riwayat pengajuan */}
          <section aria-label="Riwayat pengajuan" className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Riwayat Pengajuan</p>
            <Card>
              <CardContent className="p-0">
                {!data?.history?.length ? (
                  <div className="flex items-center gap-3 p-4 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4 shrink-0" aria-hidden />
                    Belum ada riwayat pengajuan.
                  </div>
                ) : (
                  <ul className="divide-y divide-border" role="list">
                    {data.history.map((h) => {
                      const approved = h.status === "APPROVED";
                      const rejected = h.status === "REJECTED";
                      const parsed = parseCriteria(h.criteria);
                      const total = parsed?.length ?? 0;
                      const passed = parsed?.filter((c) => c.pass).length ?? 0;
                      return (
                        <li key={h.id} className="flex items-start gap-3 p-4">
                          {approved ? (
                            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-maroon-600" aria-hidden />
                          ) : rejected ? (
                            <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" aria-hidden />
                          ) : (
                            <Clock className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" aria-hidden />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge
                                className={cn(
                                  "border-0",
                                  approved
                                    ? "bg-maroon-100 text-maroon-700 hover:bg-maroon-100"
                                    : rejected
                                      ? "bg-red-100 text-red-700 hover:bg-red-100"
                                      : "bg-amber-100 text-amber-700 hover:bg-amber-100"
                                )}
                              >
                                {approved ? "Disetujui" : rejected ? "Ditolak" : "Terkirim"}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {waListTime(h.createdAt)} · {timeAgo(h.createdAt)}
                              </span>
                              {total > 0 ? (
                                <span className="ml-auto text-xs text-muted-foreground">
                                  {passed}/{total} kriteria lolos
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">{h.note || "—"}</p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          </section>

          {/* Manfaat */}
          <section aria-label="Manfaat verifikasi" className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {verified ? "Manfaat aktif" : "Manfaat setelah terverifikasi"}
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {BENEFITS.map((b) => (
                <BenefitCard key={b.title} icon={b.icon} title={b.title} desc={b.desc} locked={!verified} />
              ))}
            </div>
          </section>

          {/* Setelah terverifikasi */}
          {verified ? (
            <>
              <Separator />
              <section aria-label="Pengaturan setelah verifikasi" className="space-y-4">
                <Card>
                  <CardContent className="flex items-center gap-3 p-4 md:p-5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10" aria-hidden>
                      <ShieldCheck className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">Perlindungan Identitas Merek</p>
                      <p className="text-xs text-muted-foreground">
                        Akun yang meniru nama atau logo bisnis Anda dipantau & dilaporkan.
                      </p>
                    </div>
                    <Switch
                      checked={brandLocal}
                      onCheckedChange={toggleBrand}
                      aria-label="Aktifkan Perlindungan Merek"
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="space-y-3 p-4 md:p-5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10" aria-hidden>
                        <Headphones className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">Dukungan Prioritas</p>
                        <p className="text-xs text-muted-foreground">
                          Tim dukungan siap membantu 24/7 dengan waktu respons lebih cepat.
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0"
                        onClick={() => setTicketOpen(true)}
                      >
                        <Ticket className="h-4 w-4" />
                        Buat Tiket
                      </Button>
                    </div>

                    {ticketsLoading ? (
                      <Skeleton className="h-16 w-full rounded-xl" aria-hidden />
                    ) : tickets.length > 0 ? (
                      <div className="space-y-2 border-t pt-3">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Tiket terakhir
                        </p>
                        <ul className="max-h-44 space-y-2 overflow-y-auto wa-scrollbar" aria-label="Daftar tiket dukungan">
                          {tickets.map((t) => (
                            <li key={t.id} className="flex items-center gap-2 rounded-xl border bg-muted/30 px-3 py-2">
                              <Ticket className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-medium">
                                  {t.code} · {t.subject}
                                </p>
                                <p className="text-[11px] text-muted-foreground">{waListTime(t.createdAt)}</p>
                              </div>
                              {t.status === "OPEN" ? (
                                <>
                                  <Badge variant="outline" className="shrink-0 border-amber-300 text-[10px] text-amber-700">
                                    Terbuka
                                  </Badge>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 shrink-0 text-[11px] text-muted-foreground"
                                    onClick={() => void closeTicket(t)}
                                    aria-label={`Tandai tiket ${t.code} selesai`}
                                  >
                                    Selesai
                                  </Button>
                                </>
                              ) : (
                                <Badge variant="outline" className="shrink-0 border-maroon-300 text-[10px] text-maroon-700">
                                  Selesai
                                </Badge>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>

                <div className="flex items-center gap-3 rounded-2xl bg-maroon-50 p-4 text-sm text-maroon-800 dark:bg-maroon-950/40 dark:text-maroon-300">
                  <Search className="h-5 w-5 shrink-0" aria-hidden />
                  <p>Profil bisnis Anda kini tampil lebih atas di hasil pencarian.</p>
                </div>

                <CreateTicketDialog
                  open={ticketOpen}
                  onOpenChange={setTicketOpen}
                  onCreated={(t) => setTickets((prev) => [t, ...prev].slice(0, 5))}
                />
              </section>
            </>
          ) : null}

          {/* Catatan alur jujur */}
          {!verified ? (
            <p className="flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
              <History className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              Review dijalankan langsung saat pengajuan — tidak ada proses otomatis yang meloloskan tanpa memeriksa data.
              Setiap pengajuan tercatat pada riwayat di atas.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
