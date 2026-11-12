"use client";

// ===================== DASBOR HYBRID MATRIX SPILLOVER 3 FASE =====================
// Bagian Panel Admin (Task 82) — KHUSUS SUPER_ADMIN & ADMIN. Pengguna biasa
// tidak melihat bagian ini (API juga dijaga requireRole di server).
// Isi: ringkasan, pohon matriks (lazy expand), daftar anggota + progres,
// dan tabel tangga jabatan 36 rung sesuai ketentuan 3 fase.

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronDown, ChevronRight, Network, RefreshCw, Search, Users } from "lucide-react";

interface Rung {
  phase: number;
  level: number;
  required: number;
  jabatan: string;
  holders: number;
}
interface LadderGroup {
  phase: number;
  title: string;
  rungs: Rung[];
}
interface NextRung {
  jabatan: string;
  sisa: number;
  target: number;
}
interface Member {
  id: string;
  userId: string;
  username: string;
  accessId: string;
  role: string;
  jabatan: string;
  phase: number;
  position: string;
  depth: number;
  downlineTotal: number;
  parentUsername?: string | null;
  createdAt: string;
  next: NextRung | null;
}
interface Stats {
  total: number;
  rootUserId: string | null;
  perPhase: { phase: number; count: number }[];
  today: number;
}
interface MatrixData {
  stats: Stats;
  ladder: LadderGroup[];
  members: Member[];
  memberCount: number;
  page: number;
  limit: number;
  recent: { id: string; username: string; accessId: string; jabatan: string; position: string; parentUsername: string | null; createdAt: string }[];
}

type TabId = "ringkasan" | "pohon" | "anggota" | "tangga";

const TABS: { id: TabId; label: string }[] = [
  { id: "ringkasan", label: "Ringkasan" },
  { id: "pohon", label: "Pohon Matriks" },
  { id: "anggota", label: "Anggota" },
  { id: "tangga", label: "Tangga Jabatan" },
];

const PHASE_COLOR: Record<number, string> = {
  1: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  2: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  3: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200",
};

function fmt(n: number): string {
  return new Intl.NumberFormat("id-ID").format(n);
}

