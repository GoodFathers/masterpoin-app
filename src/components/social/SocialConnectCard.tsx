"use client";

import { useCallback, useSyncExternalStore } from "react";
import { Facebook, Instagram, Share2, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { useBusinessProfile } from "@/lib/useBusinessProfile";

const LS_FB = "bj_social_fb";
const LS_IG = "bj_social_ig";

/** Flag boolean kecil yang tersimpan di localStorage, aman SSR (false di server), tersinkron antar-tab. */
function useLocalStorageFlag(key: string): [boolean, (v: boolean) => void] {
  const subscribe = useCallback((cb: () => void) => {
    window.addEventListener("storage", cb);
    return () => window.removeEventListener("storage", cb);
  }, []);
  const getSnapshot = useCallback(() => window.localStorage.getItem(key) === "1", [key]);
  const getServerSnapshot = useCallback(() => false, []);
  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const set = useCallback(
    (v: boolean) => {
      try {
        window.localStorage.setItem(key, v ? "1" : "0");
      } catch {
        /* penyimpanan tidak tersedia — abaikan */
      }
      window.dispatchEvent(new Event("storage"));
    },
    [key]
  );
  return [value, set];
}

function Row({
  icon,
  name,
  desc,
  connected,
  onToggle,
}: {
  icon: React.ReactNode;
  name: string;
  desc: string;
  connected: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border p-3">
      {icon}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{name}</p>
        <p className="truncate text-xs text-muted-foreground">{desc}</p>
      </div>
      <Switch checked={connected} onCheckedChange={onToggle} aria-label={`Hubungkan ${name}`} />
    </div>
  );
}

/** Kartu "Integrasi Facebook & Instagram": sakelar koneksi demo, tersimpan di localStorage. */
export default function SocialConnectCard() {
  const { businessName } = useBusinessProfile();
  const { toast } = useToast();
  const [fb, setFb] = useLocalStorageFlag(LS_FB);
  const [ig, setIg] = useLocalStorageFlag(LS_IG);

  function toggle(which: "fb" | "ig") {
    const next = which === "fb" ? !fb : !ig;
    if (which === "fb") setFb(next);
    else setIg(next);
    toast({
      title: next ? `${which === "fb" ? "Facebook" : "Instagram"} terhubung` : `Koneksi ${which === "fb" ? "Facebook" : "Instagram"} diputus`,
      description: next
        ? "Interaksi dari sosial media kini tercatat di dasbor (demo)."
        : "Anda dapat menghubungkan kembali kapan saja.",
    });
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4 md:p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10" aria-hidden>
            <Share2 className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold">Integrasi Facebook & Instagram</h3>
            <p className="text-xs text-muted-foreground">
              Hubungkan akun sosial media agar katalog & keranjang tampil di halaman bisnis Anda.
            </p>
          </div>
        </div>

        <div className="space-y-2.5">
          <Row
            icon={
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white"
                style={{ background: "#1877F2" }}
                aria-hidden
              >
                <Facebook className="h-5 w-5" />
              </div>
            }
            name="Facebook"
            desc={fb ? `Terhubung — Halaman ${businessName}` : "Hubungkan halaman Facebook bisnis Anda"}
            connected={fb}
            onToggle={() => toggle("fb")}
          />
          {fb ? (
            <div className="flex items-center gap-2 rounded-xl bg-maroon-50 px-3 py-2 text-xs text-maroon-700 dark:bg-maroon-950/40 dark:text-maroon-400">
              <TrendingUp className="h-4 w-4 shrink-0" aria-hidden />
              <span>
                <strong className="font-semibold">12 interaksi</strong> dari Facebook minggu ini 🎉
              </span>
            </div>
          ) : null}

          <Row
            icon={
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white"
                style={{
                  background:
                    "linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)",
                }}
                aria-hidden
              >
                <Instagram className="h-5 w-5" />
              </div>
            }
            name="Instagram"
            desc={ig ? "Terhubung dengan akun Instagram bisnis" : "Hubungkan akun Instagram bisnis Anda"}
            connected={ig}
            onToggle={() => toggle("ig")}
          />
          {ig ? (
            <div className="flex items-center gap-2 rounded-xl bg-maroon-50 px-3 py-2 text-xs text-maroon-700 dark:bg-maroon-950/40 dark:text-maroon-400">
              <TrendingUp className="h-4 w-4 shrink-0" aria-hidden />
              <span>
                <strong className="font-semibold">12 interaksi</strong> dari Instagram minggu ini 🎉
              </span>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
