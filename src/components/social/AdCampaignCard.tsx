"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { Loader2, Megaphone, MessageCircle, Rocket } from "lucide-react";
import { cn, formatPoints, timeAgo } from "@/lib/wa-utils";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type AdT = {
  id: string;
  name: string;
  objective: string;
  budget: number;
  audience: string;
  createdAt: string;
};

const OBJECTIVES = ["Kunjungan", "Leads", "Penjualan"] as const;
const AUDIENCES = ["Semua pengguna", "Kota Jogja", "Semarang", "Surabaya"] as const;
const LS_KEY = "bj_promo_ads";

// Store kecil di atas localStorage — aman SSR, referensi stabil via cache berdasarkan string mentah.
let adsCache: AdT[] = [];
let adsCacheRaw: string | null = null;
const adsListeners = new Set<() => void>();

function readAds(): AdT[] {
  if (typeof window === "undefined") return [];
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(LS_KEY);
  } catch {
    raw = null;
  }
  if (raw !== adsCacheRaw) {
    adsCacheRaw = raw;
    try {
      const parsed = raw ? JSON.parse(raw) : [];
      adsCache = Array.isArray(parsed) ? (parsed as AdT[]) : [];
    } catch {
      adsCache = [];
    }
  }
  return adsCache;
}

function writeAds(list: AdT[]) {
  adsCache = list;
  adsCacheRaw = JSON.stringify(list);
  try {
    window.localStorage.setItem(LS_KEY, adsCacheRaw);
  } catch {
    /* penyimpanan tidak tersedia — abaikan */
  }
  adsListeners.forEach((l) => l());
}

function useAds(): [AdT[], (list: AdT[]) => void] {
  const subscribe = useCallback((cb: () => void) => {
    adsListeners.add(cb);
    return () => {
      adsListeners.delete(cb);
    };
  }, []);
  const getSnapshot = useCallback(() => readAds(), []);
  const getServerSnapshot = useCallback((): AdT[] => [], []);
  const ads = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return [ads, writeAds];
}

/** Kartu "Iklan Klik-ke-WhatsApp": builder kampanye demo + daftar iklan yang dibuat (localStorage). */
export default function AdCampaignCard() {
  const { toast } = useToast();
  const [ads, setAds] = useAds();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("Promo Kopi Gayo Bulan Ini");
  const [objective, setObjective] = useState<string>("Kunjungan");
  const [budget, setBudget] = useState(150000);
  const [audience, setAudience] = useState<string>("Semua pengguna");
  const [publishing, setPublishing] = useState(false);

  function publish() {
    setPublishing(true);
    const ad: AdT = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: name.trim() || "Kampanye tanpa nama",
      objective,
      budget,
      audience,
      createdAt: new Date().toISOString(),
    };
    setTimeout(() => {
      setAds([ad, ...ads]);
      setPublishing(false);
      setOpen(false);
      toast({
        title: "Iklan disetujui & tayang (demo)",
        description: `Kampanye "${ad.name}" tayang untuk ${ad.audience}.`,
      });
    }, 700);
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4 md:p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10" aria-hidden>
            <Megaphone className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold">Iklan Klik-ke-WhatsApp</h3>
            <p className="text-xs text-muted-foreground">
              Tampilkan iklan yang membawa calon pembeli langsung ke chat WhatsApp toko Anda.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-border bg-muted/40 p-3">
          <div>
            <p className="text-xs font-medium">Iklan aktif</p>
            <p className="text-[11px] text-muted-foreground">{ads.length} kampanye dibuat</p>
          </div>
          <Button size="sm" onClick={() => setOpen(true)}>
            <Rocket className="h-4 w-4" />
            Buat Iklan
          </Button>
        </div>

        {ads.length > 0 ? (
          <div className="max-h-96 space-y-2 overflow-y-auto wa-scrollbar" aria-label="Daftar iklan yang dibuat">
            {ads.map((ad) => (
              <div key={ad.id} className="flex items-center gap-2.5 rounded-xl border border-border p-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold">{ad.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {formatPoints(ad.budget)}/hari · {ad.audience} · {timeAgo(ad.createdAt)}
                  </p>
                </div>
                <Badge variant="secondary" className="shrink-0">{ad.objective}</Badge>
                <Badge className="shrink-0 bg-maroon-100 text-maroon-700" variant="secondary">
                  Tayang
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-[11px] text-muted-foreground">
            Belum ada iklan yang dibuat. Mulai kampanye pertama Anda!
          </p>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto wa-scrollbar sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            Buat Iklan Klik-ke-WhatsApp
          </DialogTitle>
          <DialogDescription>
            Pratinjau di bawah adalah perkiraan iklan yang akan dilihat calon pembeli.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="ad-name">Nama kampanye</Label>
            <Input id="ad-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Tujuan iklan</Label>
              <Select value={objective} onValueChange={setObjective}>
                <SelectTrigger aria-label="Pilih tujuan iklan">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OBJECTIVES.map((o) => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Audiens target</Label>
              <Select value={audience} onValueChange={setAudience}>
                <SelectTrigger aria-label="Pilih audiens target">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AUDIENCES.map((a) => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Anggaran harian</Label>
              <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary tabular-nums">
                {formatPoints(budget)}/hari
              </span>
            </div>
            <Slider
              value={[budget]}
              min={50000}
              max={500000}
              step={25000}
              onValueChange={(v) => setBudget(v[0] ?? budget)}
              aria-label="Atur anggaran harian"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>50 rb mP</span>
              <span>500 rb mP</span>
            </div>
          </div>

          {/* Pratinjau iklan */}
          <div>
            <Label className="mb-1.5 block">Pratinjau iklan</Label>
            <div className="overflow-hidden rounded-xl border border-border">
              <img src="/images/story-promo.png" alt="Gambar iklan promosi" className="h-36 w-full object-cover" />
              <div className="space-y-1 p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Disponsori · IndiGoo</p>
                <p className="text-sm font-semibold">{name.trim() || "Kampanye tanpa nama"}</p>
                <p className="text-xs text-muted-foreground">
                  Tujuan: {objective} · Audiens: {audience}
                </p>
                <Button size="sm" className={cn("mt-1 w-full")} tabIndex={-1}>
                  <MessageCircle className="h-4 w-4" />
                  Kirim pesan ke Toko
                </Button>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={publishing}>
            Batal
          </Button>
          <Button onClick={publish} disabled={publishing}>
            {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
            Terbitkan Iklan (demo)
          </Button>
        </DialogFooter>
      </DialogContent>
      </Dialog>
    </Card>
  );
}
