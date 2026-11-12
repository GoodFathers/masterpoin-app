"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Search, UsersRound } from "lucide-react";
import { cn } from "@/lib/wa-utils";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import ChatAvatar from "./ChatAvatar";
import type { ChatSummary, ContactRow } from "./types";

interface NewChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (chat: ChatSummary) => void;
}

/** Dialog pilih kontak untuk memulai chat pribadi baru. */
export function NewChatDialog({ open, onOpenChange, onCreated }: NewChatDialogProps) {
  const { toast } = useToast();
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setQ("");
    fetch("/api/contacts", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { contacts?: ContactRow[] }) => setContacts(d.contacts ?? []))
      .catch(() => toast({ title: "Gagal memuat kontak", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [open, toast]);

  const filtered = useMemo(
    () =>
      contacts.filter(
        (c) => c.name.toLowerCase().includes(q.toLowerCase()) || c.phone.toLowerCase().includes(q.toLowerCase())
      ),
    [contacts, q]
  );

  const start = async (contact: ContactRow) => {
    setCreating(contact.id);
    try {
      const res = await fetch("/api/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "PRIVATE", contactId: contact.id }),
      });
      const data = (await res.json()) as { chat?: ChatSummary; error?: string };
      if (!res.ok || !data.chat) throw new Error(data.error || "Gagal membuat chat");
      onCreated(data.chat);
      onOpenChange(false);
    } catch (err) {
      toast({ title: "Gagal membuka chat", description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    } finally {
      setCreating(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle>Chat Baru</DialogTitle>
          <DialogDescription>Pilih kontak untuk memulai percakapan.</DialogDescription>
        </DialogHeader>
        <div className="px-6 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari kontak…"
              aria-label="Cari kontak"
              className="pl-9 bg-secondary border-transparent"
            />
          </div>
        </div>
        <ScrollArea className="h-72 px-2 pb-4">
          {loading && (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" aria-label="Memuat" />
            </div>
          )}
          {!loading && filtered.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-10">Tidak ada kontak ditemukan.</p>
          )}
          {filtered.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => start(c)}
              disabled={creating !== null}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-secondary text-left transition-colors disabled:opacity-60"
              aria-label={`Mulai chat dengan ${c.name}`}
            >
              <ChatAvatar name={c.name} colorKey={c.colorKey} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{c.name}</p>
                <p className="text-xs text-muted-foreground truncate">{c.phone}</p>
              </div>
              {c.blocked && <span className="text-[10px] text-red-500 font-medium shrink-0">Diblokir</span>}
              {creating === c.id && <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" aria-label="Membuat" />}
            </button>
          ))}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

/** Dialog buat grup baru: nama + pilih anggota. */
export function NewGroupDialog({ open, onOpenChange, onCreated }: NewChatDialogProps) {
  const { toast } = useToast();
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setName("");
    setSelected([]);
    fetch("/api/contacts", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { contacts?: ContactRow[] }) => setContacts(d.contacts ?? []))
      .catch(() => toast({ title: "Gagal memuat kontak", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [open, toast]);

  const toggle = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const create = async () => {
    if (!name.trim()) {
      toast({ title: "Nama grup wajib diisi", variant: "destructive" });
      return;
    }
    if (selected.length === 0) {
      toast({ title: "Pilih minimal satu anggota", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "GROUP", name: name.trim(), memberIds: selected }),
      });
      const data = (await res.json()) as { chat?: ChatSummary; error?: string };
      if (!res.ok || !data.chat) throw new Error(data.error || "Gagal membuat grup");
      toast({ title: "Grup berhasil dibuat", description: `${name.trim()} • ${selected.length} anggota` });
      onCreated(data.chat);
      onOpenChange(false);
    } catch (err) {
      toast({ title: "Gagal membuat grup", description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <span className="h-9 w-9 rounded-full bg-primary/15 text-primary flex items-center justify-center">
              <UsersRound className="h-[18px] w-[18px]" aria-hidden="true" />
            </span>
            Grup Baru
          </DialogTitle>
          <DialogDescription>Beri nama grup dan pilih anggotanya.</DialogDescription>
        </DialogHeader>
        <div className="px-6 pb-2 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="group-name">Nama grup</Label>
            <Input
              id="group-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Grup Pelanggan Setia"
              maxLength={60}
            />
          </div>
          <div className="space-y-1.5">
            <Label>
              Anggota <span className="text-muted-foreground font-normal">({selected.length} dipilih)</span>
            </Label>
            <ScrollArea className="h-56 rounded-lg border border-border px-2 py-1">
              {loading && (
                <div className="flex items-center justify-center py-10 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" aria-label="Memuat" />
                </div>
              )}
              {contacts.map((c) => (
                <label
                  key={c.id}
                  className={cn(
                    "flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-secondary cursor-pointer transition-colors",
                    c.blocked && "opacity-50"
                  )}
                >
                  <Checkbox
                    checked={selected.includes(c.id)}
                    onCheckedChange={() => toggle(c.id)}
                    disabled={c.blocked}
                    aria-label={`Pilih ${c.name}`}
                  />
                  <ChatAvatar name={c.name} colorKey={c.colorKey} className="h-8 w-8" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{c.phone}</p>
                  </div>
                  {c.blocked && <span className="text-[10px] text-red-500 shrink-0">Diblokir</span>}
                </label>
              ))}
            </ScrollArea>
          </div>
        </div>
        <DialogFooter className="px-6 pb-6">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button onClick={create} disabled={submitting} className="gap-2">
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Buat Grup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
