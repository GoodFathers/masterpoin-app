"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Languages, Leaf, Moon, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import SettingsRow from "@/components/extras/SettingsRow";
import { useDisplayPrefs } from "@/lib/display-prefs";
import { FOREIGN_LANGS, LOCAL_LANGS } from "@/lib/translate-langs";

const noopSubscribe = () => () => {};

/**
 * Tab "Tampilan" di Pengaturan: Mode Gelap, Mode Hemat, dan bahasa terjemahan default.
 * Preferensi disimpan di sisi klien (next-themes + zustand persist) — tidak mengubah database.
 */
export default function SettingsDisplayTab() {
  const { theme, setTheme } = useTheme();
  // "Sudah mount" tanpa setState-di-effect (aturan lint): snapshot server=false, client=true
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);

  const isDark = mounted && theme === "dark";
  const lite = useDisplayPrefs((s) => s.lite);
  const setLite = useDisplayPrefs((s) => s.setLite);
  const translateTarget = useDisplayPrefs((s) => s.translateTarget);
  const setTranslateTarget = useDisplayPrefs((s) => s.setTranslateTarget);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-base flex items-center gap-2">
            <Moon className="h-4 w-4 text-primary" aria-hidden="true" /> Mode Tampilan
          </CardTitle>
          <CardDescription>Sesuaikan tampilan aplikasi sesuai kondisi Anda</CardDescription>
        </CardHeader>
        <CardContent className="pt-2 divide-y divide-border">
          <SettingsRow
            title="Mode Gelap"
            description="Tema gelap seperti WhatsApp malam — nyaman di ruangan redup dan hemat layar OLED"
          >
            <Switch
              checked={isDark}
              onCheckedChange={(v) => setTheme(v ? "dark" : "light")}
              disabled={!mounted}
              aria-label="Mode Gelap"
            />
          </SettingsRow>
          <SettingsRow
            title="Mode Hemat"
            description="Matikan animasi, blur, dan bayangan — menghemat baterai & kuota data"
          >
            <Switch checked={lite} onCheckedChange={setLite} aria-label="Mode Hemat" />
          </SettingsRow>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-base flex items-center gap-2">
            <Languages className="h-4 w-4 text-primary" aria-hidden="true" /> Bahasa Terjemahan
          </CardTitle>
          <CardDescription>
            Bahasa tujuan bawaan saat menerjemahkan pesan. Buka menu (⋮) pada pesan chat lalu pilih
            “Terjemahkan”.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          <SettingsRow title="Bahasa tujuan" description="Dipakai sebagai pilihan awal di dialog terjemahan">
            <Select value={translateTarget} onValueChange={setTranslateTarget}>
              <SelectTrigger className="w-[190px]" aria-label="Bahasa tujuan terjemahan">
                <SelectValue placeholder="Pilih bahasa" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Bahasa Lokal Indonesia</SelectLabel>
                  {LOCAL_LANGS.map((l) => (
                    <SelectItem key={l.code} value={l.code}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel>Bahasa Asing</SelectLabel>
                  {FOREIGN_LANGS.map((l) => (
                    <SelectItem key={l.code} value={l.code}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </SettingsRow>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground flex items-start gap-1.5 px-1">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary" aria-hidden="true" />
        Preferensi tampilan tersimpan di perangkat ini dan tidak mengubah data bisnis Anda.
      </p>
    </div>
  );
}
