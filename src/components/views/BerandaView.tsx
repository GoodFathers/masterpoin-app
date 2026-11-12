"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Heart,
  Share2,
  Play,
  Volume2,
  VolumeX,
  Send,
  Loader2,
  Film,
  MapPin,
  Users,
  UserCheck,
  Pencil,
  Trash2,
  MessageCircle,
  Sparkles,
} from "lucide-react";
import { cn, colorOf, getInitials } from "@/lib/wa-utils";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { canManageVideo } from "@/lib/user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ConfirmDialog } from "@/components/chat/ChatMenus";
import BusinessProfileSheet from "@/components/indigoo/BusinessProfileSheet";
import type { ViewId } from "@/components/AppShell";

type VideoPost = {
  id: string;
  title: string;
  category: string;
  authorName: string;
  authorType: string;
  authorUserId?: string | null;
  videoUrl: string;
  posterUrl: string;
  likes: number;
  views: number;
  isFollower: boolean;
  isFollowing: boolean;
  commentCount?: number; // Task 77: jumlah komentar (dari _count API)
  createdAt: string;
};

// Task 77: komentar video Beranda (GET/POST /api/videos/[id]/comments)
type VideoCommentItem = {
  id: string;
  videoId: string;
  name: string;
  body: string;
  createdAt: string;
};

type TabId = "umum" | "hiburan" | "domisili" | "promo" | "pengikut" | "diikuti";

const TABS: { id: TabId; label: string }[] = [
  { id: "umum", label: "Umum" },
  { id: "hiburan", label: "Hiburan" },
  { id: "domisili", label: "Domisili" },
  { id: "promo", label: "Promo" },
  { id: "pengikut", label: "Pengikut" },
  { id: "diikuti", label: "Diikuti" },
];

const CATEGORY_LABEL: Record<string, string> = {
  hiburan: "Hiburan",
  domisili: "Domisili",
  promo: "Promo",
};

const LIKES_KEY = "wa_video_likes";

// Task 77: warna avatar komentar deterministik dari nama penulis
const COMMENT_COLOR_KEYS = ["emerald", "amber", "purple", "pink", "teal"];
function commentColorKey(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return COMMENT_COLOR_KEYS[h % COMMENT_COLOR_KEYS.length];
}

function readLikes(): Set<string> {
  try {
    const raw = window.localStorage.getItem(LIKES_KEY);
    return new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set<string>();
  }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "baru saja";
  if (m < 60) return `${m} mnt lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} hari lalu`;
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: "Asia/Jakarta" });
}