export default function MatrixPanel() {
  const [tab, setTab] = useState<TabId>("ringkasan");
  const [data, setData] = useState<MatrixData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [recalculating, setRecalculating] = useState(false);

  const load = useCallback(async (query: string, p: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/matrix?q=${encodeURIComponent(query)}&page=${p}`, { cache: "no-store" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Gagal memuat matriks");
      setData(d as MatrixData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat matriks");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(q, page);
  }, [page]);

  const runSearch = () => {
    setPage(1);
    void load(q, 1);
  };

  const recalculate = async () => {
    setRecalculating(true);
    try {
      const res = await fetch("/api/admin/matrix/recalculate", { method: "POST" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Gagal menghitung ulang");
      await load(q, page);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menghitung ulang");
    } finally {
      setRecalculating(false);
    }
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.memberCount / data.limit)) : 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Network className="h-5 w-5 text-maroon-700 dark:text-maroon-300" aria-hidden="true" />
          <div>
            <h2 className="text-base font-semibold leading-tight">Hybrid Matrix Spillover 3 Fase</h2>
            <p className="text-xs text-muted-foreground">
              Pohon biner KIRI/KANAN · pendaftaran baru otomatis ditempatkan (spillover) · jabatan naik otomatis
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void load(q, page)} disabled={loading}>
            <RefreshCw className={`mr-1 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden="true" /> Muat ulang
          </Button>
          <Button variant="outline" size="sm" onClick={() => void recalculate()} disabled={recalculating}>
            <Users className={`mr-1 h-3.5 w-3.5 ${recalculating ? "animate-pulse" : ""}`} aria-hidden="true" /> Hitung ulang
          </Button>
        </div>
      </div>

      <div role="tablist" aria-label="Bagian matriks" className="flex gap-1 overflow-x-auto rounded-lg bg-muted p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition ${
              tab === t.id ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {loading && !data ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : data ? (
        <>
          {tab === "ringkasan" && <RingkasanTab data={data} />}
          {tab === "pohon" && <PohonTab />}
          {tab === "anggota" && (
            <AnggotaTab
              data={data}
              q={q}
              setQ={setQ}
              onSearch={runSearch}
              page={page}
              totalPages={totalPages}
              setPage={setPage}
            />
          )}
          {tab === "tangga" && <TanggaTab ladder={data.ladder} />}
        </>
      ) : null}
    </div>
  );
}

// ===================== TAB: RINGKASAN =====================

function RingkasanTab({ data }: { data: MatrixData }) {
  const { stats, recent } = data;
  const cards = [
    { label: "Total Anggota", value: fmt(stats.total), hint: "seluruh posisi terisi" },
    { label: "Penempatan Hari Ini", value: fmt(stats.today), hint: "pendaftaran baru (WIB)" },
    { label: "Fase 1 — Training", value: fmt(stats.perPhase.find((p) => p.phase === 1)?.count ?? 0), hint: "Training 1 & 2" },
    { label: "Fase 2 — Magang–Supervisor", value: fmt(stats.perPhase.find((p) => p.phase === 2)?.count ?? 0), hint: "17 level jabatan" },
    { label: "Fase 3 — Manager–President", value: fmt(stats.perPhase.find((p) => p.phase === 3)?.count ?? 0), hint: "17 level jabatan" },
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="p-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{c.label}</p>
              <p className="mt-1 text-xl font-bold tabular-nums">{c.value}</p>
              <p className="text-[11px] text-muted-foreground">{c.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-4">
          <h3 className="mb-3 text-sm font-semibold">Penempatan Terbaru</h3>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada penempatan.</p>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pengguna</TableHead>
                    <TableHead>Posisi</TableHead>
                    <TableHead>Di bawah</TableHead>
                    <TableHead>Jabatan</TableHead>
                    <TableHead className="hidden sm:table-cell">Waktu</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recent.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">
                        {r.username} <span className="text-xs text-muted-foreground">({r.accessId})</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[11px]">{r.position}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.parentUsername ?? "—"}</TableCell>
                      <TableCell className="text-sm">{r.jabatan}</TableCell>
                      <TableCell className="hidden text-xs text-muted-foreground sm:table-cell">
                        {new Date(r.createdAt).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ===================== TAB: POHON MATRIKS =====================

interface TreeRow {
  id: string;
  username: string;
  accessId: string;
  jabatan: string;
  phase: number;
  position: string;
  depth: number;
  downlineTotal: number;
  children: TreeRow[];
}

function PohonTab() {
  const [root, setRoot] = useState<TreeRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/admin/matrix/tree?depth=1", { cache: "no-store" });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || "Gagal memuat pohon");
        if (alive) setRoot(d.root as TreeRow);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Gagal memuat pohon");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (loading) return <Skeleton className="h-48 w-full" />;
  if (error) return <Card><CardContent className="p-4 text-sm text-destructive">{error}</CardContent></Card>;
  if (!root) return <Card><CardContent className="p-4 text-sm text-muted-foreground">Pohon kosong — akar dibuat saat pendaftaran pertama.</CardContent></Card>;
  return <TreeNode node={root} isRoot />;
}

function TreeNode({ node, isRoot = false }: { node: TreeRow; isRoot?: boolean }) {
  const [expanded, setExpanded] = useState(isRoot);
  const [children, setChildren] = useState<TreeRow[]>(node.children);
  const [loadingKids, setLoadingKids] = useState(false);

  const toggle = async () => {
    if (expanded) {
      setExpanded(false);
      return;
    }
    if (children.length === 0 && node.downlineTotal > 0) {
      setLoadingKids(true);
      try {
        const res = await fetch(`/api/admin/matrix/tree?id=${node.id}&depth=1`, { cache: "no-store" });
        const d = await res.json();
        if (res.ok) setChildren((d.root as TreeRow).children ?? []);
      } finally {
        setLoadingKids(false);
      }
    }
    setExpanded(true);
  };

  return (
    <div className={isRoot ? "" : "border-l border-dashed pl-3"}>
      <div className="flex items-center gap-1.5 py-1">
        <button
          onClick={() => void toggle()}
          aria-label={expanded ? "Tutup cabang" : "Buka cabang"}
          className="rounded p-0.5 hover:bg-muted disabled:opacity-40"
          disabled={node.downlineTotal === 0 && children.length === 0}
        >
          {loadingKids ? (
            <RefreshCw className="h-3.5 w-3.5 animate-spin text-muted-foreground" aria-hidden="true" />
          ) : expanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          )}
        </button>
        {!isRoot && (
          <Badge variant="outline" className="px-1 text-[10px]">{node.position}</Badge>
        )}
        <span className="text-sm font-medium">{node.username}</span>
        <span className="hidden text-xs text-muted-foreground sm:inline">({node.accessId})</span>
        <Badge className={`text-[10px] ${PHASE_COLOR[node.phase] ?? ""}`}>{node.jabatan}</Badge>
        <span className="ml-auto text-xs text-muted-foreground">{fmt(node.downlineTotal)} downline</span>
      </div>
      {expanded && (
        <div className="ml-4 space-y-0.5">
          {children.length === 0 ? (
            node.downlineTotal > 0 ? (
              <p className="py-1 text-xs text-muted-foreground">— muat cabang untuk melihat {fmt(node.downlineTotal)} downline —</p>
            ) : (
              <p className="py-1 text-xs text-muted-foreground">— belum ada downline —</p>
            )
          ) : (
            children.map((c) => <TreeNode key={c.id} node={c} />)
          )}
        </div>
      )}
    </div>
  );
}

// ===================== TAB: ANGGOTA =====================

function AnggotaTab({
  data,
  q,
  setQ,
  onSearch,
  page,
  totalPages,
  setPage,
}: {
  data: MatrixData;
  q: string;
  setQ: (v: string) => void;
  onSearch: () => void;
  page: number;
  totalPages: number;
  setPage: (p: number) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSearch()}
            placeholder="Cari username atau ID Akses…"
            className="pl-8"
            aria-label="Cari anggota matriks"
          />
        </div>
        <Button size="sm" onClick={onSearch}>Cari</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="max-h-[28rem] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pengguna</TableHead>
                  <TableHead>Jabatan</TableHead>
                  <TableHead className="hidden sm:table-cell">Posisi</TableHead>
                  <TableHead className="hidden md:table-cell">Kedalaman</TableHead>
                  <TableHead>Downline</TableHead>
                  <TableHead className="hidden lg:table-cell">Menuju</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.members.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                      Tidak ada anggota cocok.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.members.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>
                        <p className="text-sm font-medium">{m.username}</p>
                        <p className="text-xs text-muted-foreground">{m.accessId}</p>
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-[10px] ${PHASE_COLOR[m.phase] ?? ""}`}>
                          F{m.phase} · {m.jabatan}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant="outline" className="text-[10px]">{m.position}</Badge>
                      </TableCell>
                      <TableCell className="hidden tabular-nums md:table-cell">{m.depth}</TableCell>
                      <TableCell className="tabular-nums">{fmt(m.downlineTotal)}</TableCell>
                      <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">
                        {m.next ? `${m.next.jabatan} (kurang ${fmt(m.next.sisa)})` : "Puncak — President Director"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Halaman {data.page} dari {totalPages} · {fmt(data.memberCount)} anggota
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Sebelumnya</Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Berikutnya</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ===================== TAB: TANGGA JABATAN =====================

function TanggaTab({ ladder }: { ladder: LadderGroup[] }) {
  return (
    <div className="space-y-4">
      {ladder.map((group) => (
        <Card key={group.phase}>
          <CardContent className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <Badge className={`text-[10px] ${PHASE_COLOR[group.phase] ?? ""}`}>Fase {group.phase}</Badge>
              <h3 className="text-sm font-semibold">{group.title}</h3>
            </div>
            <div className="max-h-80 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Level</TableHead>
                    <TableHead>Jabatan</TableHead>
                    <TableHead className="text-right">Syarat (Jumlah User)</TableHead>
                    <TableHead className="text-right">Dipegang</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.rungs.map((r) => (
                    <TableRow key={`${r.phase}-${r.level}`}>
                      <TableCell className="tabular-nums">{String(r.level).padStart(2, "0")}</TableCell>
                      <TableCell className="text-sm font-medium">{r.jabatan}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(r.required)}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{fmt(r.holders)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
