"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Camera, Eye, Loader2, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { timeAgo } from "@/lib/wa-utils";
import { useToast } from "@/hooks/use-toast";
import StoryRingAvatar from "@/components/extras/StoryRingAvatar";
import StoryViewer, { type StoryItem, type ViewerGroup } from "@/components/extras/StoryViewer";
import CreateStatusDialog from "@/components/extras/CreateStatusDialog";

type StoryGroup = { contactId: string; name: string; colorKey: string; stories: StoryItem[] };

export default function StatusView() {
  const { toast } = useToast();
  const [data, setData] = useState<{ mine: StoryItem[]; contacts: StoryGroup[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [viewerStart, setViewerStart] = useState<{ group: number; story: number } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/stories", { cache: "no-store" });
      if (!res.ok) throw new Error("gagal memuat");
      const d = await res.json();
      setData({ mine: d.mine ?? [], contacts: d.contacts ?? [] });
    } catch {
      toast({ title: "Gagal memuat status", description: "Periksa koneksi lalu coba lagi.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  // Tombol "+ Tambah" top bar (mobile) — dipindah dari header internal sesuai anotasi
  useEffect(() => {
    const open = () => setCreateOpen(true);
    window.addEventListener("wa:status:add", open);
    return () => window.removeEventListener("wa:status:add", open);
  }, []);

  // Batch 5: tombol muat ulang di top bar (mobile) — paritas dengan desktop
  useEffect(() => {
    const refresh = () => void load();
    window.addEventListener("wa:status:refresh", refresh);
    return () => window.removeEventListener("wa:status:refresh", refresh);
  }, [load]);

  // Grup untuk penampil status: status saya dulu, lalu kontak
  const viewerGroups: ViewerGroup[] = useMemo(() => {
    const g: ViewerGroup[] = [];
    if (data?.mine.length) g.push({ name: "Status Saya", colorKey: "emerald", isMine: true, stories: data.mine });
    for (const c of data?.contacts ?? []) g.push({ name: c.name, colorKey: c.colorKey, stories: c.stories });
    return g;
  }, [data]);

  const myOffset = data?.mine.length ? 1 : 0;
  const totalMyViews = data?.mine.reduce((n, s) => n + s.views, 0) ?? 0;
  const latestMine = data?.mine[data.mine.length - 1];

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header — hanya desktop; di mobile judul ada di top bar AppShell & tombol "+ Tambah" pindah ke pojok kanannya */}
      <header className="hidden md:flex items-center gap-2 px-4 py-3 border-b border-border bg-card shrink-0">
        <h1 className="text-lg font-bold tracking-tight">Status</h1>
        <Button variant="ghost" size="icon" onClick={load} aria-label="Muat ulang status" className="h-9 w-9">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
        <Button size="sm" className="ml-auto" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> Tambah
        </Button>
      </header>

      {/* Konten */}
      <div className="flex-1 overflow-y-auto wa-scrollbar" role="list" aria-label="Daftar status">
        {/* ---- Status Saya ---- */}
        <section aria-labelledby="my-status-label" className="px-3 pt-3">
          <p id="my-status-label" className="px-2 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Status Saya
          </p>
          {loading && !data ? (
            <div className="flex items-center gap-3 p-2">
              <Skeleton className="h-14 w-14 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-44" />
              </div>
            </div>
          ) : data && data.mine.length > 0 ? (
            <button
              onClick={() => setViewerStart({ group: 0, story: 0 })}
              className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-secondary/70 transition-colors text-left"
              aria-label={`Lihat status saya, ${data.mine.length} status, ${totalMyViews} tayangan`}
            >
              <span className="wa-story-ring rounded-full p-[3px] inline-flex shrink-0">
                <span className="h-14 w-14 rounded-full border-2 border-background overflow-hidden flex items-center justify-center bg-maroon-600 text-white">
                  {latestMine?.mediaType === "IMAGE" && latestMine.mediaUrl ? (
                    <img src={latestMine.mediaUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Camera className="h-6 w-6" aria-hidden="true" />
                  )}
                </span>
              </span>
              <span className="min-w-0">
                <span className="block text-[15px] font-semibold leading-tight">Status Saya</span>
                <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                  <Eye className="h-3 w-3" aria-hidden="true" />
                  {totalMyViews} tayangan · {data.mine.length} status aktif
                </span>
              </span>
            </button>
          ) : (
            <button
              onClick={() => setCreateOpen(true)}
              className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-secondary/70 transition-colors text-left"
              aria-label="Ketuk untuk tambah status"
            >
              <span className="relative inline-flex shrink-0">
                <span className="rounded-full bg-muted-foreground/20 p-[3px] inline-flex">
                  <span className="h-14 w-14 rounded-full border-2 border-background bg-muted flex items-center justify-center text-muted-foreground">
                    <Camera className="h-6 w-6" aria-hidden="true" />
                  </span>
                </span>
                <span className="absolute -bottom-0.5 -right-0.5 h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center ring-2 ring-background">
                  <Plus className="h-4 w-4" aria-hidden="true" />
                </span>
              </span>
              <span className="min-w-0">
                <span className="block text-[15px] font-semibold leading-tight">Status Saya</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">Ketuk untuk tambah status</span>
              </span>
            </button>
          )}
        </section>

        {/* ---- Status Kontak ---- */}
        <section aria-labelledby="contact-status-label" className="px-3 pt-4 pb-6">
          <p id="contact-status-label" className="px-2 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Status Kontak
          </p>

          {loading && !data ? (
            <div className="space-y-1">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3 p-2">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              ))}
            </div>
          ) : data && data.contacts.length > 0 ? (
            <div className="space-y-0.5">
              {data.contacts.map((c, idx) => (
                <button
                  key={c.contactId}
                  onClick={() => setViewerStart({ group: myOffset + idx, story: 0 })}
                  className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-secondary/70 transition-colors text-left"
                  aria-label={`Lihat status dari ${c.name}, ${c.stories.length} status`}
                  role="listitem"
                >
                  <StoryRingAvatar name={c.name} colorKey={c.colorKey} size={52} />
                  <span className="min-w-0">
                    <span className="block text-[15px] font-medium leading-tight truncate">{c.name}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {timeAgo(c.stories[c.stories.length - 1].createdAt)}
                      {c.stories.length > 1 ? ` · ${c.stories.length} status` : ""}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="px-2 py-8 text-center">
              <div className="mx-auto h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-3">
                <Camera className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
              </div>
              <p className="text-sm font-medium">Belum ada status kontak</p>
              <p className="text-xs text-muted-foreground mt-1">
                Status dari pelanggan akan muncul di sini dan hilang setelah 24 jam.
              </p>
            </div>
          )}
        </section>
      </div>

      {/* Dialog tambah status */}
      <CreateStatusDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={() => { setCreateOpen(false); load(); }} />

      {/* Penampil status layar penuh */}
      {viewerStart && viewerGroups.length > 0 && viewerStart.group < viewerGroups.length ? (
        <StoryViewer
          key={`${viewerStart.group}-${viewerStart.story}`}
          groups={viewerGroups}
          start={viewerStart}
          onOpenChange={(o) => {
            if (!o) {
              setViewerStart(null);
              load();
            }
          }}
        />
      ) : null}
    </div>
  );
}