export default function BerandaView({ onNavigate }: { onNavigate?: (view: ViewId) => void }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [tab, setTab] = useState<TabId>("umum");
  const [videos, setVideos] = useState<VideoPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [muted, setMuted] = useState(true);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<VideoPost | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<VideoPost | null>(null);
  // Task 34: kartu profil bisnis penjual (pengguna lain) — dibuka dari "Lihat penjual".
  const [sellerProfileId, setSellerProfileId] = useState<string | null>(null);
  // Task 77: Poin Menonton — total mP hadiah menonton hari ini + animasi pop +N mP
  const [watchPoints, setWatchPoints] = useState(0);
  const [watchFlash, setWatchFlash] = useState<{ amount: number; ts: number } | null>(null);
  // Task 77: panel komentar video
  const [commentsVideo, setCommentsVideo] = useState<VideoPost | null>(null);
  const watchedRef = useRef<Set<string>>(new Set()); // sekali per video per sesi
  const flashTimerRef = useRef<number | null>(null); // timer sembunyi pop +N mP
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLikedIds(readLikes());
  }, []);

  // Task 77: muat rekap Poin Menonton hari ini (0 bila anonim/belum login)
  useEffect(() => {
    let dead = false;
    fetch("/api/videos/watch-points", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { dayTotal?: number } | null) => {
        if (!dead && d && typeof d.dayTotal === "number") setWatchPoints(d.dayTotal);
      })
      .catch(() => {});
    return () => {
      dead = true;
    };
  }, [user?.id]);

  // Task 77: catat tontonan satu video (sekali per sesi; hadiah diatur server)
  const markWatched = useCallback(async (videoId: string) => {
    if (watchedRef.current.has(videoId)) return;
    watchedRef.current.add(videoId);
    try {
      const res = await fetch(`/api/videos/${videoId}/watch`, { method: "POST" });
      if (!res.ok) return;
      const d = (await res.json()) as { awarded?: number };
      const awarded = d.awarded ?? 0;
      if (awarded > 0) {
        setWatchPoints((p) => p + awarded);
        const ts = Date.now();
        setWatchFlash({ amount: awarded, ts });
        if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
        flashTimerRef.current = window.setTimeout(() => setWatchFlash(null), 1900);
      }
    } catch {
      watchedRef.current.delete(videoId); // gagal jaringan — boleh dicoba lagi
    }
  }, []);

  const load = useCallback(async (t: TabId) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/videos?tab=${t}`, { cache: "no-store" });
      const data = (await res.json()) as { videos?: VideoPost[] };
      setVideos(data.videos ?? []);
    } catch {
      toast({ title: "Gagal memuat video", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load(tab);
  }, [tab, load]);

  // ---------- Autoplay video yang terlihat + catat tontonan (Task 77) ----------
  useEffect(() => {
    const root = feedRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const vid = entry.target.querySelector("video");
          if (!vid) return;
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            vid.play().catch(() => {});
            const videoId = entry.target.getAttribute("data-video-id");
            if (videoId) void markWatched(videoId);
          } else {
            vid.pause();
          }
        });
      },
      { root, threshold: [0, 0.6] }
    );
    const items = root.querySelectorAll("[data-feed-item]");
    items.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [videos, loading, markWatched]);

  const toggleLike = async (v: VideoPost) => {
    const liked = !likedIds.has(v.id);
    const next = new Set(likedIds);
    if (liked) next.add(v.id);
    else next.delete(v.id);
    setLikedIds(next);
    try {
      window.localStorage.setItem(LIKES_KEY, JSON.stringify(Array.from(next)));
    } catch {
      // abaikan
    }
    setVideos((prev) => prev.map((p) => (p.id === v.id ? { ...p, likes: Math.max(0, p.likes + (liked ? 1 : -1)) } : p)));
    try {
      await fetch(`/api/videos/${v.id}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ liked }),
      });
    } catch {
      toast({ title: "Gagal menyimpan suka", variant: "destructive" });
    }
  };

  const shareVideo = async (v: VideoPost) => {
    const url = `${window.location.origin}${v.videoUrl}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: v.title, text: `Tonton "${v.title}" di Beranda`, url });
        return;
      }
      throw new Error("no-share");
    } catch {
      try {
        await navigator.clipboard.writeText(url);
        toast({ title: "Tautan video disalin" });
      } catch {
        toast({ title: "Gagal menyalin tautan", variant: "destructive" });
      }
    }
  };

  // ---------- Kelola video (edit/hapus sesuai peran) ----------
  const deleteVideo = async (v: VideoPost) => {
    try {
      const res = await fetch(`/api/videos/${v.id}`, { method: "DELETE" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Gagal menghapus video");
      setVideos((prev) => prev.filter((p) => p.id !== v.id));
      toast({ title: "Video dihapus dari Beranda" });
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Gagal menghapus video", variant: "destructive" });
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div className="h-full flex flex-col bg-black">
      {/* Tab kategori */}
      <div
        className="shrink-0 bg-black/95 border-b border-white/10 px-2 pt-2 pb-2 flex gap-1.5 overflow-x-auto wa-scrollbar"
        role="tablist"
        aria-label="Kategori video"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "px-3.5 py-1.5 rounded-full text-[13px] whitespace-nowrap transition-colors",
              tab === t.id
                ? "bg-white text-black font-semibold"
                : "bg-white/10 text-white/70 hover:bg-white/20"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Feed vertikal */}
      <div className="flex-1 min-h-0 flex justify-center bg-black">
        <div ref={feedRef} className="w-full md:max-w-[480px] h-full overflow-y-auto snap-y snap-mandatory wa-scrollbar md:border-x md:border-white/10">
          {loading && (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="h-8 w-8 text-white/50 animate-spin" aria-label="Memuat video" />
            </div>
          )}

          {!loading && videos.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center px-8 gap-3">
              <span className="h-16 w-16 rounded-full bg-white/10 flex items-center justify-center">
                <Film className="h-7 w-7 text-white/50" aria-hidden="true" />
              </span>
              <p className="text-white font-medium">Belum ada video di kategori ini</p>
              <p className="text-sm text-white/50 leading-relaxed">
                Video yang dikirim pengguna akan tampil di sini. Jadilah yang pertama mengirim!
              </p>
              <Button onClick={() => setUploadOpen(true)} className="mt-2 bg-white text-black hover:bg-white/90">
                <Send className="h-4 w-4" /> Kirim Video
              </Button>
            </div>
          )}

          {!loading &&
            videos.map((v) => (
              <FeedItem
                key={v.id}
                video={v}
                muted={muted}
                onToggleMute={() => setMuted((m) => !m)}
                liked={likedIds.has(v.id)}
                onLike={() => void toggleLike(v)}
                onShare={() => void shareVideo(v)}
                onAuthorClick={() =>
                  v.authorUserId
                    ? setSellerProfileId(v.authorUserId)
                    : toast({ title: "Profil penjual tidak tersedia", description: "Video ini unggahan demo — penjualnya belum terhubung ke akun IndiGoo." })
                }
                canEdit={canManageVideo(user?.role, v.authorUserId, user?.id)}
                onEdit={() => setEditTarget(v)}
                onDelete={() => setDeleteTarget(v)}
                watchPoints={watchPoints}
                watchFlash={watchFlash}
                onComments={() => setCommentsVideo(v)}
              />
            ))}
        </div>
      </div>

      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onUploaded={(created) => {
          setTab("umum");
          setVideos((prev) => [created, ...prev]);
        }}
      />

      {/* Dialog edit video (Super Admin/Admin/pemilik) */}
      <VideoEditDialog
        open={!!editTarget}
        onOpenChange={(o) => {
          if (!o) setEditTarget(null);
        }}
        video={editTarget}
        onSaved={(updated) => {
          setVideos((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
          toast({ title: "Perubahan video tersimpan" });
        }}
      />

      {/* Konfirmasi hapus video */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => {
          if (!o) setDeleteTarget(null);
        }}
        title="Hapus video ini?"
        description={`"${deleteTarget?.title ?? ""}" akan dihapus permanen dari Beranda.`}
        confirmLabel="Hapus"
        destructive
        onConfirm={() => deleteTarget && void deleteVideo(deleteTarget)}
      />

      {/* Task 34: kartu profil bisnis penjual (akun pengguna lain) */}
      <BusinessProfileSheet
        userId={sellerProfileId}
        open={!!sellerProfileId}
        onOpenChange={(o) => {
          if (!o) setSellerProfileId(null);
        }}
        onBrowseCatalog={() => onNavigate?.("marketplace")}
      />

      {/* Task 77: panel komentar video (pilih video dari feed) */}
      <CommentsSheet
        video={commentsVideo}
        open={!!commentsVideo}
        onOpenChange={(o) => {
          if (!o) setCommentsVideo(null);
        }}
        onCountChange={(videoId, delta) =>
          setVideos((prev) =>
            prev.map((p) =>
              p.id === videoId ? { ...p, commentCount: Math.max(0, (p.commentCount ?? 0) + delta) } : p
            )
          )
        }
      />
    </div>
  );
}

// ---------- Satu item feed ----------
function FeedItem({
  video,
  muted,
  onToggleMute,
  liked,
  onLike,
  onShare,
  onAuthorClick,
  canEdit,
  onEdit,
  onDelete,
  watchPoints,
  watchFlash,
  onComments,
}: {
  video: VideoPost;
  muted: boolean;
  onToggleMute: () => void;
  liked: boolean;
  onLike: () => void;
  onShare: () => void;
  onAuthorClick: () => void;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
  watchPoints: number;
  watchFlash: { amount: number; ts: number } | null;
  onComments: () => void;
}) {
  const vidRef = useRef<HTMLVideoElement>(null);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);

  const togglePlay = () => {
    const vid = vidRef.current;
    if (!vid) return;
    if (vid.paused) {
      vid.play().catch(() => {});
      setPaused(false);
    } else {
      vid.pause();
      setPaused(true);
    }
  };

  const initials = video.authorName.slice(0, 2).toUpperCase();

  return (
    <div data-feed-item data-video-id={video.id} className="relative h-full w-full snap-start snap-always overflow-hidden bg-neutral-950">
      <video
        ref={vidRef}
        src={video.videoUrl}
        poster={video.posterUrl || undefined}
        loop
        muted={muted}
        playsInline
        preload="metadata"
        className="absolute inset-0 h-full w-full object-cover"
        onClick={togglePlay}
        onTimeUpdate={(e) => {
          const el = e.currentTarget;
          setProgress(el.duration ? (el.currentTime / el.duration) * 100 : 0);
        }}
        aria-label={`Video: ${video.title}`}
      />

      {/* Tombol play saat dijeda */}
      {paused && (
        <button
          type="button"
          onClick={togglePlay}
          aria-label="Putar video"
          className="absolute inset-0 flex items-center justify-center"
        >
          <span className="h-16 w-16 rounded-full bg-black/50 flex items-center justify-center backdrop-blur-sm">
            <Play className="h-7 w-7 text-white fill-white" />
          </span>
        </button>
      )}

      {/* Toggle suara */}
      <button
        type="button"
        onClick={onToggleMute}
        aria-label={muted ? "Nyalakan suara" : "Bisukan suara"}
        className="absolute top-3 right-3 h-9 w-9 rounded-full bg-black/45 text-white flex items-center justify-center backdrop-blur-sm hover:bg-black/60 transition-colors z-10"
      >
        {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      </button>

      {/* Task 77: badge Poin Menonton (kiri-atas, sejajar tombol suara) */}
      <div className="absolute top-3 left-3 z-10 flex flex-col items-start">
        <span
          className="h-9 rounded-full bg-black/45 backdrop-blur-sm pl-2.5 pr-3 flex items-center gap-1.5 text-white"
          aria-label={`Poin menonton hari ini: ${watchPoints} mP`}
        >
          <Sparkles className="h-4 w-4 text-amber-300" aria-hidden="true" />
          <span className="text-[11px] font-medium text-white/85">Poin Menonton</span>
          <span className="text-[12px] font-bold text-amber-300 tabular-nums">{watchPoints.toLocaleString("id-ID")}</span>
        </span>
        {watchFlash && (
          <span
            key={watchFlash.ts}
            className="mt-1 ml-1 text-[13px] font-extrabold text-amber-300 drop-shadow animate-mp-pop"
            aria-live="polite"
          >
            +{watchFlash.amount} mP
          </span>
        )}
      </div>

      {/* Aksi kanan */}
      <div className="absolute right-3 bottom-24 flex flex-col items-center gap-3 z-10">
        {/* Task 77: tombol Komentar — di atas Like sesuai anotasi desain */}
        <button
          type="button"
          onClick={onComments}
          aria-label="Buka komentar video"
          className="flex flex-col items-center gap-1 text-white"
        >
          <span className="h-11 w-11 rounded-full bg-black/45 flex items-center justify-center backdrop-blur-sm hover:bg-black/60 transition-colors">
            <MessageCircle className="h-5 w-5" />
          </span>
          <span className="text-[11px] font-semibold">
            {(video.commentCount ?? 0) > 0 ? (video.commentCount ?? 0).toLocaleString("id-ID") : "Komentar"}
          </span>
        </button>
        <button
          type="button"
          onClick={onLike}
          aria-label={liked ? "Batal suka" : "Suka video"}
          aria-pressed={liked}
          className="flex flex-col items-center gap-1 text-white"
        >
          <span className="h-11 w-11 rounded-full bg-black/45 flex items-center justify-center backdrop-blur-sm hover:bg-black/60 transition-colors">
            <Heart className={cn("h-6 w-6", liked && "fill-red-500 text-red-500")} />
          </span>
          <span className="text-[11px] font-semibold">{video.likes.toLocaleString("id-ID")}</span>
        </button>
        <button
          type="button"
          onClick={onShare}
          aria-label="Bagikan video"
          className="flex flex-col items-center gap-1 text-white"
        >
          <span className="h-11 w-11 rounded-full bg-black/45 flex items-center justify-center backdrop-blur-sm hover:bg-black/60 transition-colors">
            <Share2 className="h-5 w-5" />
          </span>
          <span className="text-[11px] font-semibold">Bagikan</span>
        </button>
        {canEdit && (
          <>
            <button
              type="button"
              onClick={onEdit}
              aria-label="Edit video"
              className="flex flex-col items-center gap-1 text-white"
            >
              <span className="h-11 w-11 rounded-full bg-black/45 flex items-center justify-center backdrop-blur-sm hover:bg-black/60 transition-colors">
                <Pencil className="h-5 w-5" />
              </span>
              <span className="text-[11px] font-semibold">Edit</span>
            </button>
            <button
              type="button"
              onClick={onDelete}
              aria-label="Hapus video"
              className="flex flex-col items-center gap-1 text-white"
            >
              <span className="h-11 w-11 rounded-full bg-black/45 flex items-center justify-center backdrop-blur-sm hover:bg-black/60 transition-colors">
                <Trash2 className="h-5 w-5 text-red-400" />
              </span>
              <span className="text-[11px] font-semibold">Hapus</span>
            </button>
          </>
        )}
      </div>

      {/* Info penulis */}
      <div className="absolute left-0 right-16 bottom-0 p-4 pb-6 z-10 text-white">
        <button
          type="button"
          onClick={onAuthorClick}
          className="flex items-center gap-2.5 mb-2 group"
          aria-label={`Lihat penjual ${video.authorName}`}
        >
          <span className="h-9 w-9 rounded-full bg-gradient-to-br from-maroon-400 to-maroon-600 flex items-center justify-center text-[13px] font-bold ring-2 ring-white/60 shrink-0">
            {initials}
          </span>
          <span className="font-semibold text-sm group-hover:underline">{video.authorName}</span>
          {video.isFollowing && <UserCheck className="h-3.5 w-3.5 text-maroon-300" aria-label="Diikuti" />}
          {video.isFollower && <Users className="h-3.5 w-3.5 text-sky-300" aria-label="Pengikut" />}
        </button>
        <p className="text-sm leading-snug drop-shadow line-clamp-2">{video.title}</p>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-[11px] font-semibold bg-white/20 backdrop-blur-sm rounded-full px-2 py-0.5">
            {CATEGORY_LABEL[video.category] ?? video.category}
          </span>
          <span className="text-[11px] text-white/70 flex items-center gap-1">
            <MapPin className="h-3 w-3" /> Yogyakarta
          </span>
          <span className="text-[11px] text-white/50">{timeAgo(video.createdAt)}</span>
        </div>
      </div>

      {/* Progres */}
      <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/15 z-10">
        <div className="h-full bg-white/80 transition-[width] duration-150" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

// ---------- Dialog kirim video ----------
function UploadDialog({
  open,
  onOpenChange,
  onUploaded,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onUploaded: (v: VideoPost) => void;
}) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<TabId>("hiburan");
  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>("");

  const reset = () => {
    setFile(null);
    setTitle("");
    setCategory("hiburan");
    setPreviewUrl("");
  };

  const submit = async () => {
    if (!file || !title.trim()) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", "video");
      const up = await fetch("/api/upload", { method: "POST", body: fd });
      const upData = (await up.json()) as { url?: string; error?: string };
      if (!up.ok || !upData.url) throw new Error(upData.error ?? "Gagal mengunggah video");

      const res = await fetch("/api/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), category, videoUrl: upData.url, authorName: "Saya" }),
      });
      const data = (await res.json()) as { video?: VideoPost; error?: string };
      if (!res.ok || !data.video) throw new Error(data.error ?? "Gagal mengirim video");

      toast({ title: "Video terkirim ke Beranda 🎉" });
      onUploaded(data.video);
      onOpenChange(false);
      reset();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Gagal mengirim video", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!busy) onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Kirim Video ke Beranda</DialogTitle>
          <DialogDescription>Video yang Anda kirim akan tampil di feed Beranda pengguna lain.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="video-file">File video</Label>
            {previewUrl ? (
              <div className="relative rounded-lg overflow-hidden border border-border bg-black">
                <video src={previewUrl} className="w-full max-h-44 object-contain" muted playsInline controls />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={() => { setFile(null); setPreviewUrl(""); }}
                >
                  Ganti
                </Button>
              </div>
            ) : (
              <label
                htmlFor="video-file"
                className="flex flex-col items-center justify-center gap-2 h-32 rounded-lg border-2 border-dashed border-border bg-secondary/40 cursor-pointer hover:bg-secondary/70 transition-colors"
              >
                <Film className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
                <span className="text-sm text-muted-foreground">Ketuk untuk pilih video</span>
                <span className="text-[11px] text-muted-foreground/70">MP4 / WebM · maks 30 MB</span>
              </label>
            )}
            <input
              id="video-file"
              type="file"
              accept="video/*"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setFile(f);
                setPreviewUrl(f ? URL.createObjectURL(f) : "");
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="video-title">Judul</Label>
            <Input
              id="video-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: Promo Bakpia Lebaran"
              maxLength={90}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Kategori</Label>
            <div className="flex gap-1.5" role="radiogroup" aria-label="Kategori video">
              {(["hiburan", "domisili", "promo"] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={category === c}
                  onClick={() => setCategory(c)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-[13px] transition-colors",
                    category === c ? "bg-primary text-primary-foreground font-semibold" : "bg-secondary text-muted-foreground hover:bg-secondary/70"
                  )}
                >
                  {CATEGORY_LABEL[c]}
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Batal
          </Button>
          <Button onClick={() => void submit()} disabled={busy || !file || !title.trim()}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Kirim
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Dialog edit video ----------
function VideoEditDialog({
  open,
  onOpenChange,
  video,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  video: VideoPost | null;
  onSaved: (v: VideoPost) => void;
}) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<TabId>("hiburan");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !video) return;
    setTitle(video.title);
    setCategory((video.category as TabId) ?? "hiburan");
  }, [open, video]);

  const submit = async () => {
    if (!video || !title.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/videos/${video.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), category }),
      });
      const data = (await res.json()) as { video?: VideoPost; error?: string };
      if (!res.ok || !data.video) throw new Error(data.error ?? "Gagal menyimpan perubahan");
      onSaved(data.video);
      onOpenChange(false);
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Gagal menyimpan perubahan", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!busy) onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Video</DialogTitle>
          <DialogDescription>Ubah judul atau kategori video di feed Beranda.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-video-title">Judul</Label>
            <Textarea
              id="edit-video-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Judul video"
              rows={2}
              maxLength={120}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Kategori</Label>
            <div className="flex gap-1.5" role="radiogroup" aria-label="Kategori video">
              {(["hiburan", "domisili", "promo"] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={category === c}
                  onClick={() => setCategory(c)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-[13px] transition-colors",
                    category === c ? "bg-primary text-primary-foreground font-semibold" : "bg-secondary text-muted-foreground hover:bg-secondary/70"
                  )}
                >
                  {CATEGORY_LABEL[c]}
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Batal
          </Button>
          <Button onClick={() => void submit()} disabled={busy || !title.trim()}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Task 77: panel komentar video (bottom sheet) ----------
function CommentsSheet({
  video,
  open,
  onOpenChange,
  onCountChange,
}: {
  video: VideoPost | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCountChange: (videoId: string, delta: number) => void;
}) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [comments, setComments] = useState<VideoCommentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // Muat komentar saat sheet dibuka (dipicu per video)
  useEffect(() => {
    if (!open || !video) return;
    setLoading(true);
    let dead = false;
    fetch(`/api/videos/${video.id}/comments`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("gagal"))))
      .then((d: { comments?: VideoCommentItem[] }) => {
        if (!dead) setComments(d.comments ?? []);
      })
      .catch(() => {
        if (!dead) toast({ title: "Gagal memuat komentar", variant: "destructive" });
      })
      .finally(() => {
        if (!dead) setLoading(false);
      });
    return () => {
      dead = true;
    };
  }, [open, video, toast]);

  // Komentar terbaru selalu terlihat — gulir ke bawah saat daftar berubah
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight });
  }, [comments.length, loading]);

  const submit = async () => {
    if (!video || !text.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/videos/${video.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text.trim() }),
      });
      const d = (await res.json().catch(() => null)) as { comment?: VideoCommentItem; error?: string } | null;
      if (!res.ok || !d?.comment) throw new Error(d?.error ?? "Gagal mengirim komentar");
      setComments((prev) => [...prev, d.comment as VideoCommentItem]);
      onCountChange(video.id, 1);
      setText("");
      // toast "+N mP" muncul otomatis dari MpAwardToaster (respons berbentuk { mp })
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Gagal mengirim komentar", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[72dvh] rounded-t-3xl p-0 gap-0 sm:left-[calc(50%-240px)] sm:right-auto sm:w-[480px]"
      >
        <SheetHeader className="px-4 pt-4 pb-3 border-b border-border shrink-0">
          <SheetTitle className="text-base flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-primary" aria-hidden="true" />
            Komentar
            <span className="text-muted-foreground font-normal">({comments.length})</span>
          </SheetTitle>
          <SheetDescription className="sr-only">Daftar komentar video {video?.title ?? ""}</SheetDescription>
        </SheetHeader>

        {/* Daftar komentar — tinggi maksimum dengan gulir */}
        <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto wa-scrollbar px-4 py-3 space-y-4" aria-live="polite">
          {loading && (
            <div className="py-8 flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Memuat komentar" />
            </div>
          )}
          {!loading && comments.length === 0 && (
            <div className="py-10 text-center">
              <MessageCircle className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" aria-hidden="true" />
              <p className="text-sm font-medium">Belum ada komentar</p>
              <p className="text-xs text-muted-foreground mt-1">Jadilah yang pertama berkomentar!</p>
            </div>
          )}
          {comments.map((c) => (
            <div key={c.id} className="flex items-start gap-2.5">
              <span
                className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0",
                  colorOf(commentColorKey(c.name)).bg
                )}
                aria-hidden="true"
              >
                {getInitials(c.name)}
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold leading-tight">
                  {c.name || "Pengguna"}
                  <span className="ml-2 text-[11px] font-normal text-muted-foreground">{timeAgo(c.createdAt)}</span>
                </p>
                <p className="text-sm leading-snug break-words whitespace-pre-wrap">{c.body}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Kotak tulis komentar */}
        <div className="shrink-0 border-t border-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {user ? (
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              <Input
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, 500))}
                placeholder="Tulis komentar…"
                maxLength={500}
                className="flex-1"
                aria-label="Tulis komentar"
              />
              <Button
                type="submit"
                size="icon"
                disabled={sending || !text.trim()}
                aria-label="Kirim komentar"
                className="h-10 w-10 shrink-0"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
          ) : (
            <p className="text-center text-xs text-muted-foreground">
              Masuk untuk ikut berkomentar dan mendapatkan poin mP.
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
