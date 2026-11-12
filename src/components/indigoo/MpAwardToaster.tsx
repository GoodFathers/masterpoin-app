"use client";

import { useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { formatMp } from "@/lib/indigoo";

export interface MpAwardDetail {
  key: string;
  label?: string;
  awarded: number;
  count?: number;
  cap?: number;
  dayTotal?: number;
}

interface MpResponseShape {
  mp?: MpAwardDetail | null;
}

/**
 * Mendengarkan semua respons fetch aplikasi: bila API mengembalikan
 * `mp.awarded > 0` (aktivitas berhadiah mP), tampilkan toast "+N mP"
 * dan beri tahu induk (untuk menyegarkan saldo di TopBar).
 */
export default function MpAwardToaster({ onAwarded }: { onAwarded?: (award: MpAwardDetail) => void }) {
  const { toast } = useToast();
  const onAwardedRef = useRef(onAwarded);

  useEffect(() => {
    onAwardedRef.current = onAwarded;
  }, [onAwarded]);

  useEffect(() => {
    const original = window.fetch.bind(window);

    const patched: typeof fetch = async (input, init) => {
      const res = await original(input, init);
      try {
        const contentType = res.headers.get("content-type") ?? "";
        if (res.ok && contentType.includes("application/json")) {
          const data = (await res.clone().json()) as MpResponseShape | null;
          const mp = data?.mp;
          if (mp && typeof mp.awarded === "number" && mp.awarded > 0) {
            const capped = typeof mp.count === "number" && typeof mp.cap === "number" && mp.count >= mp.cap;
            toast({
              title: `+${formatMp(mp.awarded)} mP`,
              description: capped
                ? `${mp.label ?? "Aktivitas"} — batas harian tercapai (${mp.cap}/hari)`
                : mp.label ?? "Aktivitas tercatat",
            });
            onAwardedRef.current?.(mp);
          }
        }
      } catch {
        // Bukan JSON / sudah dikonsumsi — abaikan
      }
      return res;
    };

    window.fetch = patched;
    return () => {
      window.fetch = original;
    };
  }, [toast]);

  return null;
}
