"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  BadgeCheck,
  Camera,
  ChevronDown,
  Compass,
  Eye,
  Heart,
  ImagePlus,
  Loader2,
  Megaphone,
  MoreVertical,
  Plus,
  Radio,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { cn, colorOf, getInitials, timeAgo } from "@/lib/wa-utils";
import { uploadImage } from "@/lib/upload";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ChannelPostCard, { type ChannelPostT } from "@/components/social/ChannelPostCard";
import ChannelComposer from "@/components/social/ChannelComposer";
import CreateChannelDialog, { type ChannelT } from "@/components/social/CreateChannelDialog";

function fmtCount(n: number): string {
  try {
    return new Intl.NumberFormat("id-ID", { notation: "compact", maximumFractionDigits: 1 }).format(n);
  } catch {
    return String(n);
  }
}

function ChannelAvatar({
  name,
  colorKey,
  imageUrl,
  size = "h-11 w-11",
}: {
  name: string;
  colorKey: string;
  imageUrl?: string | null;
  size?: string;
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold text-white",
        size,
        !imageUrl && colorOf(colorKey).bg
      )}
      aria-hidden
    >
      {imageUrl ? <img src={imageUrl} alt="" className="h-full w-full object-cover" /> : getInitials(name)}
    </div>
  );
}

function SectionTitle({ id, icon: Icon, children }: { id: string; icon?: LucideIcon; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
    >
      {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden /> : null}
      {children}
    </h2>
  );
}

