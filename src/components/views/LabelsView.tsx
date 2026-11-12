"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useIsDesktop } from "@/lib/useIsDesktop";
import {
  Tags,
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  UserPlus,
  Users,
  Tag,
  Search,
  Loader2,
} from "lucide-react";
import { cn, colorOf, getInitials } from "@/lib/wa-utils";
import { useToast } from "@/hooks/use-toast";
import ViewHeader from "@/components/business/ViewHeader";
import EmptyState from "@/components/business/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label as UiLabel } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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
import { VALID_COLOR_KEYS, type ContactWithLabels, type Label } from "@/components/business/types";

// ===================== Chip label kecil =====================
function LabelChip({ label }: { label: Label }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium">
      <span className={cn("h-2 w-2 rounded-full shrink-0", colorOf(label.colorKey).dot)} aria-hidden="true" />
      {label.name}
    </span>
  );
}

// ===================== Dialog buat/edit label =====================
function LabelDialog({
  open,
  onOpenChange,
  label,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  label: Label | null;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [colorKey, setColorKey] = useState<string>("amber");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(label?.name ?? "");
      setColorKey(label?.colorKey ?? "amber");
    }
  }, [open, label]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: "Nama label wajib diisi", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(label ? `/api/labels/${label.id}` : "/api/labels", {
        method: label ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), colorKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan label");
      toast({ title: label ? "Label diperbarui" : "Label dibuat", description: name.trim() });
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast({ title: "Gagal menyimpan", description: e instanceof Error ? e.message : "Coba lagi", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{label ? "Edit Label" : "Label Baru"}</DialogTitle>
          <DialogDescription>Label membantu mengelompokkan pelanggan, cth. &quot;Reseller&quot; atau &quot;Prospek&quot;.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <UiLabel htmlFor="label-name">Nama label</UiLabel>
            <Input
              id="label-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="cth. Pelanggan Setia"
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
            />
          </div>
          <div className="space-y-1.5">
            <UiLabel>Warna</UiLabel>
            <Select value={colorKey} onValueChange={setColorKey}>
              <SelectTrigger aria-label="Pilih warna label">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VALID_COLOR_KEYS.map((k) => (
                  <SelectItem key={k} value={k}>
                    <span className="flex items-center gap-2">
                      <span className={cn("h-3 w-3 rounded-full", colorOf(k).dot)} aria-hidden="true" />
                      <span className="capitalize">{k}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Batal
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {label ? "Simpan" : "Buat Label"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===================== Dialog terapkan label -> kontak =====================
function AssignLabelDialog({
  label,
  contacts,
  onSetLabels,
  onClose,
}: {
  label: Label;
  contacts: ContactWithLabels[];
  onSetLabels: (contactId: string, ids: string[]) => Promise<void>;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string[]>([]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return contacts;
    return contacts.filter((c) => c.name.toLowerCase().includes(query) || c.phone.toLowerCase().includes(query));
  }, [contacts, q]);

  const toggle = async (c: ContactWithLabels) => {
    const has = c.labels.some((l) => l.id === label.id);
    const ids = has ? c.labels.map((l) => l.id).filter((id) => id !== label.id) : [...c.labels.map((l) => l.id), label.id];
    setBusy((prev) => [...prev, c.id]);
    try {
      await onSetLabels(c.id, ids);
    } catch {
      // toast sudah ditampilkan oleh parent
    } finally {
      setBusy((prev) => prev.filter((x) => x !== c.id));
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className={cn("h-3 w-3 rounded-full", colorOf(label.colorKey).dot)} aria-hidden="true" />
            Terapkan label &quot;{label.name}&quot;
          </DialogTitle>
          <DialogDescription>Centang kontak yang akan diberi label ini.</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama / nomor kontak..." className="pl-9 h-9" aria-label="Cari kontak" />
        </div>
        <div className="max-h-96 overflow-y-auto wa-scrollbar -mx-2 px-2 divide-y">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Tidak ada kontak yang cocok.</p>
          ) : (
            filtered.map((c) => {
              const checked = c.labels.some((l) => l.id === label.id);
              return (
                <div key={c.id} className="flex items-center gap-3 py-2.5">
                  <Checkbox
                    id={`cb-${c.id}`}
                    checked={checked}
                    disabled={busy.includes(c.id)}
                    onCheckedChange={() => toggle(c)}
                    aria-label={`Beri label ${label.name} pada ${c.name}`}
                  />
                  <label htmlFor={`cb-${c.id}`} className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer">
                    <span
                      className={cn(
                        "h-9 w-9 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0",
                        colorOf(c.colorKey).bg
                      )}
                    >
                      {getInitials(c.name)}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium truncate">{c.name}</span>
                      <span className="block text-xs text-muted-foreground">{c.phone}</span>
                    </span>
                  </label>
                  {busy.includes(c.id) ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" aria-hidden="true" /> : null}
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ===================== Dialog atur label pada satu kontak =====================
function AssignContactDialog({
  contact,
  labels,
  onSetLabels,
  onClose,
}: {
  contact: ContactWithLabels;
  labels: Label[];
  onSetLabels: (contactId: string, ids: string[]) => Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const currentIds = contact.labels.map((l) => l.id);

  const toggle = async (label: Label) => {
    const has = currentIds.includes(label.id);
    const ids = has ? currentIds.filter((id) => id !== label.id) : [...currentIds, label.id];
    setBusy(true);
    try {
      await onSetLabels(contact.id, ids);
    } catch {
      // toast sudah ditampilkan oleh parent
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Label untuk {contact.name}</DialogTitle>
          <DialogDescription>
            {contact.phone} — pilih label yang sesuai untuk kontak ini.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-96 overflow-y-auto wa-scrollbar -mx-2 px-2 divide-y">
          {labels.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Belum ada label. Buat label terlebih dahulu.</p>
          ) : (
            labels.map((l) => {
              const checked = currentIds.includes(l.id);
              return (
                <div key={l.id} className="flex items-center gap-3 py-2.5">
                  <Checkbox
                    id={`cl-${l.id}`}
                    checked={checked}
                    disabled={busy}
                    onCheckedChange={() => toggle(l)}
                    aria-label={`Label ${l.name} untuk ${contact.name}`}
                  />
                  <label htmlFor={`cl-${l.id}`} className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer">
                    <span className={cn("h-3 w-3 rounded-full shrink-0", colorOf(l.colorKey).dot)} aria-hidden="true" />
                    <span className="text-sm font-medium">{l.name}</span>
                  </label>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" aria-hidden="true" /> : null}
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ===================== View utama =====================
export default function LabelsView() {
  // Header internal hanya desktop; di mobile judul ada di top bar AppShell
  // & tombol "+ Label Baru" pindah ke pojok kanannya (sesuai anotasi)
  const isDesktop = useIsDesktop();
  const { toast } = useToast();
  const [labels, setLabels] = useState<Label[]>([]);
  const [contacts, setContacts] = useState<ContactWithLabels[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Label | null>(null);
  const [assignLabel, setAssignLabel] = useState<Label | null>(null);
  const [assignContact, setAssignContact] = useState<ContactWithLabels | null>(null);
  const [deleting, setDeleting] = useState<Label | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/labels", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memuat label");
      setLabels(data.labels);
      setContacts(data.contacts);
    } catch (e) {
      toast({ title: "Gagal memuat label", description: e instanceof Error ? e.message : "Coba lagi", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  // Tombol "+ Label Baru" top bar (mobile) — dipindah dari header internal sesuai anotasi
  useEffect(() => {
    const open = () => {
      setEditing(null);
      setDialogOpen(true);
    };
    window.addEventListener("wa:labels:new", open);
    return () => window.removeEventListener("wa:labels:new", open);
  }, []);

  const setContactLabels = useCallback(
    async (contactId: string, ids: string[]) => {
      try {
        const res = await fetch(`/api/contacts/${contactId}/labels`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ labelIds: ids }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Gagal menyimpan label kontak");
        setContacts((prev) =>
          prev.map((c) => (c.id === contactId ? { ...c, labelIds: JSON.stringify(ids), labels: labels.filter((l) => ids.includes(l.id)) } : c))
        );
      } catch (e) {
        toast({ title: "Gagal menyimpan", description: e instanceof Error ? e.message : "Coba lagi", variant: "destructive" });
        throw e;
      }
    },
    [labels, toast]
  );

  const countFor = useCallback((label: Label) => contacts.filter((c) => c.labels.some((l) => l.id === label.id)).length, [contacts]);

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      const res = await fetch(`/api/labels/${deleting.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menghapus label");
      toast({ title: "Label dihapus", description: deleting.name });
      setDeleting(null);
      await load();
    } catch (e) {
      toast({ title: "Gagal menghapus", description: e instanceof Error ? e.message : "Coba lagi", variant: "destructive" });
    } finally {
      setDeleteBusy(false);
    }
  };

  const filteredContacts = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return contacts;
    return contacts.filter((c) => c.name.toLowerCase().includes(query) || c.phone.toLowerCase().includes(query));
  }, [contacts, q]);

  return (
    <div className="h-full flex flex-col">
      {isDesktop && (
        <ViewHeader
          icon={Tags}
          title="Label Pelanggan"
          subtitle={loading ? "Memuat..." : `${labels.length} label • ${contacts.length} kontak`}
          actions={
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-1.5" aria-hidden="true" /> Label Baru
            </Button>
          }
        />
      )}

      <div className="flex-1 min-h-0 overflow-y-auto wa-scrollbar p-4 sm:p-6 space-y-6">
        {loading ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-[72px] w-full rounded-xl" />
              ))}
            </div>
            <Skeleton className="h-72 w-full rounded-xl" />
          </>
        ) : (
          <>
            {/* Daftar label */}
            <section aria-label="Daftar label">
              {labels.length === 0 ? (
                <EmptyState
                  icon={Tags}
                  title="Belum ada label"
                  description="Buat label untuk mengelompokkan pelanggan, misalnya Prospek, VIP, atau Reseller."
                  action={
                    <Button
                      onClick={() => {
                        setEditing(null);
                        setDialogOpen(true);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-1.5" aria-hidden="true" /> Buat Label Pertama
                    </Button>
                  }
                />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {labels.map((l) => (
                    <Card
                      key={l.id}
                      className="cursor-pointer hover:border-primary/50 transition-colors"
                      onClick={() => setAssignLabel(l)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setAssignLabel(l);
                        }
                      }}
                      aria-label={`Kelola label ${l.name}`}
                    >
                      <CardContent className="p-4 flex items-center gap-3">
                        <span className={cn("h-3.5 w-3.5 rounded-full shrink-0", colorOf(l.colorKey).dot)} aria-hidden="true" />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{l.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {countFor(l)} kontak terlabel
                          </p>
                        </div>
                        <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} role="presentation">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Menu label ${l.name}`}>
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => {
                                  setEditing(l);
                                  setDialogOpen(true);
                                }}
                              >
                                <Pencil className="h-4 w-4 mr-2" aria-hidden="true" /> Edit label
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setAssignLabel(l)}>
                                <UserPlus className="h-4 w-4 mr-2" aria-hidden="true" /> Terapkan ke kontak
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setDeleting(l)} className="text-red-600 focus:text-red-600">
                                <Trash2 className="h-4 w-4 mr-2" aria-hidden="true" /> Hapus
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </section>

            {/* Kelola kontak */}
            <section aria-label="Kelola kontak">
              <Card>
                <CardContent className="p-4 sm:p-5 space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <Users className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
                      <h2 className="font-semibold text-sm sm:text-base">Kelola Kontak</h2>
                      <Badge variant="secondary">{contacts.length}</Badge>
                    </div>
                    <div className="relative ml-auto w-full sm:w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      <Input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Cari kontak..."
                        className="pl-9 h-9"
                        aria-label="Cari kontak"
                      />
                    </div>
                  </div>

                  {contacts.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Belum ada kontak tersimpan.</p>
                  ) : filteredContacts.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Tidak ada kontak yang cocok dengan pencarian.</p>
                  ) : (
                    <div className="max-h-96 overflow-y-auto wa-scrollbar divide-y">
                      {filteredContacts.map((c) => (
                        <div key={c.id} className="flex items-center gap-3 py-3">
                          <span
                            className={cn(
                              "h-10 w-10 rounded-full flex items-center justify-center text-white font-semibold text-sm shrink-0",
                              colorOf(c.colorKey).bg
                            )}
                            aria-hidden="true"
                          >
                            {getInitials(c.name)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">
                              {c.name}
                              {c.blocked ? <Badge className="ml-2 bg-red-600 hover:bg-red-600 text-[10px]">Diblokir</Badge> : null}
                            </p>
                            <p className="text-xs text-muted-foreground">{c.phone}</p>
                          </div>
                          <div className="hidden md:flex flex-wrap gap-1.5 justify-end max-w-[45%]">
                            {c.labels.length === 0 ? (
                              <span className="text-xs text-muted-foreground italic">Tanpa label</span>
                            ) : (
                              c.labels.map((l) => <LabelChip key={l.id} label={l} />)
                            )}
                          </div>
                          <Button variant="outline" size="sm" className="h-8 shrink-0" onClick={() => setAssignContact(c)} aria-label={`Ubah label ${c.name}`}>
                            <Tag className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
                            Label
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>
          </>
        )}
      </div>

      {/* Dialog label */}
      <LabelDialog open={dialogOpen} onOpenChange={setDialogOpen} label={editing} onSaved={load} />

      {/* Dialog terapkan label ke kontak */}
      {assignLabel ? (
        <AssignLabelDialog label={assignLabel} contacts={contacts} onSetLabels={setContactLabels} onClose={() => setAssignLabel(null)} />
      ) : null}

      {/* Dialog atur label pada satu kontak */}
      {assignContact ? (
        <AssignContactDialog contact={assignContact} labels={labels} onSetLabels={setContactLabels} onClose={() => setAssignContact(null)} />
      ) : null}

      {/* Konfirmasi hapus label */}
      <AlertDialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus label ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Label <span className="font-medium text-foreground">{deleting?.name}</span> akan dihapus dan dilepas dari{" "}
              {deleting ? countFor(deleting) : 0} kontak.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteBusy}>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={deleteBusy}
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
            >
              {deleteBusy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
