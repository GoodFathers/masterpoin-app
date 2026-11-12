"use client";

// Dialog pendukung menu baru (Task 7): pesan berbintang, pesan sementara,
// tema obrolan, tambah ke daftar (label), dan dialog konfirmasi generik.

import { useCallback, useEffect, useState } from "react";
import { Loader2, Star, Timer, Palette, BookmarkPlus, Plus } from "lucide-react";
import { cn, colorOf, formatTime, waDayLabel } from "@/lib/wa-utils";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { ChatMessage, LabelRow } from "./types";

// ---------- Pesan Berbintang ----------
interface StarredRow extends ChatMessage {
  chatName: string;
}

export function StarredMessagesDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const [rows, setRows] = useState<StarredRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/messages?starred=1", { cache: "no-store" });
      const data = (await res.json()) as { messages?: StarredRow[] };
      if (res.ok) setRows(data.messages ?? []);
    } catch {
      toast({ title: "Gagal memuat pesan berbintang", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const unstar = async (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
    try {
      await fetch(`/api/messages/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ starred: false }),
      });
      toast({ title: "Bintang dihapus" });
    } catch {
      void load();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="h-4 w-4 text-amber-500 fill-amber-500" /> Pesan Berbintang
          </DialogTitle>
          <DialogDescription>
            Pesan yang Anda tandai bintang dari semua obrolan. Bintang sebuah pesan lewat menu panah di balon pesan.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-96 overflow-y-auto wa-scrollbar -mx-2 px-2 space-y-1.5 min-h-24">
          {loading &&
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
          {!loading && rows.length === 0 && (
            <div className="py-10 text-center">
              <Star className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" aria-hidden="true" />
              <p className="text-sm font-medium">Belum ada pesan berbintang</p>
              <p className="text-xs text-muted-foreground mt-1">
                Ketuk panah ▾ pada sebuah pesan lalu pilih &quot;Beri bintang&quot;.
              </p>
            </div>
          )}
          {!loading &&
            rows.map((m) => (
              <div key={m.id} className="rounded-lg border border-border p-2.5 flex items-start gap-2.5 bg-secondary/40">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold truncate">{m.senderName ?? "Pesan"}</p>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {waDayLabel(m.createdAt)} {formatTime(m.createdAt)}
                    </span>
                  </div>
                  <p className="text-[13px] text-foreground/85 line-clamp-2 break-words">
                    {m.body || `[${m.type.toLowerCase()}]`}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 truncate">dari {m.chatName}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() => void unstar(m.id)}
                  aria-label="Hapus bintang"
                >
                  <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                </Button>
              </div>
            ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Pesan Sementara ----------
const DISAPPEARING_OPTIONS: { value: string; label: string; desc: string }[] = [
  { value: "off", label: "Tidak ada", desc: "Pesan tidak akan hilang" },
  { value: "24h", label: "24 jam", desc: "Pesan baru hilang setelah 24 jam" },
  { value: "7d", label: "7 hari", desc: "Pesan baru hilang setelah 7 hari" },
  { value: "90d", label: "90 hari", desc: "Pesan baru hilang setelah 90 hari" },
];

export function DisappearingDialog({
  open,
  onOpenChange,
  chatId,
  current,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  chatId: string;
  current: string;
  onSaved: (value: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Timer className="h-4 w-4 text-primary" /> Pesan sementara
          </DialogTitle>
          <DialogDescription>Aktifkan agar pesan baru di obrolan ini hilang otomatis.</DialogDescription>
        </DialogHeader>
        {open && <DisappearingBody chatId={chatId} current={current} onSaved={onSaved} onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function DisappearingBody({
  chatId,
  current,
  onSaved,
  onClose,
}: {
  chatId: string;
  current: string;
  onSaved: (value: string) => void;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [value, setValue] = useState(current);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/chats/${chatId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disappearing: value }),
      });
      if (!res.ok) throw new Error();
      onSaved(value);
      onClose();
      toast({
        title:
          value === "off"
            ? "Pesan sementara dimatikan"
            : `Pesan sementara: ${DISAPPEARING_OPTIONS.find((o) => o.value === value)?.label}`,
      });
    } catch {
      toast({ title: "Gagal menyimpan pengaturan", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <RadioGroup value={value} onValueChange={setValue} className="gap-1">
        {DISAPPEARING_OPTIONS.map((o) => (
          <Label
            key={o.value}
            htmlFor={`dis-${o.value}`}
            className="flex items-start gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-secondary/60 transition-colors"
          >
            <RadioGroupItem id={`dis-${o.value}`} value={o.value} className="mt-0.5" />
            <span className="space-y-0.5">
              <span className="block text-sm font-medium leading-none">{o.label}</span>
              <span className="block text-xs text-muted-foreground">{o.desc}</span>
            </span>
          </Label>
        ))}
      </RadioGroup>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          Batal
        </Button>
        <Button onClick={() => void save()} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />} Simpan
        </Button>
      </DialogFooter>
    </>
  );
}

// ---------- Tema Obrolan ----------
export const CHAT_THEMES: { key: string; label: string; css: string }[] = [
  { key: "default", label: "Bawaan", css: "" },
  { key: "sage", label: "Sage", css: "linear-gradient(160deg,#f0e4e6 0%,#e2d3d6 100%)" },
  { key: "teal", label: "Maroon Muda", css: "linear-gradient(160deg,#f5e9ec 0%,#ead4d9 100%)" },
  { key: "sand", label: "Pasir", css: "linear-gradient(160deg,#f4ead8 0%,#ecdcc0 100%)" },
  { key: "lilac", label: "Lilac", css: "linear-gradient(160deg,#ece4f2 0%,#dccfe9 100%)" },
  { key: "rose", label: "Rose", css: "linear-gradient(160deg,#f6e4e6 0%,#eecdd2 100%)" },
];

export function themeBg(chatId: string): string {
  try {
    const key = window.localStorage.getItem(`wa:chatbg:${chatId}`);
    return CHAT_THEMES.find((t) => t.key === key)?.css ?? "";
  } catch {
    return "";
  }
}

export function ChatThemeDialog({
  open,
  onOpenChange,
  chatId,
  onApplied,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  chatId: string;
  onApplied: (css: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-primary" /> Tema obrolan
          </DialogTitle>
          <DialogDescription>Pilih warna latar percakapan ini. Tersimpan untuk obrolan ini saja.</DialogDescription>
        </DialogHeader>
        {open && <ThemePickerBody chatId={chatId} onApplied={onApplied} />}
      </DialogContent>
    </Dialog>
  );
}

function ThemePickerBody({ chatId, onApplied }: { chatId: string; onApplied: (css: string) => void }) {
  const { toast } = useToast();
  const [active, setActive] = useState(() => {
    try {
      return window.localStorage.getItem(`wa:chatbg:${chatId}`) ?? "default";
    } catch {
      return "default";
    }
  });

  const apply = (key: string) => {
    setActive(key);
    const css = CHAT_THEMES.find((t) => t.key === key)?.css ?? "";
    try {
      if (key === "default") window.localStorage.removeItem(`wa:chatbg:${chatId}`);
      else window.localStorage.setItem(`wa:chatbg:${chatId}`, key);
    } catch {
      // abaikan
    }
    onApplied(css);
    toast({ title: `Tema obrolan: ${CHAT_THEMES.find((t) => t.key === key)?.label}` });
  };

  return (
    <div className="grid grid-cols-3 gap-2.5">
      {CHAT_THEMES.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => apply(t.key)}
          aria-label={`Tema ${t.label}`}
          aria-pressed={active === t.key}
          className={cn(
            "h-20 rounded-xl border-2 transition-all relative overflow-hidden",
            active === t.key ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/50"
          )}
          style={{ background: t.css || "#efeae2" }}
        >
          <span className="absolute inset-x-0 bottom-0 bg-black/35 text-white text-[11px] font-medium py-0.5">
            {t.label}
          </span>
        </button>
      ))}
    </div>
  );
}

// ---------- Tambah ke Daftar (label) ----------
export function LabelsPickDialog({
  open,
  onOpenChange,
  contactId,
  initialLabelIds,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contactId: string | null;
  initialLabelIds: string[];
  onSaved: (labelIds: string[]) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookmarkPlus className="h-4 w-4 text-primary" /> Tambah ke daftar
          </DialogTitle>
          <DialogDescription>Atur obrolan ini ke dalam daftar pelanggan.</DialogDescription>
        </DialogHeader>
        {open && (
          <LabelsPickBody
            contactId={contactId}
            initialLabelIds={initialLabelIds}
            onSaved={onSaved}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function LabelsPickBody({
  contactId,
  initialLabelIds,
  onSaved,
  onClose,
}: {
  contactId: string | null;
  initialLabelIds: string[];
  onSaved: (labelIds: string[]) => void;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [labels, setLabels] = useState<LabelRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialLabelIds));
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    let alive = true;
    fetch("/api/labels", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { labels?: LabelRow[] }) => {
        if (alive) setLabels(d.labels ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const save = async () => {
    if (!contactId) return;
    try {
      const res = await fetch(`/api/contacts/${contactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ labelIds: Array.from(selected) }),
      });
      if (!res.ok) throw new Error();
      onSaved(Array.from(selected));
      onClose();
      toast({ title: "Daftar diperbarui" });
    } catch {
      toast({ title: "Gagal menyimpan daftar", variant: "destructive" });
    }
  };

  const createList = async () => {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const res = await fetch("/api/labels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = (await res.json()) as { label?: LabelRow; error?: string };
      if (!res.ok || !data.label) throw new Error(data.error);
      setLabels((prev) => [...prev, data.label!]);
      setSelected((prev) => new Set(prev).add(data.label!.id));
      setNewName("");
      toast({ title: `Daftar "${name}" dibuat` });
    } catch (err) {
      toast({
        title: "Gagal membuat daftar",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <div className="max-h-56 overflow-y-auto wa-scrollbar -mx-1 px-1 space-y-1 min-h-16">
        {loading && <Skeleton className="h-10 w-full rounded-md" />}
        {!loading && labels.length === 0 && (
          <p className="text-xs text-muted-foreground py-3 text-center">Belum ada daftar — buat satu di bawah.</p>
        )}
        {labels.map((l) => (
          <Label
            key={l.id}
            className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 cursor-pointer hover:bg-secondary/60 transition-colors"
          >
            <Checkbox checked={selected.has(l.id)} onCheckedChange={() => toggle(l.id)} />
            <span className={cn("h-2.5 w-2.5 rounded-full", colorOf(l.colorKey).dot)} aria-hidden="true" />
            <span className="text-sm">{l.name}</span>
          </Label>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nama daftar baru…"
          aria-label="Nama daftar baru"
          onKeyDown={(e) => {
            if (e.key === "Enter") void createList();
          }}
        />
        <Button variant="secondary" onClick={() => void createList()} disabled={creating || !newName.trim()}>
          <Plus className="h-4 w-4" /> Buat
        </Button>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          Batal
        </Button>
        <Button onClick={() => void save()} disabled={!contactId}>
          Simpan
        </Button>
      </DialogFooter>
    </>
  );
}

// ---------- Konfirmasi generik ----------
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive,
  onConfirm,
  children,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
  children?: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button
            onClick={() => {
              onOpenChange(false);
              onConfirm();
            }}
            className={destructive ? "bg-destructive text-white hover:bg-destructive/90" : undefined}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