/** Kartu "Channel Saya": hero (latar bisa diganti) + identitas (foto profil bisa diganti) + statistik + komposer + unggahan. */
function MyChannelCard({
  channel,
  onPosted,
  onToggleLike,
  onDeletePost,
  onRequestDeleteChannel,
  onChannelPatched,
}: {
  channel: ChannelT;
  onPosted: (post: ChannelPostT) => void;
  onToggleLike: (post: ChannelPostT) => void;
  onDeletePost: (post: ChannelPostT) => void;
  onRequestDeleteChannel: (channel: ChannelT) => void;
  onChannelPatched: (channel: ChannelT) => void;
}) {
  const { toast } = useToast();
  const postsCount = channel._count?.posts ?? channel.posts.length;
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<"avatar" | "cover" | null>(null);

  /** PATCH foto profil / latar belakang channel (Task 45). */
  async function patchChannel(patch: { imageUrl?: string; coverUrl?: string }) {
    try {
      const res = await fetch(`/api/channels/${channel.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok || !data?.channel) throw new Error(data?.error || "Gagal memperbarui channel");
      onChannelPatched(data.channel as ChannelT);
      return true;
    } catch (e) {
      toast({
        title: "Gagal memperbarui channel",
        description: e instanceof Error ? e.message : "Silakan coba lagi.",
        variant: "destructive",
      });
      return false;
    }
  }

  /** Pilih gambar → unggah ke /api/upload → simpan sebagai foto profil / latar channel. */
  async function handleFile(kind: "avatar" | "cover", file: File | null | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "File harus berupa gambar", variant: "destructive" });
      return;
    }
    setUploading(kind);
    try {
      const url = await uploadImage(file, kind === "avatar" ? "channel-avatar" : "channel-cover");
      const saved = await patchChannel(kind === "avatar" ? { imageUrl: url } : { coverUrl: url });
      if (saved) {
        toast({
          title: kind === "avatar" ? "Foto profil diperbarui" : "Latar belakang diperbarui",
          description:
            kind === "avatar"
              ? "Foto profil channel berhasil diganti."
              : "Latar belakang channel berhasil diganti.",
        });
      }
    } catch (e) {
      toast({
        title: "Gagal mengunggah gambar",
        description: e instanceof Error ? e.message : "Coba pilih gambar lain.",
        variant: "destructive",
      });
    } finally {
      setUploading(null);
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      {/* Hero: latar (foto/gradasi) + badge + menu kelola + tombol kamera latar */}
      <div className="relative h-24 overflow-hidden md:h-28">
        {channel.coverUrl ? (
          <>
            <img
              src={channel.coverUrl}
              alt={`Latar channel ${channel.name}`}
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/25 to-black/35" aria-hidden />
          </>
        ) : (
          <>
            <div className="absolute inset-0 bg-gradient-to-br from-maroon-600 via-maroon-500 to-maroon-600" aria-hidden />
            <div className="absolute -right-8 -top-12 h-32 w-32 rounded-full bg-white/10" aria-hidden />
            <div className="absolute right-14 top-4 h-12 w-12 rounded-full bg-white/10" aria-hidden />
            <div className="absolute -left-6 bottom-0 h-16 w-16 rounded-full bg-black/5" aria-hidden />
          </>
        )}
        <div className="absolute left-4 top-3 z-10">
          <Badge className="border-0 bg-white/20 text-white backdrop-blur-sm">Channel Saya</Badge>
        </div>
        <div className="absolute right-2.5 top-2.5 z-10">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white hover:bg-white/15 hover:text-white"
                aria-label={`Menu channel ${channel.name}`}
              >
                <MoreVertical className="h-4 w-4" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem className="gap-2" onSelect={() => avatarInputRef.current?.click()}>
                <Camera className="h-4 w-4" aria-hidden />
                Ganti Foto Profil
              </DropdownMenuItem>
              {channel.imageUrl ? (
                <DropdownMenuItem className="gap-2" onSelect={() => void patchChannel({ imageUrl: "" })}>
                  <Trash2 className="h-4 w-4" aria-hidden />
                  Hapus Foto Profil
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem className="gap-2" onSelect={() => coverInputRef.current?.click()}>
                <ImagePlus className="h-4 w-4" aria-hidden />
                Ganti Latar Belakang
              </DropdownMenuItem>
              {channel.coverUrl ? (
                <DropdownMenuItem className="gap-2" onSelect={() => void patchChannel({ coverUrl: "" })}>
                  <Trash2 className="h-4 w-4" aria-hidden />
                  Hapus Latar Belakang
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="gap-2 text-destructive focus:text-destructive"
                onSelect={() => onRequestDeleteChannel(channel)}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
                Hapus Channel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {/* Tombol kamera: ganti latar belakang */}
        <button
          type="button"
          onClick={() => coverInputRef.current?.click()}
          title="Ubah latar belakang"
          aria-label="Ubah latar belakang channel"
          disabled={uploading !== null}
          className="absolute bottom-2.5 right-2.5 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-colors hover:bg-black/65 disabled:opacity-60"
        >
          {uploading === "cover" ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Camera className="h-4 w-4" aria-hidden />
          )}
        </button>
      </div>

      {/* Identitas: avatar overlap (foto bisa diganti) + nama + handle + deskripsi + statistik */}
      <div className="px-4 pb-4 md:px-5">
        <div className="relative z-10 -mt-9 mb-2.5 flex items-end">
          <div className="relative h-[4.5rem] w-[4.5rem]">
            <div
              className={cn(
                "h-full w-full overflow-hidden rounded-full shadow-[0_0_0_4px_var(--card)]",
                !channel.imageUrl &&
                  cn("flex items-center justify-center text-xl font-bold text-white", colorOf(channel.colorKey).bg)
              )}
            >
              {channel.imageUrl ? (
                <img
                  src={channel.imageUrl}
                  alt={`Foto profil channel ${channel.name}`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span aria-hidden>{getInitials(channel.name)}</span>
              )}
            </div>
            {/* Tombol kamera: ganti foto profil */}
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              title="Ubah foto profil channel"
              aria-label="Ubah foto profil channel"
              disabled={uploading !== null}
              className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md ring-2 ring-card transition-transform hover:scale-105 disabled:opacity-60"
            >
              {uploading === "avatar" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <Camera className="h-3.5 w-3.5" aria-hidden />
              )}
            </button>
          </div>
        </div>
        <p className="flex items-center gap-1 text-base font-semibold leading-tight">
          <span className="truncate">{channel.name}</span>
          {channel.verified ? (
            <BadgeCheck className="h-4 w-4 shrink-0 text-sky-500" aria-label="Channel terverifikasi" />
          ) : null}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">@{channel.handle}</p>
        {channel.description ? (
          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{channel.description}</p>
        ) : null}
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <div className="rounded-xl border border-border bg-secondary/40 px-3 py-2">
            <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <Users className="h-3.5 w-3.5" aria-hidden /> Pengikut
            </p>
            <p className="mt-0.5 text-sm font-semibold tabular-nums">{fmtCount(channel.followers)}</p>
          </div>
          <div className="rounded-xl border border-border bg-secondary/40 px-3 py-2">
            <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <Megaphone className="h-3.5 w-3.5" aria-hidden /> Unggahan
            </p>
            <p className="mt-0.5 text-sm font-semibold tabular-nums">{postsCount}</p>
          </div>
        </div>
      </div>

      <Separator />
      <div className="p-4">
        <ChannelComposer channelId={channel.id} channelName={channel.name} onPosted={onPosted} />
      </div>
      {channel.posts.length > 0 ? (
        <>
          <Separator />
          <div className="max-h-96 divide-y divide-border overflow-y-auto wa-scrollbar">
            {channel.posts.map((p) => (
              <ChannelPostCard key={p.id} post={p} onToggleLike={onToggleLike} onDelete={onDeletePost} />
            ))}
          </div>
        </>
      ) : (
        <div className="p-4 text-center text-xs text-muted-foreground">
          Belum ada unggahan. Sapa pengikut Anda dengan unggahan pertama! 👋
        </div>
      )}

      {/* Input berkas tersembunyi: foto profil & latar channel */}
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/*"
        data-upload="channel-avatar"
        className="hidden"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          void handleFile("avatar", e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        ref={coverInputRef}
        type="file"
        accept="image/*"
        data-upload="channel-cover"
        className="hidden"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          void handleFile("cover", e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}

/** Baris channel yang diikuti — bisa dikembangkan untuk melihat umpan unggahan. */
function FollowedChannelRow({
  channel,
  expanded,
  onToggleExpand,
  onToggleLike,
}: {
  channel: ChannelT;
  expanded: boolean;
  onToggleExpand: () => void;
  onToggleLike: (post: ChannelPostT) => void;
}) {
  const latest = channel.posts[0];
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-border bg-card transition-colors",
        !expanded && "hover:border-primary/30"
      )}
    >
      <button
        type="button"
        onClick={onToggleExpand}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-secondary/60"
      >
        <ChannelAvatar name={channel.name} colorKey={channel.colorKey} imageUrl={channel.imageUrl} size="h-12 w-12" />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 text-sm font-semibold">
            <span className="truncate">{channel.name}</span>
            {channel.verified ? (
              <BadgeCheck className="h-4 w-4 shrink-0 text-sky-500" aria-label="Channel terverifikasi" />
            ) : null}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {latest ? latest.body || "📷 Foto" : channel.description || "Belum ada unggahan"}
          </p>
          {latest && (latest.likes > 0 || latest.views > 0) ? (
            <p className="mt-0.5 flex items-center gap-3 text-[11px] text-muted-foreground/80">
              <span className="flex items-center gap-1" aria-label={`${latest.likes} suka`}>
                <Heart className="h-3 w-3" aria-hidden />
                <span className="tabular-nums">{latest.likes}</span>
              </span>
              <span className="flex items-center gap-1" aria-label={`${latest.views} dilihat`}>
                <Eye className="h-3 w-3" aria-hidden />
                <span className="tabular-nums">{latest.views}</span>
              </span>
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          {latest ? <span className="text-[11px] text-muted-foreground">{timeAgo(latest.createdAt)}</span> : null}
          <ChevronDown
            className={cn("h-4 w-4 text-muted-foreground transition-transform", expanded && "rotate-180")}
          />
        </div>
      </button>
      {expanded ? (
        <div className="border-t border-border">
          {channel.posts.length > 0 ? (
            <div className="max-h-96 divide-y divide-border overflow-y-auto wa-scrollbar">
              {channel.posts.map((p) => (
                <ChannelPostCard key={p.id} post={p} onToggleLike={onToggleLike} />
              ))}
            </div>
          ) : (
            <p className="p-4 text-center text-xs text-muted-foreground">Channel ini belum memiliki unggahan.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

/** Baris channel temuan dengan tombol Ikuti. */
function DiscoverChannelRow({
  channel,
  busy,
  onFollow,
}: {
  channel: ChannelT;
  busy: boolean;
  onFollow: (channel: ChannelT) => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 transition-colors hover:border-primary/30">
      <ChannelAvatar name={channel.name} colorKey={channel.colorKey} imageUrl={channel.imageUrl} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1 text-sm font-semibold">
          <span className="truncate">{channel.name}</span>
          {channel.verified ? (
            <BadgeCheck className="h-4 w-4 shrink-0 text-sky-500" aria-label="Channel terverifikasi" />
          ) : null}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {channel.description || "Tanpa deskripsi"} · {fmtCount(channel.followers)} pengikut
        </p>
      </div>
      <Button size="sm" className="shrink-0" onClick={() => onFollow(channel)} disabled={busy} aria-label={`Ikuti ${channel.name}`}>
        <Plus className="h-4 w-4" aria-hidden />
        Ikuti
      </Button>
    </div>
  );
}

export default function ChannelsView() {
  const { toast } = useToast();
  const [channels, setChannels] = useState<ChannelT[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [followBusyId, setFollowBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ChannelPostT | null>(null);
  const [deleting, setDeleting] = useState(false);
  // Hapus channel (milik sendiri) — Task 43
  const [deleteChannelTarget, setDeleteChannelTarget] = useState<ChannelT | null>(null);
  const [deletingChannel, setDeletingChannel] = useState(false);
  // Pencarian channel pada seksi "Temukan Channel"
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/channels", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Gagal memuat channel");
      setChannels((data.channels ?? []) as ChannelT[]);
    } catch (e) {
      toast({
        title: "Gagal memuat channel",
        description: e instanceof Error ? e.message : "Silakan muat ulang halaman.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  // Tombol "+ Buat Channel" top bar (mobile) — dipindah dari header internal sesuai anotasi
  useEffect(() => {
    const open = () => setCreateOpen(true);
    window.addEventListener("wa:channels:create", open);
    return () => window.removeEventListener("wa:channels:create", open);
  }, []);

  const mine = channels.filter((c) => c.isMine);
  const followed = channels.filter((c) => !c.isMine && c.following);
  const discover = channels.filter((c) => !c.isMine && !c.following);
  const q = query.trim().toLowerCase();
  const discoverFiltered = useMemo(
    () =>
      q
        ? discover.filter(
            (c) =>
              c.name.toLowerCase().includes(q) ||
              c.handle.toLowerCase().includes(q) ||
              (c.description || "").toLowerCase().includes(q)
          )
        : discover,
    [channels, q]
  );

  function upsertChannel(updated: ChannelT) {
    setChannels((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)));
  }

  function handlePosted(post: ChannelPostT) {
    setChannels((prev) =>
      prev.map((c) =>
        c.id === post.channelId
          ? {
              ...c,
              posts: [post, ...c.posts].slice(0, 10),
              _count: { posts: (c._count?.posts ?? c.posts.length) + 1 },
            }
          : c
      )
    );
  }

  function handleCreated(channel: ChannelT) {
    setChannels((prev) => [channel, ...prev]);
  }

  async function toggleLike(post: ChannelPostT) {
    const optimistic: ChannelPostT = {
      ...post,
      likedByMe: !post.likedByMe,
      likes: Math.max(0, post.likes + (post.likedByMe ? -1 : 1)),
    };
    setChannels((prev) =>
      prev.map((c) =>
        c.id === post.channelId ? { ...c, posts: c.posts.map((p) => (p.id === post.id ? optimistic : p)) } : c
      )
    );
    try {
      const res = await fetch(`/api/posts/${post.id}/like`, { method: "POST", cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data?.post) throw new Error(data?.error || "Gagal memproses suka");
      const updated = data.post as ChannelPostT;
      setChannels((prev) =>
        prev.map((c) =>
          c.id === post.channelId ? { ...c, posts: c.posts.map((p) => (p.id === post.id ? updated : p)) } : c
        )
      );
    } catch {
      setChannels((prev) =>
        prev.map((c) => (c.id === post.channelId ? { ...c, posts: c.posts.map((p) => (p.id === post.id ? post : p)) } : c))
      );
      toast({ title: "Gagal memproses suka", description: "Periksa koneksi lalu coba lagi.", variant: "destructive" });
    }
  }

  async function toggleFollow(channel: ChannelT) {
    setFollowBusyId(channel.id);
    try {
      const res = await fetch(`/api/channels/${channel.id}/follow`, { method: "POST", cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data?.channel) throw new Error(data?.error || "Gagal memproses");
      upsertChannel(data.channel as ChannelT);
      toast({
        title: data.channel.following ? "Channel diikuti" : "Berhenti mengikuti",
        description: data.channel.following
          ? `Anda sekarang mengikuti ${channel.name}.`
          : `Anda berhenti mengikuti ${channel.name}.`,
      });
    } catch (e) {
      toast({
        title: "Gagal memproses",
        description: e instanceof Error ? e.message : "Silakan coba lagi.",
        variant: "destructive",
      });
    } finally {
      setFollowBusyId(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/posts/${deleteTarget.id}`, { method: "DELETE", cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Gagal menghapus unggahan");
      setChannels((prev) =>
        prev.map((c) =>
          c.id === deleteTarget.channelId
            ? {
                ...c,
                posts: c.posts.filter((p) => p.id !== deleteTarget.id),
                _count: { posts: Math.max(0, (c._count?.posts ?? c.posts.length) - 1) },
              }
            : c
        )
      );
      toast({ title: "Unggahan dihapus", description: "Unggahan berhasil dihapus dari channel." });
      setDeleteTarget(null);
    } catch (e) {
      toast({
        title: "Gagal menghapus",
        description: e instanceof Error ? e.message : "Silakan coba lagi.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  }

  /** Hapus channel milik sendiri — seluruh unggahan ikut terhapus di server (cascade). */
  async function confirmDeleteChannel() {
    const target = deleteChannelTarget;
    if (!target) return;
    setDeletingChannel(true);
    try {
      const res = await fetch(`/api/channels/${target.id}`, { method: "DELETE", cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Gagal menghapus channel");
      setChannels((prev) => prev.filter((c) => c.id !== target.id));
      setExpandedId((v) => (v === target.id ? null : v));
      toast({
        title: "Channel dihapus",
        description: `Channel "${target.name}" dan seluruh unggahannya telah dihapus permanen.`,
      });
      setDeleteChannelTarget(null);
    } catch (e) {
      toast({
        title: "Gagal menghapus channel",
        description: e instanceof Error ? e.message : "Silakan coba lagi.",
        variant: "destructive",
      });
    } finally {
      setDeletingChannel(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header — hanya desktop; di mobile judul ada di top bar AppShell & tombol "+ Buat Channel" pindah ke pojok kanannya */}
      <header className="hidden h-14 shrink-0 items-center gap-2.5 border-b border-border bg-sidebar px-4 md:flex md:px-6">
        <Radio className="h-5 w-5 text-primary" aria-hidden />
        <h1 className="text-base font-semibold">Channel</h1>
        <p className="hidden text-xs text-muted-foreground lg:block">
          Siarkan kabar produk &amp; promo ke pengikut Anda
        </p>
        <div className="ml-auto">
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            Buat Channel
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto wa-scrollbar">
        <div className="mx-auto w-full max-w-3xl space-y-6 p-4 md:p-6">
          {loading ? (
            <div className="space-y-4" aria-busy="true" aria-label="Memuat channel">
              <Skeleton className="h-52 w-full rounded-2xl" />
              <Skeleton className="h-16 w-full rounded-2xl" />
              <Skeleton className="h-16 w-full rounded-2xl" />
              <Skeleton className="h-16 w-full rounded-2xl" />
            </div>
          ) : (
            <>
              {/* Channel Saya */}
              <section aria-labelledby="ch-mine-title" className="space-y-3">
                <SectionTitle id="ch-mine-title" icon={Megaphone}>
                  Channel Saya
                </SectionTitle>
                {mine.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border p-6 text-center">
                    <Megaphone className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" aria-hidden />
                    <p className="text-sm font-medium">Anda belum memiliki channel</p>
                    <p className="mb-3 text-xs text-muted-foreground">
                      Buat channel untuk menyiarkan promo &amp; kabar produk ke pelanggan Anda.
                    </p>
                    <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
                      <Plus className="h-4 w-4" aria-hidden /> Buat Channel
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {mine.map((c) => (
                      <MyChannelCard
                        key={c.id}
                        channel={c}
                        onPosted={handlePosted}
                        onToggleLike={toggleLike}
                        onDeletePost={setDeleteTarget}
                        onRequestDeleteChannel={setDeleteChannelTarget}
                        onChannelPatched={upsertChannel}
                      />
                    ))}
                  </div>
                )}
              </section>

              {/* Channel yang diikuti */}
              <section aria-labelledby="ch-follow-title" className="space-y-3">
                <SectionTitle id="ch-follow-title" icon={Users}>
                  Channel yang Anda Ikuti
                </SectionTitle>
                {followed.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                    Anda belum mengikuti channel mana pun. Temukan channel menarik di bawah! 👇
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {followed.map((c) => (
                      <FollowedChannelRow
                        key={c.id}
                        channel={c}
                        expanded={expandedId === c.id}
                        onToggleExpand={() => setExpandedId((v) => (v === c.id ? null : c.id))}
                        onToggleLike={toggleLike}
                      />
                    ))}
                  </div>
                )}
              </section>

              {/* Temukan channel */}
              <section aria-labelledby="ch-discover-title" className="space-y-3">
                <SectionTitle id="ch-discover-title" icon={Compass}>
                  Temukan Channel
                </SectionTitle>
                {discover.length > 0 ? (
                  <div className="relative">
                    <Search
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                      aria-hidden
                    />
                    <Input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Cari channel…"
                      aria-label="Cari channel"
                      className="pl-9"
                    />
                  </div>
                ) : null}
                {discover.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                    Tidak ada channel baru untuk ditemukan saat ini.
                  </p>
                ) : discoverFiltered.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                    Tidak ada channel yang cocok dengan &ldquo;{query.trim()}&rdquo;.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {discoverFiltered.map((c) => (
                      <DiscoverChannelRow key={c.id} channel={c} busy={followBusyId === c.id} onFollow={toggleFollow} />
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>

      <CreateChannelDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={handleCreated} />

      {/* Konfirmasi hapus unggahan */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus unggahan ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Unggahan akan dihapus permanen dari channel dan tidak dapat dikembalikan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Konfirmasi hapus channel (milik sendiri) — Task 43 */}
      <AlertDialog
        open={deleteChannelTarget !== null}
        onOpenChange={(open) => !open && setDeleteChannelTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Hapus channel &ldquo;{deleteChannelTarget?.name}&rdquo;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Seluruh unggahan channel ini ({deleteChannelTarget?._count?.posts ?? deleteChannelTarget?.posts.length ?? 0}{" "}
              postingan) akan dihapus permanen dan pengikut tidak lagi menerima pembaruan dari channel ini. Tindakan
              ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingChannel}>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deletingChannel}
              onClick={(e) => {
                e.preventDefault();
                void confirmDeleteChannel();
              }}
            >
              {deletingChannel ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              Hapus Channel
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
