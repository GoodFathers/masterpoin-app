"use client";

// ===================== PANEL KETENTUAN EKONOMI mP =====================
// Bagian Panel Admin (Task 82): mengatur ketentuan Top Up, Kirim, dan Tukar
// mP (flag fitur diatur di tab "Fitur"; nilai di sini). Diakses
// SUPER_ADMIN & ADMIN.

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Wallet } from "lucide-react";

interface EconomyConfig {
  topup: { minimal: number; maksimal: number; bonusPercent: number };
  kirim: { minimal: number; biayaPercent: number; limitHarian: number };
  tukar: { minimal: number; kursMpPerRupiah: number; biayaPercent: number };
}

const DEFAULTS: EconomyConfig = {
  topup: { minimal: 10_000, maksimal: 100_000_000, bonusPercent: 0 },
  kirim: { minimal: 1_000, biayaPercent: 0, limitHarian: 10_000_000 },
  tukar: { minimal: 5_000, kursMpPerRupiah: 100, biayaPercent: 0 },
};

function fmt(n: number): string {
  return new Intl.NumberFormat("id-ID").format(n);
}

export default function EconomyPanel() {
  const [economy, setEconomy] = useState<EconomyConfig>(DEFAULTS);
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/admin/config", { cache: "no-store" });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || "Gagal memuat konfigurasi");
        if (alive) {
          setEconomy(d.config.economy ?? DEFAULTS);
          setFlags(d.config.flags ?? {});
        }
      } catch (e) {
        if (alive) setMsg({ ok: false, text: e instanceof Error ? e.message : "Gagal memuat" });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ economy }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Gagal menyimpan");
      setEconomy(d.config.economy ?? economy);
      setMsg({ ok: true, text: "Ketentuan ekonomi tersimpan & langsung berlaku." });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Gagal menyimpan" });
    } finally {
      setSaving(false);
    }
  };

  const num = (v: string): number => Math.max(0, Number(v.replace(/[^0-9.]/g, "")) || 0);

  const field = (label: string, value: number, onChange: (n: number) => void, hint?: string) => (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <Input
        type="number"
        min={0}
        step="any"
        value={value}
        onChange={(e) => onChange(num(e.target.value))}
        className="mt-0.5 h-8 text-sm"
        inputMode="decimal"
      />
      {hint && <span className="text-[10px] text-muted-foreground">{hint}</span>}
    </label>
  );

  if (loading) return <Skeleton className="h-56 w-full" />;

  const flagBadge = (key: string) => {
    const on = flags[key] !== false;
    return (
      <Badge className={`text-[10px] ${on ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" : "bg-muted text-muted-foreground"}`}>
        {on ? "fitur aktif" : "fitur mati"}
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-maroon-700 dark:text-maroon-300" aria-hidden="true" />
          <div>
            <h2 className="text-base font-semibold leading-tight">Ketentuan Top Up, Kirim &amp; Tukar mP</h2>
            <p className="text-xs text-muted-foreground">
              Nilai di bawah menjadi aturan resmi ekonomi mP; on/off tiap fitur di tab &quot;Fitur&quot;.
            </p>
          </div>
        </div>
        <Button size="sm" onClick={() => void save()} disabled={saving}>
          {saving ? "Menyimpan…" : "Simpan Ketentuan"}
        </Button>
      </div>

      {msg && (
        <p className={`text-sm ${msg.ok ? "text-emerald-700 dark:text-emerald-300" : "text-destructive"}`}>{msg.text}</p>
      )}

      <div className="grid gap-3 lg:grid-cols-3">
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Top Up mP</h3>
              {flagBadge("fitur_topup")}
            </div>
            {field("Minimal top up (mP)", economy.topup.minimal, (n) => setEconomy({ ...economy, topup: { ...economy.topup, minimal: n } }))}
            {field("Maksimal top up (mP)", economy.topup.maksimal, (n) => setEconomy({ ...economy, topup: { ...economy.topup, maksimal: n } }))}
            {field("Bonus top up (%)", economy.topup.bonusPercent, (n) => setEconomy({ ...economy, topup: { ...economy.topup, bonusPercent: n } }), "0–100")}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Kirim mP</h3>
              {flagBadge("fitur_kirim_mp")}
            </div>
            {field("Minimal kirim (mP)", economy.kirim.minimal, (n) => setEconomy({ ...economy, kirim: { ...economy.kirim, minimal: n } }))}
            {field("Biaya kirim (%)", economy.kirim.biayaPercent, (n) => setEconomy({ ...economy, kirim: { ...economy.kirim, biayaPercent: n } }), "0–100")}
            {field("Limit harian (mP)", economy.kirim.limitHarian, (n) => setEconomy({ ...economy, kirim: { ...economy.kirim, limitHarian: n } }), `≈ Rp ${fmt(economy.kirim.limitHarian)} setara`)}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Tukar mP</h3>
              {flagBadge("fitur_tukar_mp")}
            </div>
            {field("Minimal tukar (mP)", economy.tukar.minimal, (n) => setEconomy({ ...economy, tukar: { ...economy.tukar, minimal: n } }))}
            {field("Kurs (mP per Rp 1)", economy.tukar.kursMpPerRupiah, (n) => setEconomy({ ...economy, tukar: { ...economy.tukar, kursMpPerRupiah: n } }), `1 mP = Rp ${economy.tukar.kursMpPerRupiah > 0 ? (1 / economy.tukar.kursMpPerRupiah).toFixed(4) : "—"}`)}
            {field("Biaya tukar (%)", economy.tukar.biayaPercent, (n) => setEconomy({ ...economy, tukar: { ...economy.tukar, biayaPercent: n } }), "0–100")}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
