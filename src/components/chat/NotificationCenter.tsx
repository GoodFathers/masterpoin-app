"use client";

// ===================== NOTIFICATION CENTER (Batch 2 — Task 26) =====================
// Notifikasi pesan baru yang NYATA (sebelumnya flag notif* di DB hanya dekoratif):
//  - Toast in-app saat pesan masuk (chat lain / tab di luar fokus)
//  - Nada "ting" Web Audio (hormati setting notifSound)
//  - Notification API peramban saat tab tersembunyi (hormati izin)
// Aturan yang dihormati: notifMessages, notifGroups, notifPreview, notifSound,
// chat.muted, dan chat yang sedang terbuka di tab ini tidak dinotifikasikan.

import { useEffect, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { messagePreview } from "@/lib/wa-utils";
import {
  getRealtimeSocket,
  getActiveChatId,
  type ChatMessagePush,
} from "@/lib/realtime";

interface NotifSettings {
  notifMessages: boolean;
  notifGroups: boolean;
  notifPreview: boolean;
  notifSound: boolean;
}

const DEFAULT_SETTINGS: NotifSettings = {
  notifMessages: true,
  notifGroups: true,
  notifPreview: true,
  notifSound: true,
};

/** Nada notifikasi "ting-tong" dua nada — berbeda dari ringtone panggilan. */
function playNotifSound(): void {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    const notes: { freq: number; at: number }[] = [
      { freq: 987.77, at: 0 }, // B5
      { freq: 659.25, at: 0.16 }, // E5
    ];
    for (const n of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = n.freq;
      gain.gain.setValueAtTime(0.0001, now + n.at);
      gain.gain.exponentialRampToValueAtTime(0.12, now + n.at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + n.at + 0.28);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + n.at);
      osc.stop(now + n.at + 0.3);
    }
    setTimeout(() => void ctx.close().catch(() => {}), 800);
  } catch {
    // suara adalah bonus — jangan pernah error
  }
}

export default function NotificationCenter() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<NotifSettings>(DEFAULT_SETTINGS);
  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/privacy", { cache: "no-store" });
        if (!res.ok || !alive) return;
        const d = (await res.json()) as { profile?: Partial<NotifSettings> };
        if (alive && d.profile) {
          setSettings((prev) => ({
            notifMessages: d.profile?.notifMessages ?? prev.notifMessages,
            notifGroups: d.profile?.notifGroups ?? prev.notifGroups,
            notifPreview: d.profile?.notifPreview ?? prev.notifPreview,
            notifSound: d.profile?.notifSound ?? prev.notifSound,
          }));
        }
      } catch {
        // abaikan — pakai default
      }
    };
    void load();
    // Setting diperbarui dari SettingsNotificationsTab (dispatch "wa:profile-updated")
    window.addEventListener("wa:profile-updated", load);
    return () => {
      alive = false;
      window.removeEventListener("wa:profile-updated", load);
    };
  }, []);

  useEffect(() => {
    const socket = getRealtimeSocket();

    const onMessage = (p: ChatMessagePush) => {
      if (!p?.message || !p.chatId) return;
      const msg = p.message;
      if (msg.sender === "me") return; // pesan sendiri — bukan notifikasi

      // Chat sedang terbuka di tab ini & tab terlihat → tidak perlu notifikasi
      if (getActiveChatId() === p.chatId && document.visibilityState === "visible") return;

      const s = settingsRef.current;
      // Hormati bisukan per-chat dan setting pengguna
      if (p.chatMuted) return;
      const isGroup = p.chatType === "GROUP";
      if (isGroup && !s.notifGroups) return;
      if (!isGroup && !s.notifMessages) return;

      const senderLabel = msg.senderName ?? "";
      const body = s.notifPreview
        ? `${senderLabel ? `${senderLabel}: ` : ""}${messagePreview(msg) || `[${msg.type.toLowerCase()}]`}`
        : "Pesan baru masuk";

      // Toast in-app
      toast({ title: p.chatName || "Pesan baru", description: body });

      // Nada notifikasi
      if (s.notifSound) playNotifSound();

      // Notifikasi peramban saat tab tersembunyi (jika izin diberikan)
      if (document.visibilityState === "hidden" && typeof Notification !== "undefined" && Notification.permission === "granted") {
        try {
          new Notification(p.chatName || "Pesan baru", { body, silent: !s.notifSound });
        } catch {
          // beberapa browser membatasi constructor — abaikan
        }
      }
    };

    socket.on("chat:message", onMessage);
    return () => {
      socket.off("chat:message", onMessage);
    };
  }, [toast]);

  return null;
}
