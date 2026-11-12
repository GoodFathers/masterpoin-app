"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Search, MapPin, Star, MessageCircle, Loader2, Store, PackageSearch, Plus, Pencil, Trash2 } from "lucide-react";
import { cn, formatPoints } from "@/lib/wa-utils";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { can } from "@/lib/user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/chat/ChatMenus";
import type { ViewId } from "@/components/AppShell";

type MarketItem = {
  id: string;
  name: string;
  price: number;
  emoji: string;
  colorKey: string;
  category: string;
  sellerName: string;
  sellerPhone: string;
  location: string;
  rating: number;
  sold: number;
  stock: number;
};

/** Flag lintas-komponen: sheet "+" meminta Marketplace membuka dialog produk baru. */
const NEW_PRODUCT_FLAG = "wa_market_new";

const CATEGORIES: { id: string; label: string }[] = [
  { id: "semua", label: "Semua" },
  { id: "makanan", label: "Makanan" },
  { id: "sembako", label: "Sembako" },
  { id: "fashion", label: "Fashion" },
  { id: "kerajinan", label: "Kerajinan" },
  { id: "jasa", label: "Jasa" },
  { id: "agro", label: "Agro" },
];

const GRADIENTS: Record<string, string> = {
  emerald: "from-maroon-200 to-maroon-500",
  amber: "from-amber-200 to-orange-400",
  violet: "from-violet-200 to-purple-400",
  rose: "from-rose-200 to-pink-400",
  sky: "from-sky-200 to-cyan-400",
  teal: "from-maroon-300 to-maroon-600",
  orange: "from-orange-200 to-amber-400",
  lime: "from-maroon-400 to-maroon-700",
  cyan: "from-cyan-200 to-sky-400",
  green: "from-maroon-100 to-maroon-400",
  red: "from-red-200 to-rose-400",
};

// Desain kartu produk memakai JENIS produk (kategori), bukan logo/simbol/ikon:
// gradasi warna ditentukan oleh kategori & jenis ditampilkan sebagai teks utama kartu.
const CATEGORY_GRADIENTS: Record<string, string> = {
  makanan: GRADIENTS.amber,
  sembako: GRADIENTS.red,
  fashion: GRADIENTS.violet,
  kerajinan: GRADIENTS.cyan,
  jasa: GRADIENTS.teal,
  agro: GRADIENTS.lime,
};
const DEFAULT_GRADIENT = GRADIENTS.emerald;

const CATEGORY_LABEL: Record<string, string> = {
  makanan: "Makanan",
  sembako: "Sembako",
  fashion: "Fashion",
  kerajinan: "Kerajinan",
  jasa: "Jasa",
  agro: "Agro",
};

// Harga dalam POIN (mP) — bukan mata uang. Ketentuan 1 mP = Rp 1 tidak dipublikasikan.
function formatRp(v: number): string {
  return formatPoints(v);
}

