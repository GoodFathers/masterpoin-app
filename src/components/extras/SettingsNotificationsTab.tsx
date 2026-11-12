"use client";

import { useCallback, useEffect, useState } from "react";
import { BellRing, MonitorSmartphone } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import SettingsRow from "@/components/extras/SettingsRow";

type Profile = {
  notifMessages: boolean;
  notifGroups: boolean;
  notifCalls: boolean;
  notifPreview: boolean;
  notifSound: boolean;
};

const NOTIF_FIELDS: { key: keyof Profile; title: string; description: string }[] = [
  { key: "notifMessages", title: "Pesan", description: "Notifikasi untuk pesan pribadi baru dari pelanggan" },
  { key: "notifGroups", title: "Grup", description: "Notifikasi untuk pesan baru di grup" },
  { key: "notifCalls", title: "Panggilan", description: "Notifikasi untuk panggilan suara dan video masuk" },
  { key: "notifPreview", title: "Pratinjau pesan", description: "Tampilkan isi pesan di banner notifikasi" },
  { key: "notifSound", title: "Suara", description: "Bunyikan nada saat notifikasi masuk" },
];

export default function SettingsNotificationsTab() {
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/privacy", { cache: "no-store" });
      if (!res.ok) throw new Error("gagal");
      const d = await res.json();
      setProfile({
        notifMessages: d.profile.notifMessages,
        notifGroups: d.profile.notifGroups,
        notifCalls: d.profile.notifCalls,
        notifPreview: d.profile.notifPreview,
        notifSound: d.profile.notifSound,
      });
    } catch {
      toast({ title: "Gagal memuat pengaturan notifikasi", variant: "destructive" });
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const setBool = async (key: keyof Profile, value: boolean) => {
    const prev = profile;
    setProfile((p) => (p ? { ...p, [key]: value } : p));
    try {
      const res = await fetch("/api/privacy", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ [key]: value }),
      });
      if (!res.ok) throw new Error("gagal menyimpan");
      // NotificationCenter & hook profil memuat ulang setting saat event ini
      window.dispatchEvent(new CustomEvent("wa:profile-updated"));
    } catch {
      if (prev) setProfile(prev);
      toast({ title: "Gagal menyimpan pengaturan", description: "Coba lagi.", variant: "destructive" });
    }
  };

  // ---------- Izin notifikasi desktop peramban ----------
  const [perm, setPerm] = useState<NotificationPermission | "unsupported" | "loading">("loading");
  useEffect(() => {
    if (typeof window === "undefined" || typeof Notification === "undefined") {
      setPerm("unsupported");
    } else {
      setPerm(Notification.permission);
    }
  }, []);

  const requestDesktopPermission = async () => {
    if (typeof Notification === "undefined") return;
    try {
      const result = await Notification.requestPermission();
      setPerm(result);
      if (result === "granted") {
        toast({ title: "Notifikasi desktop aktif", description: "Anda akan menerima notifikasi saat tab tersembunyi." });
      } else {
        toast({ title: "Izin notifikasi tidak diberikan", variant: "destructive" });
      }
    } catch {
      toast({ title: "Gagal meminta izin notifikasi", variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-base flex items-center gap-2">
          <BellRing className="h-4 w-4 text-primary" aria-hidden="true" /> Notifikasi
        </CardTitle>
        <CardDescription>Pilih pemberitahuan yang ingin Anda terima</CardDescription>
      </CardHeader>
      <CardContent className="pt-2 divide-y divide-border">
        {!profile ? (
          <div className="space-y-4 py-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-56" />
                </div>
                <Skeleton className="h-6 w-11 rounded-full" />
              </div>
            ))}
          </div>
        ) : (
          NOTIF_FIELDS.map((f) => (
            <SettingsRow key={f.key} title={f.title} description={f.description}>
              <Switch
                checked={profile[f.key]}
                onCheckedChange={(v) => setBool(f.key, v)}
                aria-label={f.title}
              />
            </SettingsRow>
          ))
        )}

        {/* Izin notifikasi peramban (pendukung NotificationCenter) */}
        <SettingsRow
          title="Notifikasi desktop"
          description={
            perm === "granted"
              ? "Aktif — muncul saat aplikasi tidak sedang dibuka"
              : perm === "unsupported"
                ? "Peramban ini tidak mendukung notifikasi"
                : "Izinkan peramban menampilkan notifikasi"
          }
        >
          {perm === "granted" ? (
            <span className="text-xs font-medium text-primary flex items-center gap-1.5">
              <MonitorSmartphone className="h-4 w-4" aria-hidden="true" /> Aktif
            </span>
          ) : perm === "denied" || perm === "unsupported" || perm === "loading" ? (
            <span className="text-xs text-muted-foreground">
              {perm === "denied" ? "Diblokir" : "—"}
            </span>
          ) : (
            <Button size="sm" variant="outline" onClick={() => void requestDesktopPermission()}>
              Aktifkan
            </Button>
          )}
        </SettingsRow>
      </CardContent>
    </Card>
  );
}
