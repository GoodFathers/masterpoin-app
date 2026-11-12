"use client";

import { useEffect, useState } from "react";
import { Loader2, MonitorSmartphone, ScanLine } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const PLATFORMS = [
  { value: "WEB", label: "WhatsApp Web (Browser)" },
  { value: "DESKTOP", label: "Aplikasi Desktop" },
  { value: "TABLET", label: "Tablet" },
];

function genCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const pick = (n: number) =>
    Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `BJ-${pick(4)}-${pick(4)}`;
}

export default function LinkDeviceDialog({
  open,
  onOpenChange,
  onLinked,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLinked: () => void;
}) {
  const { toast } = useToast();
  const [code, setCode] = useState("");
  const [qr, setQr] = useState("");
  const [name, setName] = useState("");
  const [platform, setPlatform] = useState("WEB");
  const [submitting, setSubmitting] = useState(false);

  // QR + kode baru setiap kali dialog dibuka
  useEffect(() => {
    if (!open) return;
    const c = genCode();
    setCode(c);
    setQr("");
    (async () => {
      try {
        const res = await fetch(`/api/qr?text=${encodeURIComponent(`https://web.whatsapp.com/link?code=${c}`)}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const d = await res.json();
        setQr(d.dataUrl ?? "");
      } catch {
        /* QR gagal — kode manual tetap tampil */
      }
    })();
  }, [open]);

  const reset = () => {
    setName("");
    setPlatform("WEB");
  };

  const submit = async () => {
    if (!name.trim()) {
      toast({ title: "Nama perangkat wajib diisi", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ name: name.trim(), platform }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.error ?? "Gagal menautkan perangkat");
      }
      toast({
        title: "Perangkat berhasil ditautkan ✅",
        description: `${name.trim()} kini bisa mengakses chat Anda.`,
      });
      reset();
      onLinked();
    } catch (err) {
      toast({
        title: "Gagal menautkan perangkat",
        description: err instanceof Error ? err.message : "Coba lagi.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-sm" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MonitorSmartphone className="h-4 w-4 text-primary" /> Tautkan Perangkat
          </DialogTitle>
          <DialogDescription>
            Pindai QR dengan aplikasi InDiGoo di ponsel, atau masukkan kode & isi formulir untuk simulasi.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-3 py-1">
          <div className="w-44 h-44 rounded-xl border bg-white p-2 flex items-center justify-center overflow-hidden">
            {qr ? (
              <img src={qr} alt="QR code penautan perangkat" className="w-full h-full" />
            ) : (
              <Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="Membuat QR" />
            )}
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <ScanLine className="h-3.5 w-3.5" aria-hidden="true" />
            Kode penautan:
          </p>
          <p className="font-mono text-lg font-bold tracking-widest text-primary" aria-live="polite">
            {code}
          </p>
        </div>

        <div className="space-y-3 border-t pt-3">
          <div className="space-y-1.5">
            <Label htmlFor="device-name">Nama perangkat</Label>
            <Input
              id="device-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Mis. Laptop Kantor — Chrome"
              maxLength={60}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Jenis perangkat</Label>
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger aria-label="Jenis perangkat">
                <SelectValue placeholder="Pilih jenis" />
              </SelectTrigger>
              <SelectContent>
                {PLATFORMS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Batal
          </Button>
          <Button onClick={submit} disabled={submitting} className="min-w-32">
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Menautkan…
              </>
            ) : (
              "Tautkan Sekarang"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
