"use client";

import { useCallback, useEffect, useState } from "react";
import { Ban, Loader2, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { cn, colorOf, getInitials } from "@/lib/wa-utils";
import { useToast } from "@/hooks/use-toast";
import SettingsRow from "@/components/extras/SettingsRow";

type Profile = {
  lastSeen: string;
  onlineStatus: string;
  profilePhotoVis: string;
  statusVis: string;
  readReceipts: boolean;
  twoStepEnabled: boolean;
  blockedStrangers: boolean;
};

type BlockedContact = { id: string; name: string; phone: string; colorKey: string; blocked: boolean };

const VIS_OPTIONS = [
  { value: "everyone", label: "Semua orang" },
  { value: "contacts", label: "Kontak saya" },
  { value: "nobody", label: "Tidak ada" },
];

const VIS_FIELDS: { key: keyof Profile; title: string; description: string }[] = [
  { key: "lastSeen", title: "Terlihat terakhir", description: "Siapa yang dapat melihat waktu terakhir Anda online" },
  { key: "onlineStatus", title: "Status online", description: "Siapa yang dapat melihat saat Anda sedang online" },
  { key: "profilePhotoVis", title: "Foto profil", description: "Siapa yang dapat melihat foto profil Anda" },
  { key: "statusVis", title: "Status", description: "Siapa yang dapat melihat unggahan status Anda" },
];

export default function SettingsPrivacyTab() {
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [blocked, setBlocked] = useState<BlockedContact[] | null>(null);
  const [twoStepOpen, setTwoStepOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [pinSaving, setPinSaving] = useState(false);
  const [unblocking, setUnblocking] = useState<string | null>(null);

  const loadPrivacy = useCallback(async () => {
    try {
      const res = await fetch("/api/privacy", { cache: "no-store" });
      if (!res.ok) throw new Error("gagal");
      const d = await res.json();
      setProfile({
        lastSeen: d.profile.lastSeen,
        onlineStatus: d.profile.onlineStatus,
        profilePhotoVis: d.profile.profilePhotoVis,
        statusVis: d.profile.statusVis,
        readReceipts: d.profile.readReceipts,
        twoStepEnabled: d.profile.twoStepEnabled,
        blockedStrangers: d.profile.blockedStrangers,
      });
    } catch {
      toast({ title: "Gagal memuat pengaturan privasi", variant: "destructive" });
    }
  }, [toast]);

  const loadBlocked = useCallback(async () => {
    try {
      const res = await fetch("/api/blocked", { cache: "no-store" });
      if (!res.ok) throw new Error("gagal");
      const d = await res.json();
      setBlocked(d.contacts ?? []);
    } catch {
      setBlocked([]);
    }
  }, []);

  useEffect(() => {
    loadPrivacy();
    loadBlocked();
  }, [loadPrivacy, loadBlocked]);

  const patch = useCallback(
    async (fields: Record<string, string | boolean>, revert: Profile | null) => {
      try {
        const res = await fetch("/api/privacy", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify(fields),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => null);
          throw new Error(d?.error ?? "Gagal menyimpan");
        }
      } catch (err) {
        if (revert) setProfile(revert);
        toast({
          title: "Gagal menyimpan pengaturan",
          description: err instanceof Error ? err.message : "Coba lagi.",
          variant: "destructive",
        });
      }
    },
    [toast]
  );

  const setVis = (key: keyof Profile, value: string) => {
    const prev = profile;
    setProfile((p) => (p ? { ...p, [key]: value } : p));
    patch({ [key]: value }, prev);
  };

  const setBool = (key: keyof Profile, value: boolean) => {
    const prev = profile;
    setProfile((p) => (p ? { ...p, [key]: value } : p));
    patch({ [key]: value }, prev);
  };

  const onTwoStepToggle = (checked: boolean) => {
    if (checked) {
      setPin("");
      setTwoStepOpen(true);
    } else {
      setBool("twoStepEnabled", false);
      toast({ title: "Verifikasi dua langkah dimatikan" });
    }
  };

  const confirmPin = async () => {
    if (pin.length !== 6) return;
    setPinSaving(true);
    const prev = profile;
    setProfile((p) => (p ? { ...p, twoStepEnabled: true } : p));
    await patch({ twoStepEnabled: true }, prev);
    setPinSaving(false);
    setTwoStepOpen(false);
    toast({ title: "Verifikasi dua langkah aktif 🔒", description: "PIN 6 digit Anda telah disimpan." });
  };

  const unblock = async (c: BlockedContact) => {
    setUnblocking(c.id);
    try {
      const res = await fetch(`/api/blocked/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ blocked: false }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.error ?? "Gagal membuka blokir");
      }
      toast({ title: "Blokir dibuka ✅", description: `${c.name} kini dapat mengirim pesan kepada Anda.` });
      setBlocked((list) => (list ? list.filter((b) => b.id !== c.id) : list));
    } catch (err) {
      toast({
        title: "Gagal membuka blokir",
        description: err instanceof Error ? err.message : "Coba lagi.",
        variant: "destructive",
      });
    } finally {
      setUnblocking(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Privasi dasar */}
      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" /> Privasi
          </CardTitle>
          <CardDescription>Kontrol siapa yang melihat informasi pribadi Anda</CardDescription>
        </CardHeader>
        <CardContent className="pt-2 divide-y divide-border">
          {!profile ? (
            <div className="space-y-4 py-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-52" />
                  </div>
                  <Skeleton className="h-9 w-36" />
                </div>
              ))}
            </div>
          ) : (
            VIS_FIELDS.map((f) => (
              <SettingsRow key={f.key} title={f.title} description={f.description}>
                <Select value={profile[f.key] as string} onValueChange={(v) => setVis(f.key, v)}>
                  <SelectTrigger className="w-36" aria-label={f.title}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VIS_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SettingsRow>
            ))
          )}
        </CardContent>
      </Card>

      {/* Keamanan */}
      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-base">Keamanan</CardTitle>
        </CardHeader>
        <CardContent className="pt-2 divide-y divide-border">
          <SettingsRow
            title="Tanda pesan dibaca (read receipts)"
            description="Jika dimatikan, Anda tidak dapat melihat tanda dibaca orang lain."
          >
            <Switch
              checked={profile?.readReceipts ?? false}
              onCheckedChange={(v) => setBool("readReceipts", v)}
              disabled={!profile}
              aria-label="Tanda pesan dibaca"
            />
          </SettingsRow>

          <SettingsRow
            title="Verifikasi dua langkah"
            description="Wajibkan PIN 6 digit saat mendaftarkan ulang nomor ini."
          >
            <Switch
              checked={profile?.twoStepEnabled ?? false}
              onCheckedChange={onTwoStepToggle}
              disabled={!profile}
              aria-label="Verifikasi dua langkah"
            />
          </SettingsRow>

          <SettingsRow
            title="Blokir pesan dari nomor tak dikenal"
            description="Pesan dari nomor yang tidak ada di kontak akan ditolak otomatis."
          >
            <Switch
              checked={profile?.blockedStrangers ?? false}
              onCheckedChange={(v) => setBool("blockedStrangers", v)}
              disabled={!profile}
              aria-label="Blokir pesan dari nomor tak dikenal"
            />
          </SettingsRow>
        </CardContent>
      </Card>

      {/* Daftar blokir */}
      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-base flex items-center gap-2">
            <Ban className="h-4 w-4 text-red-500" aria-hidden="true" /> Kontak Diblokir
          </CardTitle>
          <CardDescription>Kontak yang diblokir tidak dapat mengirim pesan atau menelepon Anda</CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          {!blocked ? (
            <div className="space-y-3">
              {[0, 1].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              ))}
            </div>
          ) : blocked.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Tidak ada kontak yang diblokir 🎉</p>
          ) : (
            <ul className="max-h-96 overflow-y-auto wa-scrollbar divide-y divide-border" aria-label="Daftar kontak diblokir">
              {blocked.map((c) => (
                <li key={c.id} className="flex items-center gap-3 py-2.5">
                  <span
                    className={cn(
                      "h-10 w-10 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0",
                      colorOf(c.colorKey).bg
                    )}
                    aria-hidden="true"
                  >
                    {getInitials(c.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{c.phone}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => unblock(c)}
                    disabled={unblocking === c.id}
                    aria-label={`Buka blokir ${c.name}`}
                  >
                    {unblocking === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    Buka blokir
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Dialog PIN dua langkah */}
      <Dialog open={twoStepOpen} onOpenChange={(o) => !pinSaving && setTwoStepOpen(o)}>
        <DialogContent className="sm:max-w-sm" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" /> Buat PIN Verifikasi Dua Langkah
            </DialogTitle>
            <DialogDescription>
              Masukkan PIN 6 digit. PIN ini akan diminta saat mendaftarkan nomor Anda di WhatsApp lagi.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-2">
            <InputOTP maxLength={6} value={pin} onChange={setPin} autoFocus>
              <InputOTPGroup>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <InputOTPSlot key={i} index={i} />
                ))}
              </InputOTPGroup>
            </InputOTP>
            <Separator />
            <p className="text-[11px] text-muted-foreground text-center">
              Jangan gunakan PIN yang mudah ditebak seperti tanggal lahir.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTwoStepOpen(false)} disabled={pinSaving}>
              Batal
            </Button>
            <Button onClick={confirmPin} disabled={pin.length !== 6 || pinSaving} className="min-w-32">
              {pinSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Menyimpan…
                </>
              ) : (
                "Aktifkan"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
