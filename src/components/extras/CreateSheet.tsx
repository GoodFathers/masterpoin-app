"use client";

import { useState } from "react";
import { Camera, Clapperboard, Loader2, ChevronLeft, Check, PackagePlus } from "lucide-react";
import { cn } from "@/lib/wa-utils";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { can } from "@/lib/user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ViewId } from "@/components/AppShell";

type Mode = "pick" | "photo" | "video";

/**
 * Tombol "+" (tambah): membuat foto (→ dikirim sebagai Status) atau video (→ dikirim ke Beranda).
 */
export default function CreateSheet({
  open,
  onOpenChange,
  onNavigate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onNavigate?: (view: ViewId) => void;
}) {
  const { toast } = useToast();
  const { user } = useAuth();
  const canManageMarket = can(user?.role, "market.manage");
  const [mode, setMode] = useState<Mode>("pick");

  const close = (v: boolean) => {
    onOpenChange(v);
    if (!v) setTimeout(() => setMode("pick"), 200);
  };

  // Buka dialog produk Marketplace (view harus berganti dulu → kirim flag).
  const gotoNewProduct = () => {
    try {
      window.sessionStorage.setItem("wa_market_new", "1");
    } catch {
      // abaikan
    }
    close(false);
    onNavigate?.("marketplace");
    toast({ title: "Isi detail produk Anda di Marketplace 🛍️" });
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        {mode === "pick" && (
          <>
            <DialogHeader>
              <DialogTitle>Buat konten baru</DialogTitle>
              <DialogDescription>Pilih jenis konten yang ingin Anda buat dan bagikan.</DialogDescription>
            </DialogHeader>
            <div className={cn("grid gap-3 py-2", canManageMarket ? "grid-cols-2" : "grid-cols-2")}>
              <button
                type="button"
                onClick={() => setMode("photo")}
                className="flex flex-col items-center gap-2.5 rounded-xl border border-border p-5 hover:bg-secondary/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <span className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Camera className="h-6 w-6 text-primary" aria-hidden="true" />
                </span>
                <span className="text-sm font-semibold">Buat Foto</span>
                <span className="text-[11px] text-muted-foreground text-center leading-snug">Bagikan momen sebagai Status · 24 jam</span>
              </button>
              <button
                type="button"
                onClick={() => setMode("video")}
                className="flex flex-col items-center gap-2.5 rounded-xl border border-border p-5 hover:bg-secondary/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <span className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Clapperboard className="h-6 w-6 text-primary" aria-hidden="true" />
                </span>
                <span className="text-sm font-semibold">Buat Video</span>
                <span className="text-[11px] text-muted-foreground text-center leading-snug">Kirim video ke feed Beranda</span>
              </button>
              {canManageMarket && (
                <button
                  type="button"
                  onClick={gotoNewProduct}
                  className="col-span-2 flex items-center gap-3 rounded-xl border border-border p-4 hover:bg-secondary/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary text-left"
                >
                  <span className="h-11 w-11 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                    <PackagePlus className="h-5 w-5 text-amber-600" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">Tambah Produk Marketplace</span>
                    <span className="block text-[11px] text-muted-foreground leading-snug">Jualan produk baru di toko (Super Admin &amp; Admin)</span>
                  </span>
                </button>
              )}
            </div>
          </>
        )}

        {mode === "photo" && (
          <PhotoForm onDone={() => { close(false); onNavigate?.("status"); }} onBack={() => setMode("pick")} />
        )}
        {mode === "video" && (
          <VideoForm onDone={() => { close(false); onNavigate?.("beranda"); }} onBack={() => setMode("pick")} />
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------- Form foto → Status ----------
function PhotoForm({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", "photo");
      const up = await fetch("/api/upload", { method: "POST", body: fd });
      const upData = (await up.json()) as { url?: string; error?: string };
      if (!up.ok || !upData.url) throw new Error(upData.error ?? "Gagal mengunggah foto");

      const res = await fetch("/api/stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaType: "IMAGE", mediaUrl: upData.url, body: caption.trim() }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(d?.error ?? "Gagal mengirim status");
      }
      toast({ title: "Foto terkirim sebagai Status ✨" });
      onDone();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Gagal mengirim status", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="-ml-2 h-7 w-7" onClick={onBack} aria-label="Kembali">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          Buat Foto
        </DialogTitle>
        <DialogDescription>Foto akan dibagikan sebagai Status dan hilang dalam 24 jam.</DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="photo-file">Foto</Label>
          {preview ? (
            <div className="relative rounded-lg overflow-hidden border border-border bg-black">
              <img src={preview} alt="Pratinjau foto" className="w-full max-h-48 object-contain" />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="absolute top-2 right-2"
                onClick={() => { setFile(null); setPreview(""); }}
              >
                Ganti
              </Button>
            </div>
          ) : (
            <label
              htmlFor="photo-file"
              className="flex flex-col items-center justify-center gap-2 h-32 rounded-lg border-2 border-dashed border-border bg-secondary/40 cursor-pointer hover:bg-secondary/70 transition-colors"
            >
              <Camera className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
              <span className="text-sm text-muted-foreground">Ketuk untuk pilih foto</span>
              <span className="text-[11px] text-muted-foreground/70">JPG / PNG / WebP · maks 30 MB</span>
            </label>
          )}
          <input
            id="photo-file"
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setFile(f);
              setPreview(f ? URL.createObjectURL(f) : "");
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="photo-caption">Keterangan (opsional)</Label>
          <Textarea
            id="photo-caption"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Tulis sesuatu…"
            rows={2}
            maxLength={200}
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onBack} disabled={busy}>Batal</Button>
        <Button onClick={() => void submit()} disabled={busy || !file}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Kirim Status
        </Button>
      </DialogFooter>
    </>
  );
}

// ---------- Form video → Beranda ----------
function VideoForm({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<"hiburan" | "domisili" | "promo">("hiburan");
  const [busy, setBusy] = useState(false);

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
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Gagal mengirim video");
      toast({ title: "Video terkirim ke Beranda 🎬" });
      onDone();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Gagal mengirim video", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="-ml-2 h-7 w-7" onClick={onBack} aria-label="Kembali">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          Buat Video
        </DialogTitle>
        <DialogDescription>Video akan tampil di feed Beranda dan bisa disukai pengguna lain.</DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="cvideo-file">Video</Label>
          {preview ? (
            <div className="relative rounded-lg overflow-hidden border border-border bg-black">
              <video src={preview} className="w-full max-h-44 object-contain" muted playsInline controls />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="absolute top-2 right-2"
                onClick={() => { setFile(null); setPreview(""); }}
              >
                Ganti
              </Button>
            </div>
          ) : (
            <label
              htmlFor="cvideo-file"
              className="flex flex-col items-center justify-center gap-2 h-28 rounded-lg border-2 border-dashed border-border bg-secondary/40 cursor-pointer hover:bg-secondary/70 transition-colors"
            >
              <Clapperboard className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
              <span className="text-sm text-muted-foreground">Ketuk untuk pilih video</span>
              <span className="text-[11px] text-muted-foreground/70">MP4 / WebM · maks 30 MB</span>
            </label>
          )}
          <input
            id="cvideo-file"
            type="file"
            accept="video/*"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setFile(f);
              setPreview(f ? URL.createObjectURL(f) : "");
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cvideo-title">Judul</Label>
          <Input
            id="cvideo-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Contoh: Tour Toko Kami"
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
                  "px-3 py-1.5 rounded-full text-[13px] transition-colors capitalize",
                  category === c ? "bg-primary text-primary-foreground font-semibold" : "bg-secondary text-muted-foreground hover:bg-secondary/70"
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onBack} disabled={busy}>Batal</Button>
        <Button onClick={() => void submit()} disabled={busy || !file || !title.trim()}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Kirim
        </Button>
      </DialogFooter>
    </>
  );
}
