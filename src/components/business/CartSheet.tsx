"use client";

import { useCallback, useState } from "react";
import { Minus, Plus, ShoppingCart, Trash2, Package, Copy, ReceiptText, Loader2 } from "lucide-react";
import { cn, formatPoints, getInitials, waListTime } from "@/lib/wa-utils";
import { useCart, cartTotal, type CartItem } from "@/lib/cart-store";
import { useToast } from "@/hooks/use-toast";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import WaImg from "@/components/business/WaImg";

type OrderLine = { productId: string; name: string; price: number; qty: number };

type OrderT = {
  id: string;
  code: string;
  customerName: string;
  customerPhone: string;
  note: string;
  items: string; // JSON snapshot
  total: number;
  status: string; // NEW | PROCESSING | COMPLETED | CANCELLED
  createdAt: string;
};

function parseItems(raw: string): OrderLine[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? (v as OrderLine[]) : [];
  } catch {
    return [];
  }
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    NEW: { label: "Baru", cls: "border-border text-muted-foreground" },
    PROCESSING: { label: "Diproses", cls: "border-amber-300 bg-amber-50 text-amber-700" },
    COMPLETED: { label: "Selesai", cls: "border-maroon-300 bg-maroon-50 text-maroon-700" },
    CANCELLED: { label: "Dibatalkan", cls: "border-red-300 bg-red-50 text-red-700" },
  };
  const it = map[status] ?? { label: status, cls: "" };
  return (
    <Badge variant="outline" className={cn("shrink-0 text-[10px]", it.cls)}>
      {it.label}
    </Badge>
  );
}

