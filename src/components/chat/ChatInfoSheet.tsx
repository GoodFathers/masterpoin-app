"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Lock, Phone, Tag, UserRoundX, Users } from "lucide-react";
import { cn, colorOf, timeAgo } from "@/lib/wa-utils";
import { useToast } from "@/hooks/use-toast";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import ChatAvatar from "./ChatAvatar";
import type { ChatSummary, LabelRow, Participant } from "./types";

interface ChatInfoSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chat: ChatSummary;
  participants: Participant[];
  mediaCount: number;
  onContactUpdated: () => void;
}

export default function ChatInfoSheet({
  open,
  onOpenChange,
  chat,
  participants,
  mediaCount,
  onContactUpdated,
}: ChatInfoSheetProps) {
  const { toast } = useToast();
  const contact = chat.contact;
  const isGroup = chat.type === "GROUP";

  const [labels, setLabels] = useState<LabelRow[]>([]);
  const [labelsLoading, setLabelsLoading] = useState(false);
  const [blocked, setBlocked] = useState(contact?.blocked ?? false);
  const [togglingBlock, setTogglingBlock] = useState(false);

  useEffect(() => {
    setBlocked(contact?.blocked ?? false);
  }, [contact?.blocked, contact?.id, open]);

  // Label (readonly) dari route milik 3-b — gagal diabaikan
  useEffect(() => {
    if (!open) return;
    setLabelsLoading(true);
    fetch("/api/labels", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { labels?: LabelRow[] }) => setLabels(d.labels ?? []))
      .catch(() => setLabels([]))
      .finally(() => setLabelsLoading(false));
  }, [open]);

  const contactLabels = useMemo(() => {
    if (!contact) return [];
    try {
      const ids = JSON.parse(contact.labelIds) as string[];
      return labels.filter((l) => ids.includes(l.id));
    } catch {
      return [];
    }
  }, [contact, labels]);

  const toggleBlock = async () => {
    if (!contact) return;
    setTogglingBlock(true);
    const next = !blocked;
    try {
      const res = await fetch(`/api/contacts/${contact.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocked: next }),
      });
      if (!res.ok) throw new Error();
      setBlocked(next);
      toast({ title: next ? "Kontak diblokir" : "Blokir dibuka", description: contact.name });
      onContactUpdated();
    } catch {
      toast({ title: "Gagal memperbarui blokir", variant: "destructive" });
    } finally {
      setTogglingBlock(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="p-0 w-full sm:max-w-md overflow-y-auto wa-scrollbar">
        <SheetHeader className="p-6 pb-3 text-center items-center">
          <ChatAvatar
            name={chat.name}
            colorKey={chat.colorKey}
            avatarUrl={chat.avatarUrl}
            className="h-24 w-24"
            iconClassName="text-3xl"
          />
          <SheetTitle className="text-xl mt-2">{chat.name}</SheetTitle>
          <SheetDescription>
            {isGroup ? `${participants.length} anggota` : contact?.phone || "—"}
          </SheetDescription>
          {!isGroup && contact && (
            <p className="text-xs text-muted-foreground">
              {contact.lastSeen && Date.now() - new Date(contact.lastSeen).getTime() < 2 * 60_000
                ? "online"
                : contact.lastSeen
                  ? `terakhir dilihat ${timeAgo(contact.lastSeen)}`
                  : "offline"}
            </p>
          )}
        </SheetHeader>

        <div className="px-4 pb-8 space-y-4">
          {/* Deskripsi / About */}
          <section className="rounded-xl border border-border bg-white dark:bg-secondary overflow-hidden">
            <div className="px-4 py-3">
              <p className="text-xs text-muted-foreground mb-0.5">{isGroup ? "Deskripsi grup" : "Tentang"}</p>
              <p className="text-sm">{isGroup ? chat.groupDesc || "Tidak ada deskripsi" : contact?.about || "Tersedia"}</p>
            </div>
            <Separator />
            <div className="px-4 py-3 flex items-center justify-between">
              <p className="text-sm">Media, tautan, dan dokumen</p>
              <span className="text-xs text-muted-foreground">{mediaCount} item</span>
            </div>
          </section>

          {/* Label (readonly) */}
          {!isGroup && (
            <section className="rounded-xl border border-border bg-white dark:bg-secondary px-4 py-3">
              <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5" aria-hidden="true" /> Label
              </p>
              {labelsLoading ? (
                <div className="flex gap-2">
                  <Skeleton className="h-6 w-24 rounded-full" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
              ) : contactLabels.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {contactLabels.map((l) => (
                    <span
                      key={l.id}
                      className={cn(
                        "text-xs font-medium px-2.5 py-1 rounded-full",
                        colorOf(l.colorKey).soft,
                        colorOf(l.colorKey).text
                      )}
                    >
                      {l.name}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Belum ada label</p>
              )}
            </section>
          )}

          {/* Anggota grup */}
          {isGroup && (
            <section>
              <p className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5 px-1">
                <Users className="h-3.5 w-3.5" aria-hidden="true" /> Anggota
              </p>
              <div className="rounded-xl border border-border bg-white dark:bg-secondary divide-y divide-border/70 max-h-72 overflow-y-auto wa-scrollbar">
                {participants.length === 0 && (
                  <p className="text-sm text-muted-foreground px-4 py-3">Belum ada anggota.</p>
                )}
                {participants.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                    <ChatAvatar name={p.name} colorKey={p.colorKey} className="h-9 w-9" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      {p.role === "admin" && <p className="text-[11px] text-primary">Admin grup</p>}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Blokir kontak */}
          {!isGroup && contact && (
            <section className="rounded-xl border border-border bg-white dark:bg-secondary px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className={cn("h-9 w-9 rounded-full flex items-center justify-center shrink-0", blocked ? "bg-red-100 text-red-500" : "bg-secondary text-muted-foreground")}>
                  {blocked ? <Lock className="h-4 w-4" /> : <UserRoundX className="h-4 w-4" />}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium">Blokir kontak</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {blocked ? "Kontak tidak dapat mengirim pesan" : "Kontak dapat mengirim pesan"}
                  </p>
                </div>
              </div>
              <Switch
                checked={blocked}
                onCheckedChange={toggleBlock}
                disabled={togglingBlock}
                aria-label={blocked ? "Buka blokir kontak" : "Blokir kontak"}
              />
            </section>
          )}

          {/* Nomor telepon (PRIVATE) */}
          {!isGroup && contact && (
            <section className="rounded-xl border border-border bg-white dark:bg-secondary px-4 py-3 flex items-center gap-3">
              <span className="h-9 w-9 rounded-full bg-secondary text-muted-foreground flex items-center justify-center shrink-0">
                <Phone className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium">{contact.phone}</p>
                <p className="text-xs text-muted-foreground">Nomor telepon</p>
              </div>
            </section>
          )}

          {togglingBlock && (
            <p className="text-xs text-muted-foreground flex items-center gap-2 justify-center">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Menyimpan…
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
