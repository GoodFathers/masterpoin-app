"use client";

import { useEffect, useState } from "react";
import { Loader2, ImagePlus, Trash2, Package } from "lucide-react";
import { cn } from "@/lib/wa-utils";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import WaImg from "@/components/business/WaImg";
import { uploadImage, MAX_UPLOAD_MB } from "@/lib/upload";
import { PRESET_PRODUCT_IMAGES } from "@/components/business/media";
import type { Collection, Product } from "@/components/business/types";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  product: Product | null; // null = tambah baru
  collections: Collection[];
  onSaved: () => void;
}

export default function ProductDialog({ open, onOpenChange, product, collections, onSaved }: Props) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("0");
  const [sku, setSku] = useState("");
  const [description, setDescription] = useState("");
  const [link, setLink] = useState("");
  const [collectionId, setCollectionId] = useState("none");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [available, setAvailable] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (product) {
      setName(product.name);
      setPrice(String(product.price));
      setStock(String(product.stock));
      setSku(product.sku);
      setDescription(product.description);
      setLink(product.link);
      setCollectionId(product.collectionId ?? "none");
      setImageUrl(product.imageUrl);
      setAvailable(product.available);
    } else {
      setName("");
      setPrice("");
      setStock("0");
      setSku("");
      setDescription("");
      setLink("");
      setCollectionId("none");
      setImageUrl(null);
      setAvailable(true);
    }
  }, [open, product]);

  const handleFile = async (file: File) => {
    try {
      // Batch 4: gambar produk diunggah ke server (URL), bukan base64 di DB
      setImageUrl(await uploadImage(file, "product"));
    } catch (e) {
      toast({
        title: "Gagal memuat gambar",
        description: e instanceof Error ? e.message : "Coba gambar lain",
        variant: "destructive",
      });
    }
  };

  const handleSave = async () => {
    const p = parseFloat(price);
    if (!name.trim()) {
      toast({ title: "Nama produk wajib diisi", variant: "destructive" });
      return;
    }
    if (!Number.isFinite(p) || p < 0) {
      toast({ title: "Harga tidak valid", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(product ? `/api/products/${product.id}` : "/api/products", {
        method: product ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          price: p,
          stock: Math.max(0, Math.round(parseFloat(stock) || 0)),
          sku: sku.trim(),
          description,
          link: link.trim(),
          collectionId: collectionId === "none" ? null : collectionId,
          imageUrl,
          available,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan produk");
      toast({ title: product ? "Produk diperbarui" : "Produk ditambahkan", description: name.trim() });
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
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto wa-scrollbar">
        <DialogHeader>
          <DialogTitle>{product ? "Edit Produk" : "Tambah Produk"}</DialogTitle>
          <DialogDescription>
            {product ? "Perbarui informasi produk katalog Anda." : "Produk baru akan otomatis mendapat SKU jika dibiarkan kosong."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="prod-name">Nama produk</Label>
            <Input id="prod-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="cth. Kopi Arabika Gayo 250g" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="prod-price">Harga (mPoin)</Label>
              <Input id="prod-price" type="number" min="0" step="any" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="85000" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prod-stock">Stok</Label>
              <Input id="prod-stock" type="number" min="0" step="1" value={stock} onChange={(e) => setStock(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="prod-sku">SKU</Label>
              <Input id="prod-sku" value={sku} onChange={(e) => setSku(e.target.value)} placeholder="Otomatis jika kosong" className="font-mono text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label>Koleksi</Label>
              <Select value={collectionId} onValueChange={setCollectionId}>
                <SelectTrigger aria-label="Pilih koleksi">
                  <SelectValue placeholder="Pilih koleksi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Tanpa koleksi</SelectItem>
                  {collections.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="prod-desc">Deskripsi</Label>
            <Textarea id="prod-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Deskripsi singkat produk..." />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="prod-link">Link produk (opsional)</Label>
            <Input id="prod-link" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://toko.link/kopi-gayo" />
          </div>

          {/* Gambar */}
          <div className="space-y-1.5">
            <Label>Gambar produk</Label>
            <div className="flex flex-wrap items-start gap-3">
              <div className="h-24 w-24 rounded-xl border border-border bg-muted flex items-center justify-center overflow-hidden shrink-0">
                {imageUrl ? (
                  <WaImg src={imageUrl} alt="Pratinjau gambar produk" className="h-full w-full object-cover" />
                ) : (
                  <Package className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
                )}
              </div>
              <div className="space-y-2 min-w-0 flex-1">
                <div className="flex flex-wrap gap-2">
                  <label className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 h-8 text-xs font-medium cursor-pointer hover:bg-accent transition-colors">
                    <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />
                    Unggah gambar
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleFile(f);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  {imageUrl ? (
                    <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => setImageUrl(null)}>
                      <Trash2 className="h-3.5 w-3.5 mr-1" /> Hapus
                    </Button>
                  ) : null}
                </div>
                <p className="text-[11px] text-muted-foreground">Maks {MAX_UPLOAD_MB} MB, atau pilih gambar bawaan:</p>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_PRODUCT_IMAGES.map((src) => (
                    <button
                      key={src}
                      type="button"
                      onClick={() => setImageUrl(src)}
                      aria-label={`Pakai gambar preset ${src.split("product-")[1]?.replace(".png", "") ?? src}`}
                      className={cn(
                        "h-11 w-11 rounded-lg overflow-hidden border-2 transition-all",
                        imageUrl === src ? "border-primary ring-2 ring-primary/30" : "border-transparent hover:border-border"
                      )}
                    >
                      <WaImg src={src} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Tersedia di katalog</p>
              <p className="text-xs text-muted-foreground">Nonaktifkan untuk menyembunyikan produk dari pelanggan.</p>
            </div>
            <Switch checked={available} onCheckedChange={setAvailable} aria-label="Produk tersedia" />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Batal
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {product ? "Simpan Perubahan" : "Tambah Produk"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