function CartRow({ item }: { item: CartItem }) {
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="h-12 w-12 rounded-lg overflow-hidden bg-muted flex items-center justify-center shrink-0">
        {item.imageUrl ? (
          <WaImg src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
        ) : (
          <span className="text-xs font-semibold text-muted-foreground">{getInitials(item.name)}</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-tight line-clamp-1">{item.name}</p>
        <p className="text-xs text-muted-foreground">{formatPoints(item.price)}</p>
        <div className="mt-1.5 flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-6 w-6"
            onClick={() => setQty(item.productId, item.qty - 1)}
            aria-label={`Kurangi jumlah ${item.name}`}
          >
            <Minus className="h-3 w-3" />
          </Button>
          <span className="w-7 text-center text-sm font-medium" aria-live="polite">
            {item.qty}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-6 w-6"
            onClick={() => setQty(item.productId, item.qty + 1)}
            aria-label={`Tambah jumlah ${item.name}`}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <p className="text-sm font-semibold">{formatPoints(item.price * item.qty)}</p>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => remove(item.productId)} aria-label={`Hapus ${item.name} dari keranjang`}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default function CartSheet() {
  const items = useCart((s) => s.items);
  const clear = useCart((s) => s.clear);
  const { toast } = useToast();
  const [summary, setSummary] = useState<string | null>(null);

  // Pesanan nyata
  const [orderOpen, setOrderOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [note, setNote] = useState("");
  const [history, setHistory] = useState<OrderT[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const count = items.reduce((s, i) => s + i.qty, 0);
  const total = cartTotal(items);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/orders", { cache: "no-store" });
      const data = await res.json();
      if (res.ok) setHistory(((data.orders ?? []) as OrderT[]).slice(0, 5));
    } catch {
      /* senyap — riwayat bersifat pelengkap */
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const submitOrder = async () => {
    if (creating || items.length === 0) return;
    setCreating(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({ productId: i.productId, qty: i.qty })),
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          note: note.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.order) throw new Error(data?.error || "Gagal membuat pesanan");
      const o = data.order as OrderT & { items: OrderLine[] };
      const lines = (o.items ?? []).map((l) => `• ${l.name} x${l.qty} — ${formatPoints(l.price * l.qty)}`);
      setSummary(
        `Pesanan ${o.code}${o.customerName ? ` — ${o.customerName}` : ""}:\n${lines.join("\n")}\n\nTotal: ${formatPoints(o.total)}`
      );
      clear();
      setOrderOpen(false);
      setCustomerName("");
      setCustomerPhone("");
      setNote("");
      toast({
        title: `Pesanan ${o.code} tersimpan`,
        description: "Stok produk diperbarui. Salin ringkasan untuk dikirim ke pelanggan lewat chat.",
      });
      void loadHistory();
    } catch (e) {
      toast({
        title: "Gagal membuat pesanan",
        description: e instanceof Error ? e.message : "Silakan coba lagi.",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const setOrderStatus = async (o: OrderT, status: string) => {
    try {
      const res = await fetch(`/api/orders/${o.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok || !data?.order) throw new Error(data?.error || "Gagal memperbarui pesanan");
      setHistory((prev) => prev.map((x) => (x.id === o.id ? { ...x, status: data.order.status } : x)));
      toast({
        title: `Pesanan ${o.code} diperbarui`,
        description: status === "CANCELLED" ? "Pesanan dibatalkan — stok produk dikembalikan." : undefined,
      });
    } catch (e) {
      toast({
        title: "Gagal memperbarui pesanan",
        description: e instanceof Error ? e.message : "Silakan coba lagi.",
        variant: "destructive",
      });
    }
  };

  const handleCopy = async () => {
    if (!summary) return;
    try {
      await navigator.clipboard.writeText(summary);
      toast({ title: "Ringkasan disalin", description: "Tempel di chat pelanggan." });
    } catch {
      toast({ title: "Gagal menyalin", variant: "destructive" });
    }
  };

  return (
    <Sheet onOpenChange={(open) => open && void loadHistory()}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="relative" aria-label={`Buka keranjang, ${count} item`}>
          <ShoppingCart className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">Keranjang</span>
          {count > 0 ? (
            <Badge className="absolute -top-2 -right-2 h-5 min-w-5 px-1 bg-primary hover:bg-primary text-[10px]">{count}</Badge>
          ) : null}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="p-4 border-b">
          <SheetTitle className="flex items-center gap-2 text-base">
            <ShoppingCart className="h-4 w-4 text-primary" aria-hidden="true" /> Keranjang
            {count > 0 ? <Badge variant="secondary">{count} item</Badge> : null}
          </SheetTitle>
          <SheetDescription>Catat pesanan pelanggan dari katalog — tersimpan & stok terpantau.</SheetDescription>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto wa-scrollbar px-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center gap-3 py-12">
              <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground">
                <Package className="h-7 w-7" aria-hidden="true" />
              </div>
              <p className="font-medium">Keranjang kosong</p>
              <p className="text-sm text-muted-foreground max-w-[220px]">Tambahkan produk dari katalog untuk membuat pesanan.</p>
            </div>
          ) : (
            <div className="divide-y">{items.map((i) => <CartRow key={i.productId} item={i} />)}</div>
          )}

          {historyLoading ? (
            <div className="space-y-2 border-t pt-3 pb-4" aria-hidden>
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-16 w-full rounded-xl" />
            </div>
          ) : history.length > 0 ? (
            <section aria-label="Riwayat pesanan" className="border-t pt-3 pb-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Riwayat Pesanan</p>
              <ul className="max-h-52 space-y-2 overflow-y-auto wa-scrollbar">
                {history.map((o) => {
                  const lines = parseItems(o.items);
                  return (
                    <li key={o.id} className="space-y-1.5 rounded-xl border bg-muted/30 px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <ReceiptText className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                        <p className="min-w-0 flex-1 truncate text-xs font-medium">
                          {o.code}
                          {o.customerName ? ` · ${o.customerName}` : ""}
                        </p>
                        <StatusBadge status={o.status} />
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {lines.length > 0
                          ? `${lines[0].name}${lines.length > 1 ? ` +${lines.length - 1} lainnya` : ""} · `
                          : ""}
                        {formatPoints(o.total)} · {waListTime(o.createdAt)}
                      </p>
                      {o.status === "NEW" || o.status === "PROCESSING" ? (
                        <div className="flex gap-1.5">
                          {o.status === "NEW" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 text-[11px]"
                              onClick={() => void setOrderStatus(o, "PROCESSING")}
                            >
                              Proses
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 text-[11px]"
                              onClick={() => void setOrderStatus(o, "COMPLETED")}
                            >
                              Selesai
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-[11px] text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => void setOrderStatus(o, "CANCELLED")}
                          >
                            Batalkan
                          </Button>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}
        </div>

        <div className="border-t p-4 space-y-3 shrink-0">
          {summary ? (
            <div className="rounded-xl border bg-muted/40 p-3 space-y-2">
              <p className="text-xs font-semibold flex items-center gap-1.5 text-maroon-700">
                <ReceiptText className="h-3.5 w-3.5" aria-hidden="true" /> Ringkasan pesanan terakhir
              </p>
              <pre className="whitespace-pre-wrap text-xs text-muted-foreground font-sans max-h-32 overflow-y-auto wa-scrollbar">{summary}</pre>
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleCopy}>
                <Copy className="h-3 w-3 mr-1" /> Salin ringkasan
              </Button>
            </div>
          ) : null}

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className={cn("text-base font-bold", total > 0 && "text-primary")}>{formatPoints(total)}</span>
          </div>
          <Button className="w-full" onClick={() => setOrderOpen(true)} disabled={items.length === 0}>
            <ReceiptText className="h-4 w-4 mr-2" aria-hidden="true" /> Buat Pesanan
          </Button>
          <p className="text-[11px] text-muted-foreground text-center">Pesanan tersimpan di riwayat — ringkasan bisa dikirim ke pelanggan lewat chat.</p>
          <Separator className="hidden" />
        </div>
      </SheetContent>

      {/* Dialog konfirmasi pesanan nyata */}
      <Dialog open={orderOpen} onOpenChange={setOrderOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ReceiptText className="h-5 w-5 text-primary" />
              Buat Pesanan
            </DialogTitle>
            <DialogDescription>
              Pesanan tersimpan ke riwayat & stok produk otomatis dikurangi.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="order-customer">Nama pelanggan (opsional)</Label>
              <Input
                id="order-customer"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                maxLength={80}
                placeholder="cth. Ibu Sari"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="order-phone">No. WhatsApp pelanggan (opsional)</Label>
              <Input
                id="order-phone"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                maxLength={32}
                placeholder="cth. +62 812-3456-7890"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="order-note">Catatan (opsional)</Label>
              <Textarea
                id="order-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                maxLength={300}
                placeholder="cth. dikirim sore ini"
              />
            </div>
            <div className="rounded-xl border bg-muted/40 p-3 text-xs">
              <p className="mb-1.5 font-semibold">{count} item</p>
              <div className="space-y-1">
                {items.map((i) => (
                  <p key={i.productId} className="flex items-center justify-between gap-2 text-muted-foreground">
                    <span className="truncate">{i.name} x{i.qty}</span>
                    <span className="shrink-0">{formatPoints(i.price * i.qty)}</span>
                  </p>
                ))}
              </div>
              <p className="mt-2 flex items-center justify-between border-t pt-1.5 font-semibold">
                <span>Total</span>
                <span>{formatPoints(total)}</span>
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOrderOpen(false)} disabled={creating}>
              Batal
            </Button>
            <Button onClick={() => void submitOrder()} disabled={creating || items.length === 0}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ReceiptText className="h-4 w-4" />}
              Simpan Pesanan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}
