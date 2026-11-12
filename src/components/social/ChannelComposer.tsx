"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, Send, X } from "lucide-react";
import { cn } from "@/lib/wa-utils";
import { uploadImage } from "@/lib/upload";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ChannelPostT } from "@/components/social/ChannelPostCard";

const PRESET_IMAGES = [
  "/images/product-kopi.png",
  "/images/product-keripik.png",
  "/images/product-batik.png",
  "/images/product-tas.png",
  "/images/product-madu.png",
  "/images/product-songket.png",
];

/** Komposer "Buat Unggahan" untuk channel milik sendiri: teks + foto (diunggah ke server — Batch 4). */
export default function ChannelComposer({
  channelId,
  channelName,
  onPosted,
}: {
  channelId: string;
  channelName: string;
  onPosted: (post: ChannelPostT) => void;
}) {
  const { toast } = useToast();
  const [body, setBody] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [presetOpen, setPresetOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const canSend = (body.trim().length > 0 || image !== null) && !sending && !uploading;

  async function pickFile(file: File | null | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "File harus berupa gambar", variant: "destructive" });
      return;
    }
    // Batch 4: unggah ke server saat dipilih — yang disimpan di DB hanya URL-nya
    setUploading(true);
    try {
      setImage(await uploadImage(file, "channel"));
    } catch (e) {
      toast({
        title: "Gagal mengunggah gambar",
        description: e instanceof Error ? e.message : "Coba pilih gambar lain.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    if (!canSend) return;
    setSending(true);
    try {
      const res = await fetch(`/api/channels/${channelId}/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ body: body.trim(), imageUrl: image ?? undefined }),
      });
      const data = await res.json();
      if (!res.ok || !data?.post) throw new Error(data?.error || "Gagal mengirim unggahan");
      onPosted(data.post as ChannelPostT);
      setBody("");
      setImage(null);
      setPresetOpen(false);
      toast({ title: "Unggahan terkirim", description: `Terkirim ke channel ${channelName}.` });
    } catch (e) {
      toast({
        title: "Gagal mengirim unggahan",
        description: e instanceof Error ? e.message : "Silakan coba lagi.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <Textarea
        placeholder={`Tulis unggahan untuk ${channelName}…`}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        className="border-0 p-0 focus-visible:ring-0 resize-none text-sm"
        aria-label={`Tulis unggahan untuk ${channelName}`}
        maxLength={2000}
      />

      {image ? (
        <div className="relative mt-2 w-fit">
          <img src={image} alt="Pratinjau lampiran" className="h-28 rounded-lg border border-border object-cover" />
          <button
            type="button"
            onClick={() => setImage(null)}
            className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-background shadow"
            aria-label="Hapus gambar terpilih"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}

      {presetOpen ? (
        <div className="mt-2 rounded-lg border border-dashed border-border p-2">
          <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">Pilih gambar produk:</p>
          <div className="grid grid-cols-6 gap-1.5">
            {PRESET_IMAGES.map((src) => (
              <button
                key={src}
                type="button"
                onClick={() => {
                  setImage(src);
                  setPresetOpen(false);
                }}
                className="overflow-hidden rounded-md border border-border transition hover:ring-2 hover:ring-primary/50"
                aria-label={`Gunakan gambar ${src.replace("/images/product-", "").replace(".png", "")}`}
              >
                <img src={src} alt="Gambar produk preset" className="aspect-square w-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-2 flex items-center gap-1.5">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            pickFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <Button
          variant="ghost"
          size="sm"
          className="h-8"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          type="button"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <ImagePlus className="h-4 w-4 text-primary" />}
          <span className="hidden sm:inline">{uploading ? "Mengunggah…" : "Unggah Foto"}</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8"
          type="button"
          onClick={() => setPresetOpen((v) => !v)}
          aria-expanded={presetOpen}
        >
          <span aria-hidden className="text-base leading-none">🖼️</span>
          <span className="hidden sm:inline">Gambar Produk</span>
        </Button>
        <Button size="sm" className={cn("ml-auto h-8")} onClick={submit} disabled={!canSend} type="button">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Kirim
        </Button>
      </div>
    </div>
  );
}
