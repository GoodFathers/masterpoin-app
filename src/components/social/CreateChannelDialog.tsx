"use client";

import { useState } from "react";
import { Check, Loader2, Plus, Radio } from "lucide-react";
import { cn, colorOf } from "@/lib/wa-utils";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ChannelPostT } from "@/components/social/ChannelPostCard";

export type ChannelT = {
  id: string;
  name: string;
  handle: string;
  description: string;
  colorKey: string;
  imageUrl: string | null;
  coverUrl: string;
  followers: number;
  following: boolean;
  isMine: boolean;
  verified: boolean;
  posts: ChannelPostT[];
  _count?: { posts: number }; // total unggahan dari API (posts array dibatasi 10 terbaru)
};

const COLOR_OPTIONS = ["emerald", "amber", "purple", "teal", "pink"] as const;

/** Dialog "Buat Channel": nama, deskripsi, pilihan warna → POST /api/channels. */
export default function CreateChannelDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (channel: ChannelT) => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [colorKey, setColorKey] = useState<string>("emerald");
  const [saving, setSaving] = useState(false);

  const valid = name.trim().length > 0;

  async function submit() {
    if (!valid || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ name: name.trim(), description: description.trim(), colorKey }),
      });
      const data = await res.json();
      if (!res.ok || !data?.channel) throw new Error(data?.error || "Gagal membuat channel");
      onCreated(data.channel as ChannelT);
      toast({ title: "Channel dibuat", description: `Channel "${data.channel.name}" siap digunakan.` });
      setName("");
      setDescription("");
      setColorKey("emerald");
      onOpenChange(false);
    } catch (e) {
      toast({
        title: "Gagal membuat channel",
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
            <Radio className="h-5 w-5 text-primary" />
            Buat Channel
          </DialogTitle>
          <DialogDescription>
            Channel adalah cara satu arah untuk menyiarkan kabar produk & promo ke pengikut Anda.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="channel-name">Nama channel</Label>
            <Input
              id="channel-name"
              placeholder="cth. IndiGoo Promo"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="channel-desc">Deskripsi (opsional)</Label>
            <Textarea
              id="channel-desc"
              placeholder="Ceritakan isi channel Anda…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={200}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Warna avatar</Label>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Pilih warna avatar channel">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={colorKey === c}
                  aria-label={`Warna ${c}`}
                  title={c.charAt(0).toUpperCase() + c.slice(1)}
                  onClick={() => setColorKey(c)}
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all",
                    colorOf(c).bg,
                    colorKey === c
                      ? "scale-110 border-foreground/70 shadow-md"
                      : "border-transparent hover:scale-105 hover:border-border"
                  )}
                >
                  {colorKey === c ? <Check className="h-5 w-5 text-white" aria-hidden /> : null}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Batal
          </Button>
          <Button onClick={submit} disabled={!valid || saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Buat Channel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