export default function MarketplaceView({ onNavigate }: { onNavigate?: (view: ViewId) => void }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const canManage = can(user?.role, "market.manage");
  const [items, setItems] = useState<MarketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("semua");
  const [search, setSearch] = useState("");
  const [askingId, setAskingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formTarget, setFormTarget] = useState<MarketItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MarketItem | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (cat: string, q: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ category: cat });
      if (q.trim()) params.set("q", q.trim());
      const res = await fetch(`/api/market?${params.toString()}`, { cache: "no-store" });
      const data = (await res.json()) as { items?: MarketItem[] };
      setItems(data.items ?? []);
    } catch {
      toast({ title: "Gagal memuat marketplace", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load(category, search);
  }, [category, load, search]);

  // Tombol "+ Tambah Produk" di panel header atas (AppShell, mobile) → buka dialog produk baru.
  useEffect(() => {
    const openNew = () => {
      setFormTarget(null);
      setFormOpen(true);
    };
    window.addEventListener("wa:market:new-product", openNew);
    return () => window.removeEventListener("wa:market:new-product", openNew);
  }, []);

  // Dibuka dari tombol "+" (sheet Buat) → baca flag lintas-mount.
  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(NEW_PRODUCT_FLAG) === "1") {
        window.sessionStorage.removeItem(NEW_PRODUCT_FLAG);
        setFormTarget(null);
        setFormOpen(true);
      }
    } catch {
      // abaikan
    }
  }, []);

  const handleSearch = (v: string) => {
    setSearch(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void load(category, v), 350);
  };

  const askSeller = async (item: MarketItem) => {
    setAskingId(item.id);
    try {
      const res = await fetch("/api/market/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.id }),
      });
      const data = (await res.json()) as { contactName?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Gagal mengirim pertanyaan");
      toast({ title: `Pertanyaan terkirim ke ${data.contactName ?? "penjual"} 💬` });
      onNavigate?.("chats");
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Gagal mengirim pertanyaan", variant: "destructive" });
    } finally {
      setAskingId(null);
    }
  };

  // ---------- Kelola produk (Super Admin & Admin) ----------
  const deleteProduct = async (item: MarketItem) => {
    try {
      const res = await fetch(`/api/market/${item.id}`, { method: "DELETE" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Gagal menghapus produk");
      setItems((prev) => prev.filter((p) => p.id !== item.id));
      toast({ title: `Produk "${item.name}" dihapus` });
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Gagal menghapus produk", variant: "destructive" });
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Kepala: judul (hanya desktop — di mobile judul sudah ada di panel header atas) + pencarian */}
      <div className="shrink-0 px-4 pt-4 pb-2 border-b border-border bg-background">
        <div className="hidden md:flex items-center gap-2 mb-3">
          <span className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Store className="h-5 w-5 text-primary" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h1 className="text-lg font-bold tracking-tight leading-tight">Marketplace</h1>
            <p className="text-xs text-muted-foreground leading-tight">Produk terbaik dari pelaku UMKM</p>
          </div>
          {/* Tombol Tambah Produk versi desktop (baris judul hanya tampil di md+) —
              di mobile tombol ini pindah ke panel header atas (AppShell). */}
          {canManage && (
            <Button
              size="sm"
              className="ml-auto shrink-0 gap-1.5"
              onClick={() => {
                setFormTarget(null);
                setFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> Tambah Produk
            </Button>
          )}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Cari produk, penjual, atau kota"
            aria-label="Cari produk marketplace"
            className="pl-9 bg-secondary border-transparent h-10 rounded-xl"
          />
        </div>
        {/* Kategori */}
        <div className="flex gap-1.5 overflow-x-auto wa-scrollbar pt-3 pb-1" role="tablist" aria-label="Kategori marketplace">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={category === c.id}
              onClick={() => setCategory(c.id)}
              className={cn(
                "px-3 py-1.5 rounded-full text-[13px] whitespace-nowrap transition-colors",
                category === c.id
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "bg-secondary text-muted-foreground hover:bg-secondary/70"
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid produk — pb ekstra agar baris terakhir bisa digulir melewati tombol "+" yang menonjol */}
      <div className="flex-1 min-h-0 overflow-y-auto wa-scrollbar p-3 pb-10">
        {loading && (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border overflow-hidden">
                <Skeleton className="h-28 w-full rounded-none" />
                <div className="p-3 space-y-2">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-8 w-full" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center gap-3">
            <span className="h-14 w-14 rounded-full bg-secondary flex items-center justify-center">
              <PackageSearch className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
            </span>
            <p className="text-sm font-medium">Produk tidak ditemukan</p>
            <p className="text-xs text-muted-foreground">Coba kata kunci atau kategori lain.</p>
          </div>
        )}

        {!loading && items.length > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {items.map((item) => (
              <article
                key={item.id}
                className="rounded-xl border border-border bg-card overflow-hidden flex flex-col hover:shadow-md transition-shadow"
              >
                {/* Visual produk — jenis produk sebagai elemen utama (tanpa emoji/ikon) */}
                <div className={cn("relative h-28 flex items-center justify-center bg-gradient-to-br", CATEGORY_GRADIENTS[item.category] ?? DEFAULT_GRADIENT)}>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/15 to-transparent" aria-hidden="true" />
                  <span className="relative max-w-full px-3 text-center text-base sm:text-lg font-extrabold uppercase tracking-widest text-white drop-shadow-md leading-tight break-words" aria-hidden="true">
                    {CATEGORY_LABEL[item.category] ?? item.category}
                  </span>
                  {item.stock <= 5 && (
                    <span className="absolute top-2 right-2 text-[10px] font-bold bg-red-500 text-white rounded-full px-2 py-0.5">
                      Stok {item.stock}
                    </span>
                  )}
                </div>

                {/* Detail */}
                <div className="p-3 flex-1 flex flex-col gap-1">
                  <h3 className="text-[13px] font-semibold leading-snug line-clamp-2">{item.name}</h3>
                  <p className="text-[15px] font-bold text-primary">{formatRp(item.price)}</p>
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                    <span className="truncate">{item.sellerName} · {item.location}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400 shrink-0" aria-hidden="true" />
                    <span className="font-medium text-foreground/80">{item.rating.toFixed(1)}</span>
                    <span>· {item.sold.toLocaleString("id-ID")} terjual</span>
                  </div>
                  <div className="mt-2 flex gap-1.5">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="flex-1 gap-1.5"
                      onClick={() => void askSeller(item)}
                      disabled={askingId === item.id}
                      aria-label={`Tanya penjual ${item.sellerName}`}
                    >
                      {askingId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageCircle className="h-3.5 w-3.5 text-primary" />}
                      Tanya penjual
                    </Button>
                    {canManage && (
                      <>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="w-9 px-0"
                          aria-label={`Edit produk ${item.name}`}
                          onClick={() => {
                            setFormTarget(item);
                            setFormOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="w-9 px-0"
                          aria-label={`Hapus produk ${item.name}`}
                          onClick={() => setDeleteTarget(item)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {/* Dialog form produk (tambah/edit) */}
      <ProductFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        target={formTarget}
        onSaved={(saved) => {
          setItems((prev) => {
            const exists = prev.some((p) => p.id === saved.id);
            return exists ? prev.map((p) => (p.id === saved.id ? saved : p)) : [saved, ...prev];
          });
          toast({ title: formTarget ? "Perubahan produk tersimpan" : `Produk "${saved.name}" ditambahkan` });
        }}
      />

      {/* Konfirmasi hapus produk */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => {
          if (!o) setDeleteTarget(null);
        }}
        title={`Hapus produk "${deleteTarget?.name ?? ""}"?`}
        description="Produk akan dihapus permanen dari Marketplace."
        confirmLabel="Hapus"
        destructive
        onConfirm={() => deleteTarget && void deleteProduct(deleteTarget)}
      />
    </div>
  );
}

// ---------- Dialog tambah/edit produk ----------

function ProductFormDialog({
  open,
  onOpenChange,
  target,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  target: MarketItem | null;
  onSaved: (item: MarketItem) => void;
}) {
  const { toast } = useToast();
  const isEdit = !!target;

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("kerajinan");
  const [sellerName, setSellerName] = useState("");
  const [location, setLocation] = useState("Yogyakarta");
  const [stock, setStock] = useState("10");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(target?.name ?? "");
    setPrice(target ? String(target.price) : "");
    setCategory(target?.category ?? "kerajinan");
    setSellerName(target?.sellerName ?? "");
    setLocation(target?.location ?? "Yogyakarta");
    setStock(target ? String(target.stock) : "10");
  }, [open, target]);

  const submit = async () => {
    const priceNum = Number(price);
    if (!name.trim() || !Number.isFinite(priceNum) || priceNum < 0) {
      toast({ title: "Nama dan harga produk wajib diisi dengan benar", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const body = {
        name: name.trim(),
        price: priceNum,
        category,
        sellerName: sellerName.trim() || undefined,
        location: location.trim(),
        stock: Number(stock) || 0,
      };
      const res = await fetch(isEdit ? `/api/market/${target!.id}` : "/api/market", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { item?: MarketItem; error?: string };
      if (!res.ok || !data.item) throw new Error(data.error ?? "Gagal menyimpan produk");
      onSaved(data.item);
      onOpenChange(false);
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Gagal menyimpan produk", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!busy) onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Produk" : "Tambah Produk"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Perbarui detail produk di Marketplace." : "Produk baru akan langsung tampil di Marketplace."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="p-name">Nama produk</Label>
            <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. Bakpia Pathok Isi 25" maxLength={80} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="p-price">Harga (mPoin)</Label>
              <Input id="p-price" type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="62500" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-stock">Stok</Label>
              <Input id="p-stock" type="number" min={0} value={stock} onChange={(e) => setStock(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Kategori</Label>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Kategori produk">
              {CATEGORIES.filter((c) => c.id !== "semua").map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={category === c.id}
                  onClick={() => setCategory(c.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-[13px] transition-colors",
                    category === c.id ? "bg-primary text-primary-foreground font-semibold" : "bg-secondary text-muted-foreground hover:bg-secondary/70"
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">Jenis produk menentukan tampilan kartu (warna & label).</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="p-seller">Nama penjual</Label>
              <Input id="p-seller" value={sellerName} onChange={(e) => setSellerName(e.target.value)} placeholder="mis. Toko Saya" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-location">Lokasi</Label>
              <Input id="p-location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Yogyakarta" />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Batal
          </Button>
          <Button onClick={() => void submit()} disabled={busy || !name.trim() || price === ""}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} {isEdit ? "Simpan" : "Tambahkan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
