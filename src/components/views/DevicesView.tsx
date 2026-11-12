"use client";

import { useCallback, useEffect, useState } from "react";
import { Laptop, LogOut, Monitor, MonitorSmartphone, Plus, Smartphone, Tablet, Info } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
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
import { cn, timeAgo } from "@/lib/wa-utils";
import { useToast } from "@/hooks/use-toast";
import LinkDeviceDialog from "@/components/extras/LinkDeviceDialog";

type Device = {
  id: string;
  name: string;
  platform: string; // PHONE | WEB | DESKTOP | TABLET
  current: boolean;
  lastActive: string;
  location: string;
};

/** ID perangkat browser ini — dibuat sekali dan tersimpan di localStorage. */
const DEVICE_ID_KEY = "wa_device_id";
const LOGGED_OUT_KEY = "wa_logged_out";

function getDeviceId(): string {
  try {
    let id = window.localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `web-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      window.localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return "web-unknown";
  }
}

const PLATFORM_META: Record<string, { Icon: React.ElementType; label: string; bg: string }> = {
  PHONE: { Icon: Smartphone, label: "Ponsel", bg: "bg-maroon-100 text-maroon-600" },
  WEB: { Icon: Monitor, label: "Browser", bg: "bg-maroon-100 text-maroon-600" },
  DESKTOP: { Icon: Laptop, label: "Desktop", bg: "bg-amber-100 text-amber-600" },
  TABLET: { Icon: Tablet, label: "Tablet", bg: "bg-purple-100 text-purple-600" },
};

export default function DevicesView() {
  const { toast } = useToast();
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [linkOpen, setLinkOpen] = useState(false);
  const [logoutTarget, setLogoutTarget] = useState<Device | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/devices", {
        cache: "no-store",
        headers: { "X-Device-Id": getDeviceId() },
      });
      if (!res.ok) throw new Error("gagal");
      const d = await res.json();
      setDevices(d.devices ?? []);
    } catch {
      toast({ title: "Gagal memuat perangkat", description: "Coba lagi sebentar.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  // Tombol "+ Tautkan Perangkat" di pojok kanan top bar AppShell (mobile) memicu event ini
  useEffect(() => {
    const onLink = () => setLinkOpen(true);
    window.addEventListener("wa:devices:link", onLink);
    return () => window.removeEventListener("wa:devices:link", onLink);
  }, []);

  const logout = async () => {
    if (!logoutTarget) return;
    const target = logoutTarget;
    const isSelf = target.current;
    setLoggingOut(true);
    try {
      const res = await fetch(`/api/devices/${target.id}`, {
        method: "DELETE",
        cache: "no-store",
        headers: { "X-Device-Id": getDeviceId() },
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.error ?? "Gagal mengeluarkan perangkat");
      }
      const d = await res.json().catch(() => null);
      // Bila yang dikeluarkan adalah perangkat ini → akhiri sesi (perilaku nyata)
      if (d?.self || (isSelf && d?.success)) {
        try {
          window.sessionStorage.setItem(LOGGED_OUT_KEY, "1");
        } catch {
          // abaikan
        }
        window.location.reload();
        return;
      }
      toast({ title: "Perangkat dikeluarkan 👋", description: `${target.name} tidak lagi tertaut.` });
      setLogoutTarget(null);
      load();
    } catch (err) {
      toast({
        title: "Gagal mengeluarkan perangkat",
        description: err instanceof Error ? err.message : "Coba lagi.",
        variant: "destructive",
      });
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header internal hanya desktop — di mobile judul tampil di top bar AppShell
          & tombol Tautkan Perangkat pindah ke pojok kanan atas (event wa:devices:link) */}
      <header className="hidden md:flex items-center gap-2 px-4 py-3 border-b border-border bg-card shrink-0">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Perangkat Tertaut</h1>
          <p className="text-xs text-muted-foreground">Kelola sesi login WhatsApp Anda</p>
        </div>
        <Button size="sm" className="ml-auto" onClick={() => setLinkOpen(true)}>
          <Plus className="h-4 w-4" /> Tautkan Perangkat
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto wa-scrollbar p-4">
        <div className="max-w-3xl mx-auto space-y-4">
          {/* Sesi aktif */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Sesi aktif</CardTitle>
              <CardDescription>
                {loading && !devices
                  ? "Memuat…"
                  : `${devices?.length ?? 0} perangkat terhubung ke akun ini`}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {loading && !devices ? (
                <div className="px-6 pb-6 space-y-3">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-3 w-64" />
                      </div>
                      <Skeleton className="h-8 w-20" />
                    </div>
                  ))}
                </div>
              ) : devices && devices.length > 0 ? (
                <ul className="px-2 pb-2" aria-label="Daftar perangkat tertaut">
                  {devices.map((dev, i) => {
                    const meta = PLATFORM_META[dev.platform] ?? PLATFORM_META.WEB;
                    const Icon = meta.Icon;
                    return (
                      <li key={dev.id}>
                        {i > 0 && <Separator className="mb-2 mt-1" />}
                        <div className="flex items-center gap-3 px-4 py-2.5">
                          <span
                            className={cn("h-10 w-10 rounded-full flex items-center justify-center shrink-0", meta.bg)}
                            aria-hidden="true"
                          >
                            <Icon className="h-5 w-5" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-medium truncate">{dev.name}</p>
                              {dev.current ? (
                                <Badge className="bg-maroon-100 text-maroon-700 hover:bg-maroon-100 border border-maroon-200 text-[10px] px-1.5 py-0">
                                  Perangkat ini
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                  Sesi lama
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground truncate">
                              {meta.label} · {dev.location} ·{" "}
                              {dev.current ? "Terakhir aktif baru saja" : `Terakhir aktif ${timeAgo(dev.lastActive)}`}
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className={cn(
                              "shrink-0",
                              dev.current
                                ? "text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                                : "text-red-600 hover:text-red-700 hover:bg-red-50"
                            )}
                            onClick={() => setLogoutTarget(dev)}
                            aria-label={dev.current ? `Keluarkan perangkat ini (${dev.name})` : `Keluar dari perangkat ${dev.name}`}
                          >
                            <LogOut className="h-3.5 w-3.5" /> {dev.current ? "Keluarkan" : "Keluar"}
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="px-6 pb-6 text-sm text-muted-foreground">Belum ada perangkat tertaut.</p>
              )}
            </CardContent>
          </Card>

          {/* Info multi-perangkat */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4 flex gap-3">
              <span className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Info className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold flex items-center gap-1.5">
                  <MonitorSmartphone className="h-4 w-4 text-primary" aria-hidden="true" /> Tentang Multi-Perangkat
                </p>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                  Anda dapat menautkan hingga <strong>4 perangkat</strong> ke akun WhatsApp bisnis ini. Semua pesan tetap
                  sinkron secara real-time, dan chat tetap tersimpan aman di ponsel utama bahkan saat ponsel sedang
                  tidak terhubung internet.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialog tautkan perangkat */}
      <LinkDeviceDialog open={linkOpen} onOpenChange={setLinkOpen} onLinked={() => { setLinkOpen(false); load(); }} />

      {/* Konfirmasi keluar perangkat */}
      <AlertDialog open={!!logoutTarget} onOpenChange={(o) => !o && setLogoutTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{logoutTarget?.current ? "Keluarkan perangkat ini?" : "Keluar dari perangkat ini?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {logoutTarget?.current
                ? "Anda akan mengeluarkan perangkat yang sedang Anda pakai. Sesi di browser ini langsung ditutup dan Anda perlu menautkan ulang untuk masuk kembali."
                : `${logoutTarget?.name} akan langsung dikeluarkan dan tidak dapat mengakses chat Anda lagi. Anda bisa menautkannya kembali kapan saja.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loggingOut}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                logout();
              }}
              disabled={loggingOut}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {loggingOut ? "Mengeluarkan…" : logoutTarget?.current ? "Ya, Keluarkan" : "Ya, Keluar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
