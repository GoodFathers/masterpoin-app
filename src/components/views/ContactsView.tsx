"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookUser,
  Loader2,
  Search,
  MessageCircle,
  UserRoundSearch,
  UserPlus,
  MoreVertical,
  Pencil,
  ShieldBan,
  ShieldCheck,
  Trash2,
  ServerCrash,
  RotateCcw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ViewHeader from "@/components/business/ViewHeader";
import EmptyState from "@/components/business/EmptyState";
import ChatAvatar from "@/components/chat/ChatAvatar";
import { ConfirmDialog } from "@/components/chat/ChatMenus";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ViewId } from "@/components/AppShell";
import type { ContactRow } from "@/components/chat/types";
import { WIB_TZ } from "@/lib/wa-utils";
import { wibDateKey } from "@/lib/wib";

/** Terjemahan lastSeen ke teks singkat (contoh: "Terakhir dilihat baru saja"). */
function lastSeenText(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (wibDateKey(d) === wibDateKey(new Date())) {
    return `Terakhir dilihat ${d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: WIB_TZ })}`;
  }
  return `Terakhir dilihat ${d.toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: WIB_TZ })}`;
}

export default function ContactsView({ onNavigate }: { onNavigate?: (view: ViewId) => void }) {
  const { toast } = useToast();
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [starting, setStarting] = useState<string | null>(null);
  const [q, setQ] = useState("");

  // Batch 5: kontak tak lagi read-only
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ContactRow | null>(null);
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formAbout, setFormAbout] = useState("");
  const [formBusy, setFormBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ContactRow | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await fetch("/api/contacts", { cache: "no-store" });
      if (!res.ok) throw new Error("gagal");
      const data = (await res.json()) as { contacts?: ContactRow[] };
      setContacts(data.contacts ?? []);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Tombol "+ Tambah Kontak" di pojok kanan top bar AppShell (mobile) memicu event ini
  useEffect(() => {
    const openNew = () => {
      setEditTarget(null);
      setFormName("");
      setFormPhone("");
      setFormAbout("");
      setFormOpen(true);
    };
    window.addEventListener("wa:contacts:new", openNew);
    return () => window.removeEventListener("wa:contacts:new", openNew);
  }, []);

  const openAdd = () => {
    setEditTarget(null);
    setFormName("");
    setFormPhone("");
    setFormAbout("");
    setFormOpen(true);
  };

  const openEdit = (c: ContactRow) => {
    setEditTarget(c);
    setFormName(c.name);
    setFormPhone(c.phone);
    setFormAbout(c.about ?? "");
    setFormOpen(true);
  };

  const submitForm = async () => {
    if (formBusy) return;
    if (!formName.trim()) {
      toast({ title: "Nama wajib diisi", variant: "destructive" });
      return;
    }
    if (!editTarget && formPhone.replace(/\D/g, "").length < 6) {
      toast({ title: "Nomor telepon tidak valid", description: "Minimal 6 angka, contoh: +6281234567890", variant: "destructive" });
      return;
    }
    setFormBusy(true);
    try {
      const res = await fetch(editTarget ? `/api/contacts/${editTarget.id}` : "/api/contacts", {
        method: editTarget ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          editTarget
            ? { name: formName, about: formAbout }
            : { name: formName, phone: formPhone, about: formAbout }
        ),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error || "Gagal menyimpan kontak");
      toast({
        title: editTarget ? "Kontak diperbarui" : "Kontak ditambahkan",
        description: editTarget ? formName : `${formName} kini ada di daftar kontak Anda.`,
      });
      setFormOpen(false);
      await load();
    } catch (err) {
      toast({ title: "Gagal menyimpan kontak", description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    } finally {
      setFormBusy(false);
    }
  };

  const toggleBlock = async (c: ContactRow) => {
    const next = !c.blocked;
    setContacts((prev) => prev.map((x) => (x.id === c.id ? { ...x, blocked: next } : x)));
    try {
      const res = await fetch(`/api/contacts/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocked: next }),
      });
      if (!res.ok) throw new Error();
      toast({ title: next ? "Kontak diblokir" : "Blokir dibuka", description: c.name });
    } catch {
      setContacts((prev) => prev.map((x) => (x.id === c.id ? { ...x, blocked: c.blocked } : x)));
      toast({ title: "Gagal mengubah blokir", variant: "destructive" });
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget || deleteBusy) return;
    setDeleteBusy(true);
    try {
      const res = await fetch(`/api/contacts/${deleteTarget.id}`, { method: "DELETE" });
      const data = (await res.json().catch(() => null)) as { error?: string; removedChats?: number } | null;
      if (!res.ok) throw new Error(data?.error || "Gagal menghapus kontak");
      toast({
        title: "Kontak dihapus",
        description: data?.removedChats
          ? `${deleteTarget.name} beserta ${data.removedChats} chat terkait dihapus.`
          : `${deleteTarget.name} dihapus dari daftar kontak.`,
      });
      setDeleteTarget(null);
      await load();
    } catch (err) {
      toast({ title: "Gagal menghapus kontak", description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    } finally {
      setDeleteBusy(false);
    }
  };

  const startChat = async (c: ContactRow) => {
    if (c.blocked) {
      toast({ title: "Kontak diblokir", description: "Buka blokir kontak ini untuk mengirim pesan.", variant: "destructive" });
      return;
    }
    setStarting(c.id);
    try {
      const res = await fetch("/api/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "PRIVATE", contactId: c.id }),
      });
      const data = (await res.json()) as { chat?: { id: string }; error?: string };
      if (!res.ok || !data.chat) throw new Error(data.error || "Gagal membuka chat");
      toast({ title: `Chat dengan ${c.name} siap`, description: "Anda dibawa ke daftar chat." });
      onNavigate?.("chats");
    } catch (err) {
      toast({ title: "Gagal membuka chat", description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    } finally {
      setStarting(null);
    }
  };

  const filtered = useMemo(
    () =>
      contacts.filter(
        (c) =>
          c.name.toLowerCase().includes(q.toLowerCase()) ||
          c.phone.toLowerCase().includes(q.toLowerCase()) ||
          (c.about ?? "").toLowerCase().includes(q.toLowerCase())
      ),
    [contacts, q]
  );

  const formValid = editTarget ? formName.trim().length > 0 : formName.trim().length > 0 && formPhone.replace(/\D/g, "").length >= 6;

  return (
    <div className="h-full flex flex-col">
      {/* Header internal hanya desktop — di mobile judul tampil di top bar AppShell
          & tombol "+ Tambah Kontak" pindah ke pojok kanan atas (event wa:contacts:new) */}
      <ViewHeader
        icon={BookUser}
        title="Kontak"
        subtitle={loading ? "Memuat..." : `${contacts.length} kontak tersimpan`}
        className="hidden md:flex"
        actions={
          <Button size="sm" className="gap-1.5" onClick={openAdd}>
            <UserPlus className="h-4 w-4" /> Tambah Kontak
          </Button>
        }
      />

      {/* Pencarian — tampil di mobile & desktop */}
      <div className="shrink-0 px-3 sm:px-4 py-2.5 border-b border-border bg-sidebar/70">
        <div className="relative max-w-3xl mx-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari nama, nomor, atau status…"
            aria-label="Cari kontak"
            className="pl-9 bg-secondary border-transparent h-10 rounded-xl"
          />
        </div>
      </div>

      {/* Daftar */}
      <div className="flex-1 min-h-0 overflow-y-auto wa-scrollbar pb-8" role="list" aria-label="Daftar kontak">
        {loading && (
          <div className="space-y-1 px-3 py-2 max-w-3xl mx-auto" aria-hidden="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-2.5">
                <Skeleton className="h-11 w-11 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-1/3" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
                <Skeleton className="h-8 w-8 rounded-full" />
              </div>
            ))}
          </div>
        )}

        {/* Batch 5: galat jaringan tidak lagi tampil sebagai "belum ada kontak" */}
        {!loading && loadError && (
          <div className="max-w-3xl mx-auto px-4 pt-10">
            <div
              role="alert"
              className="rounded-2xl border border-border bg-card p-6 text-center"
            >
              <ServerCrash className="h-10 w-10 text-muted-foreground/60 mx-auto mb-3" aria-hidden="true" />
              <p className="text-sm font-semibold">Gagal memuat kontak</p>
              <p className="text-xs text-muted-foreground mt-1 mb-4">
                Periksa koneksi Anda lalu coba lagi.
              </p>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => void load()}>
                <RotateCcw className="h-3.5 w-3.5" /> Coba lagi
              </Button>
            </div>
          </div>
        )}

        {!loading && !loadError && filtered.length === 0 && (
          <EmptyState
            icon={q ? UserRoundSearch : BookUser}
            title={q ? "Tidak ada kontak cocok" : "Belum ada kontak"}
            description={
              q
                ? "Coba kata kunci lain — nama, nomor telepon, atau status."
                : "Simpan kontak pelanggan agar mudah dihubungi kapan saja."
            }
          />
        )}

        {!loading &&
          !loadError &&
          filtered.map((c) => (
            <div
              key={c.id}
              role="listitem"
              className="max-w-3xl mx-auto flex items-center gap-3 px-3 sm:px-4 py-2.5 border-b border-border/60 last:border-b-0 hover:bg-secondary/50 transition-colors"
            >
              <ChatAvatar name={c.name} colorKey={c.colorKey} className="h-11 w-11 shrink-0" />
              <button
                type="button"
                onClick={() => void startChat(c)}
                className="flex-1 min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg"
                aria-label={`Lihat detail atau kirim pesan ke ${c.name}`}
              >
                <p className="text-[15px] font-medium truncate flex items-center gap-2">
                  {c.name}
                  {c.blocked && (
                    <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                      Diblokir
                    </Badge>
                  )}
                </p>
                <p className="text-[13px] text-muted-foreground truncate">{c.phone}</p>
                <p className="text-[12px] text-muted-foreground/80 truncate">{c.about ?? "Tersedia"}</p>
              </button>
              <div className="hidden sm:block shrink-0 text-right">
                <p className="text-[11px] text-muted-foreground/70">{lastSeenText(c.lastSeen)}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0"
                aria-label={`Kirim pesan ke ${c.name}`}
                disabled={starting === c.id || c.blocked}
                onClick={() => void startChat(c)}
              >
                {starting === c.id ? (
                  <Loader2 className="h-5 w-5 text-primary animate-spin" />
                ) : (
                  <MessageCircle className="h-5 w-5 text-primary" />
                )}
              </Button>
              {/* Menu kontak: ubah, blokir, hapus (Batch 5) */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-muted-foreground"
                    aria-label={`Menu kontak ${c.name}`}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem className="gap-2 cursor-pointer" onSelect={() => openEdit(c)}>
                    <Pencil className="h-4 w-4" /> Ubah kontak
                  </DropdownMenuItem>
                  <DropdownMenuItem className="gap-2 cursor-pointer" onSelect={() => void toggleBlock(c)}>
                    {c.blocked ? (
                      <>
                        <ShieldCheck className="h-4 w-4" /> Buka blokir
                      </>
                    ) : (
                      <>
                        <ShieldBan className="h-4 w-4" /> Blokir kontak
                      </>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="gap-2 cursor-pointer text-red-600 focus:text-red-600"
                    onSelect={() => setDeleteTarget(c)}
                  >
                    <Trash2 className="h-4 w-4" /> Hapus kontak
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
      </div>

      {/* Dialog tambah/ubah kontak */}
      <Dialog open={formOpen} onOpenChange={(v) => { if (!formBusy) setFormOpen(v); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editTarget ? "Ubah Kontak" : "Tambah Kontak"}</DialogTitle>
            <DialogDescription>
              {editTarget
                ? "Perbarui nama atau status tentang kontak ini."
                : "Simpan nomor pelanggan agar mudah ditemukan saat chat."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3.5 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="kontak-nama">Nama</Label>
              <Input
                id="kontak-nama"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="cth. Ibu Sari"
                maxLength={80}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="kontak-nomor">Nomor WhatsApp</Label>
              <Input
                id="kontak-nomor"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
                placeholder="cth. +62 812-3456-7890"
                inputMode="tel"
                disabled={!!editTarget}
                maxLength={24}
              />
              {editTarget && (
                <p className="text-[11px] text-muted-foreground">Nomor tidak dapat diubah.</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="kontak-tentang">Tentang (opsional)</Label>
              <Input
                id="kontak-tentang"
                value={formAbout}
                onChange={(e) => setFormAbout(e.target.value)}
                placeholder="cth. Pelanggan langganan kopi"
                maxLength={120}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setFormOpen(false)} disabled={formBusy}>
              Batal
            </Button>
            <Button onClick={() => void submitForm()} disabled={formBusy || !formValid} className="gap-1.5">
              {formBusy && <Loader2 className="h-4 w-4 animate-spin" />}
              {editTarget ? "Simpan" : "Simpan Kontak"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Konfirmasi hapus kontak */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => { if (!deleteBusy) setDeleteTarget(v ? deleteTarget : null); }}
        title={`Hapus ${deleteTarget?.name ?? "kontak"}?`}
        description={
          deleteTarget
            ? `Kontak ini akan dihapus permanen${deleteTarget.blocked ? "" : ""}. Chat yang tertaut dengan kontak ini beserta seluruh pesannya juga ikut terhapus.`
            : ""
        }
        confirmLabel="Hapus"
        destructive
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
