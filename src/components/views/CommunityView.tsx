"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  ImagePlus,
  Loader2,
  Megaphone,
  MoreVertical,
  PencilLine,
  Plus,
  Send,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { cn, colorOf, getInitials, AVATAR_COLORS } from "@/lib/wa-utils";
import { uploadImage } from "@/lib/upload";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

// ===================== TIPE & UTIL =====================

type GroupT = { id: string; name: string; members: number; description: string; chatId?: string };

type CommunityT = {
  id: string;
  name: string;
  description: string;
  colorKey: string;
  imageUrl: string; // foto logo — "" = inisial + warna (Task 47)
  coverUrl: string; // foto latar — "" = gradasi warna (Task 47)
  ownerId: string | null;
  memberCount: number;
  announcement: string;
  groups: GroupT[];
  isMine: boolean; // milik sesi yang masuk (Task 46)
  canManage: boolean; // pemilik atau Super Admin (Task 46)
};

function parseGroups(raw: string): GroupT[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? (v as GroupT[]) : [];
  } catch {
    return [];
  }
}

/** Petakan baris mentah API → bentuk UI (groups JSON string → array). */
function toCommunity(raw: Record<string, unknown>): CommunityT {
  return {
    id: String(raw.id ?? ""),
    name: String(raw.name ?? ""),
    description: String(raw.description ?? ""),
    colorKey: String(raw.colorKey ?? "teal"),
    imageUrl: String(raw.imageUrl ?? ""),
    coverUrl: String(raw.coverUrl ?? ""),
    ownerId: (raw.ownerId as string | null) ?? null,
    memberCount: Number(raw.memberCount ?? 0),
    announcement: String(raw.announcement ?? ""),
    groups: parseGroups(String(raw.groups ?? "[]")),
    isMine: raw.isMine === true,
    canManage: raw.canManage === true,
  };
}

/** Gradasi latar cadangan per warna — foto latar menutupinya bila ada (Task 47). */
const HERO_GRADIENTS: Record<string, string> = {
  emerald: "from-maroon-700 via-maroon-600 to-maroon-800",
  green: "from-maroon-800 via-maroon-700 to-maroon-900",
  teal: "from-maroon-900 via-maroon-800 to-maroon-950",
  purple: "from-purple-700 via-purple-600 to-violet-600",
  violet: "from-violet-700 via-violet-600 to-purple-600",
  amber: "from-amber-600 via-amber-500 to-orange-600",
  orange: "from-orange-600 via-orange-500 to-amber-600",
  pink: "from-pink-600 via-pink-500 to-rose-600",
  rose: "from-rose-600 via-rose-500 to-pink-600",
  red: "from-red-700 via-red-600 to-rose-600",
  cyan: "from-cyan-700 via-cyan-600 to-cyan-900",
  lime: "from-maroon-400 via-maroon-500 to-maroon-700",
};

function heroGradient(key: string) {
  return HERO_GRADIENTS[key] ?? HERO_GRADIENTS.teal;
}

const COLOR_KEYS = Object.keys(AVATAR_COLORS);

// ===================== DIALOG FORM (BUAT + EDIT) — Task 46/47 =====================

/** Dialog "Buat Komunitas" sekaligus "Edit Komunitas": nama, deskripsi, warna,
 *  plus unggah FOTO logo & latar belakang dengan pratinjau langsung (Task 47). */
