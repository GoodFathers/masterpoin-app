"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Eye, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn, colorOf, getInitials, timeAgo } from "@/lib/wa-utils";

export type StoryItem = {
  id: string;
  mediaType: string;
  body: string;
  mediaUrl?: string | null;
  bgColor: string;
  views: number;
  createdAt: string;
  expiresAt: string;
};

export type ViewerGroup = {
  name: string;
  colorKey?: string | null;
  isMine?: boolean;
  stories: StoryItem[];
};

const DURATION = 5000; // 5 detik per status

const TEXT_BG: Record<string, string> = {
  emerald: "bg-maroon-600",
  amber: "bg-amber-500",
  purple: "bg-purple-600",
  pink: "bg-pink-600",
  teal: "bg-maroon-800",
};

export default function StoryViewer({
  groups,
  start,
  onOpenChange,
}: {
  groups: ViewerGroup[];
  start: { group: number; story: number };
  onOpenChange: (open: boolean) => void;
}) {
  const [gi, setGi] = useState(start.group);
  const [si, setSi] = useState(start.story);
  const [progress, setProgress] = useState(0);
  const [viewed, setViewed] = useState<Set<string>>(new Set());

  const group = groups[gi];
  const story = group?.stories[si];

  const next = useCallback(() => {
    const g = groups[gi];
    if (!g) {
      onOpenChange(false);
      return;
    }
    setProgress(0);
    if (si + 1 < g.stories.length) {
      setSi(si + 1);
    } else if (gi + 1 < groups.length) {
      setGi(gi + 1);
      setSi(0);
    } else {
      onOpenChange(false);
    }
  }, [groups, gi, si, onOpenChange]);

  const prev = useCallback(() => {
    setProgress(0);
    if (si > 0) {
      setSi(si - 1);
    } else if (gi > 0) {
      setGi(gi - 1);
      setSi(groups[gi - 1].stories.length - 1);
    }
  }, [groups, gi, si]);

  const markViewed = useCallback((id: string) => {
    setViewed((s) => {
      if (s.has(id)) return s;
      const n = new Set(s);
      n.add(id);
      return n;
    });
  }, []);

  // Auto-advance + progress bar + hitung tayangan (interval = timer eksternal)
  useEffect(() => {
    if (!group || !story) return;
    const t0 = Date.now();
    const isContactStory = !group.isMine;
    let posted = false;
    const iv = setInterval(() => {
      setProgress(Math.min(100, ((Date.now() - t0) / DURATION) * 100));
      if (isContactStory && !posted) {
        posted = true;
        markViewed(story.id);
        fetch(`/api/stories/${story.id}/view`, { method: "POST", cache: "no-store" }).catch(() => {});
      }
    }, 50);
    const to = setTimeout(next, DURATION);
    return () => {
      clearInterval(iv);
      clearTimeout(to);
    };
  }, [gi, si, group, story, next, markViewed]);

  // Navigasi keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  const displayViews = story ? story.views + (!group?.isMine && viewed.has(story.id) ? 1 : 0) : 0;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-none w-screen h-screen rounded-none p-0 bg-black border-none text-white overflow-hidden gap-0 sm:max-w-[430px] sm:h-[92dvh] sm:rounded-3xl [&>button]:hidden"
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">Melihat status</DialogTitle>
        {group && story ? (
          <div className="relative w-full h-full flex flex-col select-none">
            {/* Progress bars */}
            <div className="absolute top-3 left-3 right-3 z-30 flex gap-1">
              {group.stories.map((s, i) => (
                <div key={s.id} className="h-1 flex-1 rounded-full bg-white/25 overflow-hidden">
                  <div
                    className="h-full bg-white rounded-full transition-[width] duration-100 ease-linear"
                    style={{ width: `${i < si ? 100 : i === si ? progress : 0}%` }}
                  />
                </div>
              ))}
            </div>

            {/* Header */}
            <div className="absolute top-7 left-3 right-3 z-30 flex items-center gap-2.5">
              <span
                className={cn(
                  "h-9 w-9 rounded-full flex items-center justify-center text-white text-xs font-semibold ring-2 ring-white/70 shrink-0",
                  colorOf(group.colorKey).bg
                )}
                aria-hidden="true"
              >
                {getInitials(group.name)}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium leading-tight truncate">{group.isMine ? "Status Saya" : group.name}</p>
                <p className="text-[11px] text-white/70 leading-tight">{timeAgo(story.createdAt)}</p>
              </div>
              <button
                onClick={() => onOpenChange(false)}
                className="ml-auto h-9 w-9 rounded-full flex items-center justify-center hover:bg-white/15 transition-colors"
                aria-label="Tutup status"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Konten */}
            {story.mediaType === "IMAGE" && story.mediaUrl ? (
              <div className="flex-1 min-h-0 flex items-center justify-center bg-black">
                <img
                  src={story.mediaUrl}
                  alt={story.body || "Status foto"}
                  className="max-h-full max-w-full object-contain"
                  draggable={false}
                />
              </div>
            ) : (
              <div
                className={cn(
                  "flex-1 min-h-0 flex items-center justify-center px-8 text-center",
                  TEXT_BG[story.bgColor] ?? "bg-maroon-600"
                )}
              >
                <p className="text-white text-2xl sm:text-3xl font-medium leading-snug whitespace-pre-wrap break-words">
                  {story.body}
                </p>
              </div>
            )}

            {/* Zona klik kiri / kanan */}
            <button
              type="button"
              onClick={prev}
              aria-label="Status sebelumnya"
              className="absolute left-0 top-16 bottom-16 w-1/3 z-10"
            />
            <button
              type="button"
              onClick={next}
              aria-label="Status berikutnya"
              className="absolute right-0 top-16 bottom-16 w-2/3 z-10"
            />

            {/* Panah navigasi (desktop) */}
            <button
              type="button"
              onClick={prev}
              aria-label="Sebelumnya"
              className="hidden sm:flex absolute left-2 top-1/2 -translate-y-1/2 z-20 h-9 w-9 rounded-full bg-white/10 hover:bg-white/25 items-center justify-center transition-colors"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="Berikutnya"
              className="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 z-20 h-9 w-9 rounded-full bg-white/10 hover:bg-white/25 items-center justify-center transition-colors"
            >
              <ChevronRight className="h-5 w-5" />
            </button>

            {/* Caption untuk status foto */}
            {story.mediaType === "IMAGE" && story.body ? (
              <div className="absolute bottom-12 left-4 right-4 z-20 text-center pointer-events-none">
                <p className="inline-block max-w-full bg-black/55 backdrop-blur-sm text-white/95 text-sm px-4 py-2 rounded-2xl whitespace-pre-wrap break-words">
                  {story.body}
                </p>
              </div>
            ) : null}

            {/* Jumlah tayangan */}
            <div className="absolute bottom-3 left-4 right-4 z-20 flex items-center gap-1.5 text-white/80">
              <Eye className="h-4 w-4" aria-hidden="true" />
              <span className="text-xs">
                {displayViews} tayangan{group.isMine ? "" : " oleh Anda"}
              </span>
            </div>
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/60 text-sm">
            Status tidak tersedia.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
