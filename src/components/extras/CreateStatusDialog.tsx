"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/wa-utils";
import { uploadImage, MAX_UPLOAD_MB } from "@/lib/upload";
import { useToast } from "@/hooks/use-toast";

const BG_OPTIONS: { key: string; cls: string; ring: string; label: string }[] = [
  { key: "emerald", cls: "bg-maroon-600", ring: "ring-maroon-600", label: "Maroon" },
  { key: "amber", cls: "bg-amber-500", ring: "ring-amber-500", label: "Kuning" },
  { key: "purple", cls: "bg-purple-600", ring: "ring-purple-600", label: "Ungu" },
  { key: "pink", cls: "bg-pink-600", ring: "ring-pink-600", label: "Merah muda" },
  { key: "teal", cls: "bg-maroon-800", ring: "ring-maroon-800", label: "Maroon tua" },
];

export default function CreateStatusDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const [tab, setTab] = useState("teks");
  const [text, setText] = useState("");
  const [bg, setBg] = useState("emerald");
  const [photo, setPhoto] = useState("");
  const [caption, setCaption] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setText("");
    setBg("emerald");
    setPhoto("");
    setCaption("");
    setTab("teks");
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    // Batch 4: foto status diunggah ke server (URL), bukan base64 di DB
    setUploading(true);
    try {
      setPhoto(await uploadImage(f, "photo"));
    } catch (err) {
      toast({
        title: "Gagal mengunggah foto",
        description: err instanceof Error ? err.message : `Maksimal ${MAX_UPLOAD_MB} MB. Coba file lain.`,
        variant: "destructive",
      });
      setPhoto("");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const submit = async () => {
    const isImage = tab === "foto";
    if (isImage && !photo) {
      toast({ title: "Pilih foto dulu", description: "Ketuk area foto untuk memilih gambar.", variant: "destructive" });
      return;
    }
    if (!isImage && !text.trim()) {
      toast({ title: "Tulis sesuatu", description: "Status teks tidak boleh kosong.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          mediaType: isImage ? "IMAGE" : "TEXT",
          body: isImage ? caption.trim() : text.trim(),
          mediaUrl: isImage ? photo : undefined,
          bgColor: isImage ? undefined : bg,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.error ?? "Gagal menayangkan status");
      }
      toast({ title: "Status tayang 🎉", description: "Status otomatis hilang dalam 24 jam." });
      reset();
      onCreated();
    } catch (err) {
      toast({
        title: "Gagal menayangkan status",
        description: err instanceof Error ? err.message : "Coba lagi.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const activeBg = BG_OPTIONS.find((b) => b.key === bg) ?? BG_OPTIONS[0];

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4 text-primary" /> Tambah Status
          </DialogTitle>
          <DialogDescription>Status terlihat selama 24 jam untuk kontak Anda.</DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="teks">Teks</TabsTrigger>
            <TabsTrigger value="foto">Foto</TabsTrigger>
          </TabsList>

          {/* ---------- TAB TEKS ---------- */}
          <TabsContent value="teks" className="mt-3 space-y-3">
            <div
              className={cn(
                "h-44 rounded-2xl flex items-center justify-center px-6 text-center transition-colors",
                activeBg.cls
              )}
              aria-hidden="true"
            >
              <p className="text-white text-lg font-medium leading-snug line-clamp-4 whitespace-pre-wrap break-words">
                {text || "Pratinjau status Anda…"}
              </p>
            </div>
            <div>
              <Label htmlFor="story-text" className="sr-only">
                Teks status
              </Label>
              <Textarea
                id="story-text"
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, 700))}
                placeholder="Tulis status… mis. promo hari ini"
                rows={3}
                maxLength={700}
              />
              <p className="text-[11px] text-muted-foreground mt-1 text-right">{text.length}/700</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Warna latar</p>
              <div className="flex items-center gap-2.5">
                {BG_OPTIONS.map((b) => (
                  <button
                    key={b.key}
                    type="button"
                    onClick={() => setBg(b.key)}
                    aria-label={`Warna ${b.label}`}
                    aria-pressed={bg === b.key}
                    className={cn(
                      "h-9 w-9 rounded-full transition-transform hover:scale-110 focus-visible:outline-none",
                      b.cls,
                      bg === b.key ? "ring-2 ring-offset-2 " + b.ring : ""
                    )}
                  />
                ))}
              </div>
            </div>
          </TabsContent>

          {/* ---------- TAB FOTO ---------- */}
          <TabsContent value="foto" className="mt-3 space-y-3">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full h-44 rounded-2xl border-2 border-dashed border-border overflow-hidden bg-muted/40 flex items-center justify-center hover:bg-muted/70 transition-colors"
              aria-label="Pilih foto untuk status"
            >
              {photo ? (
                <img src={photo} alt="Pratinjau foto status" className="w-full h-full object-cover" />
              ) : (
                <span className="flex flex-col items-center gap-2 text-muted-foreground">
                  {uploading ? (
                    <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
                  ) : (
                    <ImagePlus className="h-8 w-8" />
                  )}
                  <span className="text-sm font-medium">{uploading ? "Mengunggah foto…" : "Ketuk untuk pilih foto"}</span>
                  <span className="text-[11px]">Maksimal {MAX_UPLOAD_MB} MB</span>
                </span>
              )}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onFile}
              aria-label="Unggah foto status"
            />
            <div>
              <Label htmlFor="story-caption">Keterangan (opsional)</Label>
              <Input
                id="story-caption"
                value={caption}
                onChange={(e) => setCaption(e.target.value.slice(0, 200))}
                placeholder="Mis. Menu baru segar dari dapur kami!"
                maxLength={200}
              />
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Batal
          </Button>
          <Button onClick={submit} disabled={submitting || uploading} className="min-w-28">
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Menayangkan…
              </>
            ) : (
              "Bagikan Status"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