function CommunityFormDialog({
  open,
  onOpenChange,
  onSubmitted,
  community,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitted: (community: CommunityT) => void;
  community?: CommunityT | null; // ada = mode edit
}) {
  const { toast } = useToast();
  const editing = Boolean(community);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [colorKey, setColorKey] = useState("teal");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [uploading, setUploading] = useState<"avatar" | "cover" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // Isi ulang form setiap kali dialog dibuka / target berubah
  useEffect(() => {
    if (open) {
      setName(community?.name ?? "");
      setDescription(community?.description ?? "");
      setColorKey(community?.colorKey ?? "teal");
      setAvatarUrl(community?.imageUrl ?? "");
      setCoverUrl(community?.coverUrl ?? "");
    }
  }, [open, community]);

  /** Unggah foto → pratinjau live; tersimpan permanen saat tombol simpan ditekan (Task 47). */
  async function pickPhoto(kind: "avatar" | "cover", file: File | null | undefined) {
    if (!file) return;
    setUploading(kind);
    try {
      const url = await uploadImage(file, kind === "avatar" ? "community-avatar" : "community-cover");
      if (kind === "avatar") setAvatarUrl(url);
      else setCoverUrl(url);
    } catch (e) {
      toast({
        title: kind === "avatar" ? "Gagal memuat logo" : "Gagal memuat latar belakang",
        description: e instanceof Error ? e.message : "Coba gambar lain",
        variant: "destructive",
      });
    } finally {
      setUploading(null);
    }
  }

  async function submit() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const body = JSON.stringify({
        name: name.trim(),
        description: description.trim(),
        colorKey,
        imageUrl: avatarUrl,
        coverUrl,
      });
      const res = await fetch(editing ? `/api/communities/${community!.id}` : "/api/communities", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body,
      });
      const data = await res.json();
      if (!res.ok || !data?.community) throw new Error(data?.error || "Gagal menyimpan komunitas");
      onSubmitted(toCommunity(data.community as Record<string, unknown>));
      toast({
        title: editing ? "Komunitas diperbarui" : "Komunitas dibuat",
        description: editing
          ? `Perubahan pada "${name.trim()}" tersimpan permanen.`
          : `Komunitas "${name.trim()}" tersimpan dan siap digunakan.`,
      });
      onOpenChange(false);
    } catch (e) {
      toast({
        title: editing ? "Gagal menyimpan komunitas" : "Gagal membuat komunitas",
        description: e instanceof Error ? e.message : "Silakan coba lagi.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            {editing ? "Edit Komunitas" : "Buat Komunitas"}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? "Perbarui identitas komunitas — perubahan tersimpan permanen di database."
              : "Satukan beberapa grup terkait bisnis dalam satu komunitas."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Pratinjau identitas: strip latar + avatar overlap (Task 47) */}
          <div className="overflow-hidden rounded-2xl border border-border">
            <div
              className={cn(
                "relative flex h-24 items-end justify-center bg-gradient-to-br",
                heroGradient(colorKey)
              )}
            >
              {coverUrl ? (
                <>
                  <img src={coverUrl} alt="Pratinjau latar komunitas" className="absolute inset-0 h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/25 to-black/35" aria-hidden />
                </>
              ) : null}
              <div className="absolute -right-8 -top-10 h-28 w-28 rounded-full bg-white/10" aria-hidden />
              <div className="absolute right-12 top-3 h-10 w-10 rounded-full bg-white/10" aria-hidden />
              <button
                type="button"
                onClick={() => coverInputRef.current?.click()}
                disabled={uploading !== null}
                className="absolute bottom-2 right-2 z-10 flex h-8 items-center gap-1.5 rounded-full bg-black/45 px-3 text-xs font-medium text-white backdrop-blur-sm transition-colors hover:bg-black/65 disabled:opacity-60"
              >
                {uploading === "cover" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
                {coverUrl ? "Ganti Latar" : "Unggah Latar"}
              </button>
              {coverUrl ? (
                <button
                  type="button"
                  onClick={() => setCoverUrl("")}
                  className="absolute bottom-2 left-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-colors hover:bg-black/65"
                  title="Hapus foto latar"
                  aria-label="Hapus foto latar"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
            <div className="relative -mt-8 flex flex-col items-center pb-3">
              <div className="relative">
                <div
                  className={cn(
                    "flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl text-lg font-bold text-white shadow-[0_0_0_4px_var(--card)]",
                    !avatarUrl && colorOf(colorKey).bg
                  )}
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Pratinjau logo komunitas" className="h-full w-full object-cover" />
                  ) : (
                    <span aria-hidden>{name.trim() ? getInitials(name) : <Users className="h-6 w-6" />}</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploading !== null}
                  className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md ring-2 ring-card transition-transform hover:scale-105 disabled:opacity-60"
                  title={avatarUrl ? "Ganti foto logo" : "Unggah foto logo"}
                  aria-label={avatarUrl ? "Ganti foto logo" : "Unggah foto logo"}
                >
                  {uploading === "avatar" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                </button>
              </div>
              {avatarUrl ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-1.5 h-6 px-2 text-[11px] text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40"
                  onClick={() => setAvatarUrl("")}
                >
                  <Trash2 className="h-3 w-3 mr-1" aria-hidden="true" /> Hapus Logo
                </Button>
              ) : null}
              <p className="mt-1 text-[11px] text-muted-foreground">
                Warna dipakai untuk avatar & latar bila belum ada foto/gambar.
              </p>
            </div>
          </div>

          {/* Input file tersembunyi */}
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            data-upload="community-avatar-dialog"
            onChange={(e) => {
              void pickPhoto("avatar", e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <input
            ref={coverInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            data-upload="community-cover-dialog"
            onChange={(e) => {
              void pickPhoto("cover", e.target.files?.[0]);
              e.target.value = "";
            }}
          />

          <div className="space-y-1.5">
            <Label htmlFor="community-name">Nama komunitas</Label>
            <Input
              id="community-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              placeholder="cth. Komunitas Pelanggan IndiGoo"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="community-desc">Deskripsi</Label>
            <Textarea
              id="community-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={300}
              placeholder="Untuk apa komunitas ini?"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Warna komunitas</Label>
            <div className="flex flex-wrap gap-2">
              {COLOR_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setColorKey(key)}
                  aria-label={`Warna ${key}`}
                  aria-pressed={colorKey === key}
                  className={cn(
                    "h-7 w-7 rounded-full transition-transform",
                    colorOf(key).bg,
                    colorKey === key ? "scale-110 ring-2 ring-foreground/60 ring-offset-2 ring-offset-card" : "hover:scale-105"
                  )}
                />
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Batal
          </Button>
          <Button onClick={() => void submit()} disabled={submitting || name.trim().length === 0}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? <PencilLine className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
            {editing ? "Simpan Perubahan" : "Buat"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===================== DIALOG LAIN (pengumuman & grup) =====================

/** Dialog edit pengumuman komunitas (pemilik/admin). */
function EditAnnouncementDialog({
  community,
  open,
  onOpenChange,
  onSaved,
}: {
  community: CommunityT;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (updated: CommunityT) => void;
}) {
  const { toast } = useToast();
  const [text, setText] = useState(community.announcement);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/communities/${community.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ announcement: text.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data?.community) throw new Error(data?.error || "Gagal menyimpan pengumuman");
      onSaved(toCommunity(data.community as Record<string, unknown>));
      toast({ title: "Pengumuman diperbarui", description: `Pengumuman "${community.name}" sudah diperbarui.` });
      onOpenChange(false);
    } catch (e) {
      toast({
        title: "Gagal menyimpan pengumuman",
        description: e instanceof Error ? e.message : "Silakan coba lagi.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-amber-500" />
            Edit Pengumuman
          </DialogTitle>
          <DialogDescription>
            Pengumuman akan tampil di halaman komunitas {community.name}.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          maxLength={1000}
          placeholder="Tulis pengumuman untuk anggota komunitas…"
          aria-label="Isi pengumuman komunitas"
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Batal
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <PencilLine className="h-4 w-4" />}
            Simpan Pengumuman
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Dialog kirim pengumuman ke satu grup komunitas — pengumuman NYATA via chat grup. */
function SendGroupAnnouncementDialog({
  community,
  group,
  open,
  onOpenChange,
  onAnnounced,
}: {
  community: CommunityT;
  group: GroupT | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAnnounced: (updated: CommunityT) => void;
}) {
  const { toast } = useToast();
  const [msg, setMsg] = useState("");
  const [sending, setSending] = useState(false);

  async function send() {
    if (!group || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/communities/${community.id}/announce`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId: group.id, text: msg.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data?.message) throw new Error(data?.error || "Gagal mengirim pengumuman");
      if (data.community) {
        onAnnounced(toCommunity(data.community as Record<string, unknown>));
      }
      toast({
        title: "Pengumuman terkirim",
        description: data.created
          ? `Chat grup "${group.name}" dibuat otomatis dan pengumuman masuk ke chat tersebut.`
          : `Pengumuman terkirim ke grup "${group.name}" — buka tab Chat untuk melihatnya.`,
      });
      setMsg("");
      onOpenChange(false);
    } catch (e) {
      toast({
        title: "Gagal mengirim pengumuman",
        description: e instanceof Error ? e.message : "Silakan coba lagi.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) setMsg(""); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            Kirim Pengumuman ke Grup
          </DialogTitle>
          <DialogDescription>
            {group ? `Grup "${group.name}" · ${community.name} — pengumuman dikirim sebagai pesan ke chat grup.` : ""}
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          rows={4}
          maxLength={2000}
          placeholder="Tulis pengumuman ke grup…"
          aria-label="Isi pengumuman grup"
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Batal
          </Button>
          <Button onClick={() => void send()} disabled={sending || msg.trim().length === 0}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Kirim
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Dialog tambah grup baru ke dalam komunitas. */
function AddGroupDialog({
  community,
  open,
  onOpenChange,
  onAdded,
}: {
  community: CommunityT;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: (updated: CommunityT) => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [adding, setAdding] = useState(false);

  async function add() {
    if (adding) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/communities/${community.id}/groups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: desc.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data?.community) throw new Error(data?.error || "Gagal menambah grup");
      onAdded(toCommunity(data.community as Record<string, unknown>));
      toast({ title: "Grup ditambahkan", description: `Grup "${name.trim()}" masuk ke komunitas ${community.name}.` });
      setName("");
      setDesc("");
      onOpenChange(false);
    } catch (e) {
      toast({
        title: "Gagal menambah grup",
        description: e instanceof Error ? e.message : "Silakan coba lagi.",
        variant: "destructive",
      });
    } finally {
      setAdding(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setName(""); setDesc(""); } onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            Tambah Grup
          </DialogTitle>
          <DialogDescription>Grup baru masuk ke komunitas {community.name}.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="group-name">Nama grup</Label>
            <Input
              id="group-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              placeholder="cth. Pelanggan Setia"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="group-desc">Deskripsi (opsional)</Label>
            <Input
              id="group-desc"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              maxLength={200}
              placeholder="cth. Untuk promo bulanan"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={adding}>
            Batal
          </Button>
          <Button onClick={() => void add()} disabled={adding || name.trim().length === 0}>
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Tambah
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===================== KARTU KOMUNITAS (desain premium Task 46 + foto Task 47) =====================

function CommunityCard({
  community,
  onUpdated,
  onDeleted,
}: {
  community: CommunityT;
  onUpdated: (updated: CommunityT) => void;
  onDeleted: (id: string) => void;
}) {
  const { toast } = useToast();
  const [announcementOpen, setAnnouncementOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [groupTarget, setGroupTarget] = useState<GroupT | null>(null);
  const [addGroupOpen, setAddGroupOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState<"avatar" | "cover" | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  /** Perbarui sebagian data komunitas (foto/logo/latar) langsung ke API. */
  async function patchCommunity(patch: { imageUrl?: string; coverUrl?: string }) {
    const res = await fetch(`/api/communities/${community.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (!res.ok || !data?.community) throw new Error(data?.error || "Gagal memperbarui komunitas");
    onUpdated(toCommunity(data.community as Record<string, unknown>));
    return true;
  }

  /** Unggah foto (kamera/menu) → simpan langsung ke DB → toast (Task 47). */
  async function handleFile(kind: "avatar" | "cover", file: File | null | undefined) {
    if (!file) return;
    setUploading(kind);
    try {
      const url = await uploadImage(file, kind === "avatar" ? "community-avatar" : "community-cover");
      await patchCommunity(kind === "avatar" ? { imageUrl: url } : { coverUrl: url });
      toast({
        title: kind === "avatar" ? "Foto logo diperbarui" : "Latar belakang diperbarui",
        description: `Foto komunitas "${community.name}" tersimpan permanen.`,
      });
    } catch (e) {
      toast({
        title: kind === "avatar" ? "Gagal memuat logo" : "Gagal memuat latar belakang",
        description: e instanceof Error ? e.message : "Coba gambar lain",
        variant: "destructive",
      });
    } finally {
      setUploading(null);
    }
  }

  async function handleDelete() {
    if (deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/communities/${community.id}`, { method: "DELETE", cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Gagal menghapus komunitas");
      onDeleted(community.id);
      toast({ title: "Komunitas dihapus", description: `"${community.name}" dihapus permanen.` });
      setDeleteOpen(false);
    } catch (e) {
      toast({
        title: "Gagal menghapus komunitas",
        description: e instanceof Error ? e.message : "Silakan coba lagi.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* ============ KARTU UTAMA: hero latar + avatar overlap ============ */}
      <Card className="overflow-hidden">
        {/* Hero latar: foto (Task 47) atau gradasi warna + dekorasi lingkaran */}
        <div className={cn("relative h-28 overflow-hidden bg-gradient-to-br md:h-32", heroGradient(community.colorKey))}>
          {community.coverUrl ? (
            <>
              <img
                src={community.coverUrl}
                alt={`Latar komunitas ${community.name}`}
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/25 to-black/35" aria-hidden />
            </>
          ) : (
            <>
              <div className="absolute -right-8 -top-12 h-32 w-32 rounded-full bg-white/10" aria-hidden />
              <div className="absolute right-14 top-4 h-12 w-12 rounded-full bg-white/10" aria-hidden />
              <div className="absolute -left-6 bottom-0 h-16 w-16 rounded-full bg-black/5" aria-hidden />
            </>
          )}
          {community.isMine ? (
            <div className="absolute left-4 top-3 z-10">
              <Badge className="border-0 bg-white/20 text-white backdrop-blur-sm">Komunitas Saya</Badge>
            </div>
          ) : null}
          {community.canManage ? (
            <div className="absolute right-2.5 top-2.5 z-10">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-white hover:bg-white/15 hover:text-white"
                    aria-label={`Menu komunitas ${community.name}`}
                  >
                    <MoreVertical className="h-4 w-4" aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem className="gap-2" onSelect={() => avatarInputRef.current?.click()}>
                    <Camera className="h-4 w-4" aria-hidden />
                    Ganti Foto Logo
                  </DropdownMenuItem>
                  {community.imageUrl ? (
                    <DropdownMenuItem
                      className="gap-2"
                      onSelect={() => {
                        void patchCommunity({ imageUrl: "" })
                          .then(() => toast({ title: "Foto logo dihapus", description: "Avatar kembali ke inisial & warna." }))
                          .catch((e: unknown) =>
                            toast({
                              title: "Gagal menghapus foto logo",
                              description: e instanceof Error ? e.message : "Coba lagi",
                              variant: "destructive",
                            })
                          );
                      }}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                      Hapus Foto Logo
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuItem className="gap-2" onSelect={() => coverInputRef.current?.click()}>
                    <ImagePlus className="h-4 w-4" aria-hidden />
                    Ganti Latar Belakang
                  </DropdownMenuItem>
                  {community.coverUrl ? (
                    <DropdownMenuItem
                      className="gap-2"
                      onSelect={() => {
                        void patchCommunity({ coverUrl: "" })
                          .then(() => toast({ title: "Latar belakang dihapus", description: "Latar kembali ke gradasi warna." }))
                          .catch((e: unknown) =>
                            toast({
                              title: "Gagal menghapus latar belakang",
                              description: e instanceof Error ? e.message : "Coba lagi",
                              variant: "destructive",
                            })
                          );
                      }}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                      Hapus Latar Belakang
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="gap-2" onSelect={() => setEditOpen(true)}>
                    <PencilLine className="h-4 w-4" aria-hidden />
                    Edit Komunitas
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="gap-2 text-destructive focus:text-destructive"
                    onSelect={() => setDeleteOpen(true)}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                    Hapus Komunitas
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : null}
          {/* Tombol kamera: ganti latar belakang */}
          {community.canManage ? (
            <button
              type="button"
              onClick={() => coverInputRef.current?.click()}
              title="Ubah latar belakang"
              aria-label="Ubah latar belakang komunitas"
              disabled={uploading !== null}
              className="absolute bottom-2.5 right-2.5 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-colors hover:bg-black/65 disabled:opacity-60"
            >
              {uploading === "cover" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Camera className="h-4 w-4" aria-hidden />}
            </button>
          ) : null}
        </div>

        {/* Identitas: avatar overlap (foto Task 47) + nama + deskripsi + statistik */}
        <div className="px-4 pb-4 md:px-5">
          <div className="relative z-10 -mt-9 mb-2.5 flex items-end">
            <div className="relative h-[4.5rem] w-[4.5rem]">
              <div
                className={cn(
                  "flex h-full w-full items-center justify-center overflow-hidden rounded-2xl text-xl font-bold text-white shadow-[0_0_0_4px_var(--card)]",
                  !community.imageUrl && colorOf(community.colorKey).bg
                )}
              >
                {community.imageUrl ? (
                  <img
                    src={community.imageUrl}
                    alt={`Foto logo komunitas ${community.name}`}
                    className="h-full w-full object-cover"
                  />
                ) : getInitials(community.name) !== "?" ? (
                  <span aria-hidden>{getInitials(community.name)}</span>
                ) : (
                  <Users className="h-7 w-7" aria-hidden />
                )}
              </div>
              {community.canManage ? (
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  title="Ubah foto logo komunitas"
                  aria-label="Ubah foto logo komunitas"
                  disabled={uploading !== null}
                  className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md ring-2 ring-card transition-transform hover:scale-105 disabled:opacity-60"
                >
                  {uploading === "avatar" ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Camera className="h-3.5 w-3.5" aria-hidden />}
                </button>
              ) : null}
            </div>
          </div>
          <h2 className="text-base font-bold leading-tight">{community.name}</h2>
          {community.description ? (
            <p className="mt-1 text-sm text-muted-foreground">{community.description}</p>
          ) : null}
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            <div className="rounded-xl border border-border bg-secondary/40 px-3 py-2">
              <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <Users className="h-3.5 w-3.5" aria-hidden /> Anggota
              </p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums">
                {community.memberCount.toLocaleString("id-ID")}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-secondary/40 px-3 py-2">
              <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <Plus className="h-3.5 w-3.5" aria-hidden /> Grup
              </p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums">{community.groups.length}</p>
            </div>
          </div>
        </div>
      </Card>

      {/* ============ Kartu pengumuman ============ */}
      <Card>
        <CardContent className="p-4 md:p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100" aria-hidden>
              <Megaphone className="h-5 w-5 text-amber-600" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">Pengumuman</p>
                <Badge variant="outline" className="text-[10px]">Admin</Badge>
              </div>
              {community.announcement ? (
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{community.announcement}</p>
              ) : (
                <p className="mt-1 text-sm italic text-muted-foreground">Belum ada pengumuman untuk komunitas ini.</p>
              )}
            </div>
            {community.canManage ? (
              <Button size="sm" variant="outline" className="shrink-0" onClick={() => setAnnouncementOpen(true)}>
                <PencilLine className="h-4 w-4" />
                <span className="hidden sm:inline">Edit Pengumuman</span>
                <span className="sm:hidden">Edit</span>
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* ============ Grid grup ============ */}
      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Grup dalam komunitas ({community.groups.length})
          </p>
          {community.canManage ? (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1 text-xs text-primary hover:text-primary"
              onClick={() => setAddGroupOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              Tambah Grup
            </Button>
          ) : null}
        </div>
        {community.groups.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
            Belum ada grup dalam komunitas ini.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {community.groups.map((g, i) => (
              <Card key={g.id}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold">{g.name}</p>
                    {i === 0 ? (
                      <Badge className="shrink-0 bg-amber-100 text-amber-700" variant="secondary">
                        <Megaphone className="mr-1 h-3 w-3" />
                        Grup pengumuman
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">{g.description || "Tanpa deskripsi"}</p>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    {g.members.toLocaleString("id-ID")} anggota
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => setGroupTarget(g)}
                    aria-label={`Kirim pengumuman ke grup ${g.name}`}
                  >
                    <Send className="h-4 w-4" />
                    Kirim Pengumuman ke Grup
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Input file tersembunyi (kamera & menu) */}
      {community.canManage ? (
        <>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            data-upload="community-avatar"
            onChange={(e) => {
              void handleFile("avatar", e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <input
            ref={coverInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            data-upload="community-cover"
            onChange={(e) => {
              void handleFile("cover", e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </>
      ) : null}

      {/* Dialog: edit komunitas, pengumuman, grup, kirim pengumuman, konfirmasi hapus */}
      <CommunityFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        community={community}
        onSubmitted={onUpdated}
      />
      <EditAnnouncementDialog
        community={community}
        open={announcementOpen}
        onOpenChange={setAnnouncementOpen}
        onSaved={onUpdated}
      />
      <SendGroupAnnouncementDialog
        community={community}
        group={groupTarget}
        open={groupTarget !== null}
        onOpenChange={(open) => !open && setGroupTarget(null)}
        onAnnounced={onUpdated}
      />
      <AddGroupDialog
        community={community}
        open={addGroupOpen}
        onOpenChange={setAddGroupOpen}
        onAdded={onUpdated}
      />
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus komunitas ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Komunitas <span className="font-semibold">{community.name}</span> akan dihapus permanen beserta datanya.
              Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
              disabled={deleting}
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Ya, Hapus Permanen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ===================== VIEW UTAMA =====================

export default function CommunityView() {
  const { toast } = useToast();
  const [communities, setCommunities] = useState<CommunityT[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/communities", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Gagal memuat komunitas");
      setCommunities(((data.communities ?? []) as Record<string, unknown>[]).map(toCommunity));
    } catch (e) {
      toast({
        title: "Gagal memuat komunitas",
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

  const upsert = (updated: CommunityT) =>
    setCommunities((prev) => {
      const i = prev.findIndex((x) => x.id === updated.id);
      if (i === -1) return [...prev, updated];
      const next = [...prev];
      next[i] = updated;
      return next;
    });

  return (
    <div className="flex h-full flex-col">
      {/* Header — hanya desktop; di mobile judul ada di top bar AppShell & logo ikon komunitas pindah ke pojok kanannya */}
      <header className="hidden h-14 shrink-0 items-center gap-2.5 border-b border-border bg-sidebar px-4 md:flex md:px-6">
        <Users className="h-5 w-5 text-primary" aria-hidden />
        <h1 className="text-base font-semibold">Komunitas</h1>
        <div className="ml-auto">
          <Button size="sm" onClick={() => setFormOpen(true)}>
            <UserPlus className="h-4 w-4" />
            Buat Komunitas
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto wa-scrollbar">
        <div className="mx-auto w-full max-w-3xl p-4 md:p-6">
          {loading ? (
            <div className="space-y-4" aria-busy="true" aria-label="Memuat komunitas">
              <Skeleton className="h-40 w-full rounded-2xl" />
              <Skeleton className="h-28 w-full rounded-2xl" />
              <div className="grid gap-3 sm:grid-cols-2">
                <Skeleton className="h-36 rounded-2xl" />
                <Skeleton className="h-36 rounded-2xl" />
                <Skeleton className="h-36 rounded-2xl" />
                <Skeleton className="h-36 rounded-2xl" />
              </div>
            </div>
          ) : communities.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center">
              <Users className="mx-auto mb-3 h-12 w-12 text-muted-foreground/40" aria-hidden />
              <p className="text-sm font-semibold">Belum ada komunitas</p>
              <p className="mb-4 mt-1 text-xs text-muted-foreground">
                Komunitas menyatukan beberapa grup terkait agar pengumuman & diskusi lebih rapi.
              </p>
              <Button onClick={() => setFormOpen(true)}>
                <UserPlus className="h-4 w-4" />
                Buat Komunitas
              </Button>
            </div>
          ) : (
            <div className="space-y-8">
              {communities.map((c, idx) => (
                <div key={c.id}>
                  {idx > 0 ? <Separator className="mb-8" /> : null}
                  <CommunityCard
                    community={c}
                    onUpdated={upsert}
                    onDeleted={(id) => setCommunities((prev) => prev.filter((x) => x.id !== id))}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <CommunityFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        onSubmitted={upsert}
      />
    </div>
  );
}
