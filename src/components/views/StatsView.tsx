"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CheckCheck,
  CircleX,
  Inbox,
  Loader2,
  MessageSquareText,
  RefreshCw,
  Send,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

type DailyStat = { date: string; sent: number; delivered: number; read: number; received: number; failed: number };
type StatsData = {
  totals: { sent: number; delivered: number; read: number; received: number; failed: number };
  daily: DailyStat[];
  byType: Record<string, number>;
  topChats: { name: string; count: number }[];
};

const nf = new Intl.NumberFormat("id-ID");
const fmt = (v: number | string) => nf.format(Number(v));

const TYPE_LABEL: Record<string, string> = {
  TEXT: "Teks",
  IMAGE: "Foto",
  VIDEO: "Video",
  AUDIO: "Suara",
  DOC: "Dokumen",
  LOCATION: "Lokasi",
  CONTACT_CARD: "Kartu Kontak",
  PRODUCT: "Produk",
  SYSTEM: "Sistem",
};

const BAR_COLORS = ["#a83a4c", "#742431", "#f59e0b", "#f97316", "#ec4899", "#8b5cf6", "#e7a5b0", "#06b6d4", "#94a3b8"];

export default function StatsView() {
  const { toast } = useToast();
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/stats", { cache: "no-store" });
      if (!res.ok) throw new Error("gagal memuat");
      setData(await res.json());
    } catch {
      toast({ title: "Gagal memuat statistik", description: "Coba lagi sebentar.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  // Tombol refresh di pojok kanan top bar AppShell (mobile) memicu event ini
  useEffect(() => {
    const onRefresh = () => {
      void load();
    };
    window.addEventListener("wa:stats:refresh", onRefresh);
    return () => window.removeEventListener("wa:stats:refresh", onRefresh);
  }, [load]);

  const dailyChart =
    data?.daily.map((d) => ({
      // Kunci tanggal harian adalah kalender WIB — parse sebagai tengah hari
      // WIB dan tampilkan kembali dalam WIB agar label tidak geser sehari
      // di perangkat dengan zona waktu selain Jakarta (Batch 4).
      label: new Date(d.date + "T00:00:00+07:00").toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        timeZone: "Asia/Jakarta",
      }),
      Terkirim: d.sent,
      Terdistribusi: d.delivered,
      Dibaca: d.read,
    })) ?? [];

  const byTypeChart =
    Object.entries(data?.byType ?? {})
      .map(([type, count]) => ({ type: TYPE_LABEL[type] ?? type, count }))
      .sort((a, b) => b.count - a.count) ?? [];

  const maxTop = data?.topChats[0]?.count ?? 1;
  const totalAll = data ? data.totals.sent + data.totals.received : 0;

  const SUMMARY = [
    { label: "Terkirim", value: data?.totals.sent ?? 0, color: "text-maroon-600", bg: "bg-maroon-100", Icon: Send },
    { label: "Diterima", value: data?.totals.received ?? 0, color: "text-maroon-600", bg: "bg-maroon-100", Icon: Inbox },
    { label: "Dibaca", value: data?.totals.read ?? 0, color: "text-sky-600", bg: "bg-sky-100", Icon: CheckCheck },
    { label: "Gagal", value: data?.totals.failed ?? 0, color: "text-red-600", bg: "bg-red-100", Icon: CircleX },
    { label: "Total Pesan", value: totalAll, color: "text-primary", bg: "bg-primary/10", Icon: MessageSquareText },
  ];

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header internal hanya desktop — di mobile judul tampil di top bar AppShell
          & tombol refresh pindah ke pojok kanan atas (event wa:stats:refresh) */}
      <header className="hidden md:flex items-center gap-2 px-4 py-3 border-b border-border bg-card shrink-0">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Statistik Pesan</h1>
          <p className="text-xs text-muted-foreground">Ringkasan aktivitas pesan 14 hari terakhir</p>
        </div>
        <Button variant="ghost" size="icon" onClick={load} aria-label="Muat ulang statistik" className="ml-auto h-9 w-9">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </header>

      {/* Konten */}
      <div className="flex-1 overflow-y-auto wa-scrollbar p-4 space-y-4">
        {/* Kartu ringkasan */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3" role="list" aria-label="Ringkasan pesan">
          {SUMMARY.map((s) => (
            <Card key={s.label} className="py-0 gap-0" role="listitem">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <span className={`h-8 w-8 rounded-lg flex items-center justify-center ${s.bg}`} aria-hidden="true">
                    <s.Icon className={`h-4 w-4 ${s.color}`} />
                  </span>
                  <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
                </div>
                {loading && !data ? (
                  <Skeleton className="h-8 w-20 mt-2" />
                ) : (
                  <p className={`mt-2 text-2xl font-bold tabular-nums ${s.color}`}>{fmt(s.value)}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Grafik area harian */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" aria-hidden="true" /> Tren Pesan Harian
            </CardTitle>
            <CardDescription>Pesan terkirim, terdistribusi, dan dibaca per hari</CardDescription>
          </CardHeader>
          <CardContent>
            {loading && !data ? (
              <Skeleton className="h-72 w-full rounded-xl" />
            ) : (
              <div className="h-72 w-full" role="img" aria-label="Grafik tren pesan harian 14 hari terakhir">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailyChart} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gSent" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#a83a4c" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#a83a4c" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gDelivered" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#742431" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#742431" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gRead" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => fmt(Number(v))} />
                    <Tooltip
                      formatter={(v) => fmt(Number(v))}
                      labelFormatter={(l) => String(l)}
                      contentStyle={{ borderRadius: 12, borderColor: "var(--border)", fontSize: 12 }}
                    />
                    <Area type="monotone" dataKey="Terkirim" stroke="#a83a4c" strokeWidth={2} fill="url(#gSent)" />
                    <Area type="monotone" dataKey="Terdistribusi" stroke="#742431" strokeWidth={2} fill="url(#gDelivered)" />
                    <Area type="monotone" dataKey="Dibaca" stroke="#0ea5e9" strokeWidth={2} fill="url(#gRead)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid lg:grid-cols-2 gap-4">
          {/* Jenis pesan */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Jenis Pesan</CardTitle>
              <CardDescription>Jumlah pesan berdasarkan tipe di semua chat</CardDescription>
            </CardHeader>
            <CardContent>
              {loading && !data ? (
                <Skeleton className="h-64 w-full rounded-xl" />
              ) : byTypeChart.length === 0 ? (
                <p className="h-64 flex items-center justify-center text-sm text-muted-foreground">Belum ada data pesan.</p>
              ) : (
                <div className="h-64 w-full" role="img" aria-label="Grafik jumlah pesan per jenis">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={byTypeChart} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="type" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval={0} angle={-24} textAnchor="end" height={54} />
                      <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => fmt(Number(v))} allowDecimals={false} />
                      <Tooltip
                        formatter={(v) => [fmt(Number(v)), "Pesan"]}
                        contentStyle={{ borderRadius: 12, borderColor: "var(--border)", fontSize: 12 }}
                      />
                      <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={44}>
                        {byTypeChart.map((_, i) => (
                          <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Chat teratas */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Chat Teratas</CardTitle>
              <CardDescription>5 chat paling aktif berdasarkan jumlah pesan</CardDescription>
            </CardHeader>
            <CardContent>
              {loading && !data ? (
                <div className="space-y-4 py-2">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-2 w-full rounded-full" />
                    </div>
                  ))}
                </div>
              ) : data && data.topChats.length > 0 ? (
                <ol className="space-y-4 py-1" aria-label="Daftar chat teratas">
                  {data.topChats.map((c, i) => (
                    <li key={`${c.name}-${i}`}>
                      <div className="flex items-center justify-between gap-3 mb-1.5">
                        <span className="flex items-center gap-2 min-w-0">
                          <span className="h-6 w-6 shrink-0 rounded-full bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center" aria-hidden="true">
                            {i + 1}
                          </span>
                          <span className="text-sm font-medium truncate">{c.name}</span>
                        </span>
                        <span className="text-xs font-semibold tabular-nums text-muted-foreground shrink-0">{fmt(c.count)} pesan</span>
                      </div>
                      <Progress
                        value={maxTop > 0 ? (c.count / maxTop) * 100 : 0}
                        aria-label={`${c.name}: ${c.count} pesan`}
                        className="h-2"
                      />
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">Belum ada chat.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
