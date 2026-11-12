"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ShoppingBag,
  ShoppingCart,
  Search,
  Plus,
  Package,
  MoreVertical,
  Pencil,
  Trash2,
  Boxes,
  Loader2,
  Check,
} from "lucide-react";
import { cn, formatPoints } from "@/lib/wa-utils";
import { useIsDesktop } from "@/lib/useIsDesktop";
import { useCart } from "@/lib/cart-store";
import { useToast } from "@/hooks/use-toast";
import ViewHeader from "@/components/business/ViewHeader";
import EmptyState from "@/components/business/EmptyState";
import WaImg from "@/components/business/WaImg";
import ProductDialog from "@/components/business/ProductDialog";
import CartSheet from "@/components/business/CartSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import type { Collection, Product } from "@/components/business/types";

export default function CatalogView() {
  // Header internal hanya desktop; di mobile judul ada di top bar AppShell
  // (logo katalog + keranjang pindah ke pojok kanannya sesuai anotasi)
  const isDesktop = useIsDesktop();
  const { toast } = useToast();
  const addCart = useCart((s) => s.add);
  const [products, setProducts] = useState<Product[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [colFilter, setColFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null); // Batch 5
  const focusTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/products", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memuat katalog");
      setProducts(data.products);
      setCollections(data.collections);
    } catch (e) {
      toast({
        title: "Gagal memuat katalog",
        description: e instanceof Error ? e.message : "Coba lagi",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  // Batch 5: kartu produk di dalam chat kini bisa diklik → memfokuskan produk
  // terkait di katalog (filter dibersihkan + gulir + ring sesaat). Flag
  // sessionStorage dipakai karena komponen baru ter-mount setelah pindah view;
  // event window tetap didengarkan untuk pemicu saat komponen sudah hidup.
  useEffect(() => {
    const focusNow = (id: string) => {
      focusTimersRef.current.forEach(clearTimeout);
      setQ("");
      setColFilter("all");
      setHighlightId(id);
      focusTimersRef.current = [
        setTimeout(() => {
          document
            .querySelector(`[data-product-id="${id}"]`)
            ?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 350),
        setTimeout(() => setHighlightId(null), 4500),
      ];
    };
    try {
      const flagged = window.sessionStorage.getItem("wa-catalog-focus");
      if (flagged) {
        window.sessionStorage.removeItem("wa-catalog-focus");
        focusNow(flagged);
      }
    } catch {
      // abaikan
    }
    const onFocus = (e: Event) => {
      const id = (e as CustomEvent<{ productId?: string }>).detail?.productId;
      if (id) focusNow(id);
    };
    window.addEventListener("wa:catalog:focus", onFocus);
    return () => {
      window.removeEventListener("wa:catalog:focus", onFocus);
      focusTimersRef.current.forEach(clearTimeout);
    };
  }, []);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return products.filter((p) => {
      const okQ =
        !query ||
        p.name.toLowerCase().includes(query) ||
        p.sku.toLowerCase().includes(query) ||
        (p.description ?? "").toLowerCase().includes(query);
      const okC = colFilter === "all" || p.collectionId === colFilter;
      return okQ && okC;
    });
  }, [products, q, colFilter]);

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setDialogOpen(true);
  };

  const addToCart = (p: Product) => {
    addCart({ productId: p.id, name: p.name, price: p.price, imageUrl: p.imageUrl }, 1);
    toast({ title: "Ditambahkan ke keranjang", description: `${p.name} — ${formatPoints(p.price)}` });
  };

  const toggleAvailable = async (p: Product) => {
    const next = !p.available;
    setProducts((prev) => prev.map((x) => (x.id === p.id ? { ...x, available: next } : x)));
    try {
      const res = await fetch(`/api/products/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ available: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memperbarui produk");
      toast({ title: next ? "Produk tampil di katalog" : "Produk disembunyikan", description: p.name });
    } catch (e) {
      setProducts((prev) => prev.map((x) => (x.id === p.id ? { ...x, available: p.available } : x)));
      toast({
        title: "Gagal memperbarui",
        description: e instanceof Error ? e.message : "Coba lagi",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      const res = await fetch(`/api/products/${deleting.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menghapus produk");
      toast({ title: "Produk dihapus", description: deleting.name });
      setDeleting(null);
      await load();
    } catch (e) {
      toast({
        title: "Gagal menghapus",
        description: e instanceof Error ? e.message : "Coba lagi",
        variant: "destructive",
      });
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {isDesktop && (
        <ViewHeader
          icon={ShoppingBag}
          title="Katalog Produk"
          subtitle={loading ? "Memuat..." : `${products.length} produk • ${collections.length} koleksi`}
          actions={
            <>
              <CartSheet />
              <Button size="sm" onClick={openCreate}>
                <Plus className="h-4 w-4 mr-1.5" aria-hidden="true" /> Tambah Produk
              </Button>
            </>
          }
        />
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 px-4 sm:px-6 py-3 border-b border-border bg-background/80 shrink-0">
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari nama, SKU, atau deskripsi..."
            className="pl-9 h-9"
            aria-label="Cari produk"
          />
        </div>
        <Select value={colFilter} onValueChange={setColFilter}>
          <SelectTrigger className="w-full sm:w-56 h-9" aria-label="Filter koleksi">
            <SelectValue placeholder="Semua Koleksi" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Koleksi</SelectItem>
            {collections.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name} ({c._count?.products ?? 0})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto shrink-0">
          {filtered.length} produk ditampilkan
        </span>
      </div>

      {/* Konten */}
      <div className="flex-1 min-h-0 overflow-y-auto wa-scrollbar p-4 sm:p-6">
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border overflow-hidden">
                <Skeleton className="h-40 w-full rounded-none" />
                <div className="p-4 space-y-2.5">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-6 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <EmptyState
            icon={Package}
            title="Belum ada produk"
            description="Tambahkan produk pertama Anda agar bisa dibagikan ke pelanggan lewat katalog."
            action={
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4 mr-1.5" aria-hidden="true" /> Tambah Produk
              </Button>
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Search}
            title="Tidak ada produk cocok"
            description="Coba ubah kata kunci pencarian atau filter koleksi."
            action={
              <Button
                variant="outline"
                onClick={() => {
                  setQ("");
                  setColFilter("all");
                }}
              >
                Reset filter
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((p) => (
              <Card
                key={p.id}
                data-product-id={p.id}
                className={cn(
                  "overflow-hidden flex flex-col transition-all",
                  p.id === highlightId && "border-primary ring-2 ring-primary/60 shadow-md"
                )}
              >
                <div className="relative h-40 bg-gradient-to-br from-maroon-100 via-maroon-50 to-maroon-50 dark:from-maroon-950 dark:via-maroon-950 dark:to-maroon-950">
                  {p.imageUrl ? (
                    <WaImg src={p.imageUrl} alt={`Foto ${p.name}`} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center">
                      <Package className="h-12 w-12 text-maroon-600/40" aria-hidden="true" />
                    </div>
                  )}
                  <Badge className="absolute top-2 left-2 font-mono text-[10px] bg-background/85 text-foreground border backdrop-blur hover:bg-background/85">
                    {p.sku}
                  </Badge>
                  {!p.available ? (
                    <Badge className="absolute bottom-2 left-2 bg-amber-500 hover:bg-amber-500 text-white text-[10px]">Disembunyikan</Badge>
                  ) : null}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="secondary"
                        size="icon"
                        className="absolute top-2 right-2 h-8 w-8 bg-background/85 backdrop-blur border"
                        aria-label={`Menu produk ${p.name}`}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => addToCart(p)}>
                        <ShoppingCart className="h-4 w-4 mr-2" aria-hidden="true" /> Tambah ke Keranjang
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openEdit(p)}>
                        <Pencil className="h-4 w-4 mr-2" aria-hidden="true" /> Edit produk
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setDeleting(p)} className="text-red-600 focus:text-red-600">
                        <Trash2 className="h-4 w-4 mr-2" aria-hidden="true" /> Hapus
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <CardContent className="p-4 flex-1 flex flex-col gap-2">
                  <p className="font-medium leading-snug line-clamp-1">{p.name}</p>
                  <p className="text-primary font-semibold">{formatPoints(p.price)}</p>
                  {p.description ? <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p> : null}
                  <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                    <span className={cn("inline-flex items-center gap-1", p.stock === 0 && "text-red-600 font-medium")}>
                      <Boxes className="h-3.5 w-3.5" aria-hidden="true" />
                      {p.stock === 0 ? "Stok habis" : `Stok ${p.stock}`}
                    </span>
                    {p.collection ? <Badge variant="secondary" className="text-[10px]">{p.collection.name}</Badge> : null}
                  </div>
                  <div className="mt-auto pt-3 flex items-center justify-between gap-2 border-t">
                    <span className="text-xs text-muted-foreground">Tersedia</span>
                    <div className="flex items-center gap-2">
                      <Switch checked={p.available} onCheckedChange={() => toggleAvailable(p)} aria-label={`Tersedia: ${p.name}`} />
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-2.5 text-xs"
                        disabled={!p.available || p.stock === 0}
                        onClick={() => addToCart(p)}
                        aria-label={`Tambah ${p.name} ke keranjang`}
                      >
                        <ShoppingCart className="h-3.5 w-3.5" aria-hidden="true" />
                        Keranjang
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Dialog tambah/edit */}
      <ProductDialog open={dialogOpen} onOpenChange={setDialogOpen} product={editing} collections={collections} onSaved={load} />

      {/* Konfirmasi hapus */}
      <AlertDialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus produk ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Produk <span className="font-medium text-foreground">{deleting?.name}</span> ({deleting?.sku}) akan dihapus permanen dari katalog.
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
