"use client";

import { useEffect, useRef, useState } from "react";
import { Download, RefreshCw, Share, Sparkles, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export function PwaRegister() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [updating, setUpdating] = useState(false);
  const refreshingRef = useRef(false);

  // Fungsi untuk membersihkan cache lama dan memuat ulang versi terbaru
  const forceUpdateApp = async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setUpdating(true);

    try {
      // 1. Beritahu Service Worker untuk lewati tunggu dan bersihkan cache
      if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ action: "CLEAR_ALL_CACHES" });
        navigator.serviceWorker.controller.postMessage({ action: "SKIP_WAITING" });
      }

      // 2. Hapus Cache Storage lokal peramban secara langsung
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }

      // 3. Update service worker registration
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          await reg.update();
        }
      }
    } catch (err) {
      console.error("Gagal membersihkan cache:", err);
    } finally {
      // 4. Reload halaman dari server tanpa cache
      window.location.reload();
    }
  };

  useEffect(() => {
    // 1. Registrasi Service Worker dengan updateViaCache: 'none'
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { updateViaCache: "none" })
        .then((reg) => {
          // Segera periksa pembaruan saat pertama kali dibuka
          reg.update().catch(() => {});

          reg.onupdatefound = () => {
            const installing = reg.installing;
            if (installing) {
              installing.onstatechange = () => {
                if (installing.state === "installed" && navigator.serviceWorker.controller) {
                  // Ada versi baru! Reload otomatis agar pengguna langsung melihat tampilan terbaru
                  console.log("[PWA] Versi baru terdeteksi. Memperbarui...");
                  forceUpdateApp();
                }
              };
            }
          };
        })
        .catch((err) => console.log("SW register error:", err));

      // Ketika service worker controller berganti, reload sekali
      const handleControllerChange = () => {
        if (!refreshingRef.current) {
          refreshingRef.current = true;
          window.location.reload();
        }
      };
      navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);
    }

    // 2. Deteksi status standalone (sudah terinstal sebagai aplikasi di layar HP)
    const checkStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsStandalone(checkStandalone);

    // 3. Deteksi perangkat iOS (Safari)
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIos(isIosDevice);

    // 4. Tangkap event prompt instalasi Android / Chrome
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      if (!checkStandalone) {
        setShowInstallBanner(true);
      }
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    // 5. Cek versi server secara berkala & saat aplikasi dibuka kembali (visibilitychange)
    const checkServerVersion = async () => {
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        const storedVersion = localStorage.getItem("master_app_version");

        if (!storedVersion) {
          localStorage.setItem("master_app_version", data.version);
        } else if (storedVersion !== data.version) {
          console.log("[PWA] Terdeteksi versi baru dari server:", data.version);
          localStorage.setItem("master_app_version", data.version);
          forceUpdateApp();
        }
      } catch {
        // Abaikan jika sedang offline
      }
    };

    // Jalankan cek versi saat aplikasi kembali ke latar depan (fokus / buka HP)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        checkServerVersion();
        if ("serviceWorker" in navigator) {
          navigator.serviceWorker.getRegistrations().then((regs) => {
            regs.forEach((r) => r.update());
          });
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    const interval = setInterval(checkServerVersion, 45000); // Cek tiap 45 detik

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearInterval(interval);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShowInstallBanner(false);
      setDeferredPrompt(null);
    }
  };

  return (
    <>
      {/* Toast notifikasi jika sedang auto-update */}
      {updating && (
        <div className="fixed top-3 inset-x-0 z-[100] flex justify-center px-4 pointer-events-none animate-rise">
          <div className="flex items-center gap-2 rounded-2xl bg-master-900 px-4 py-2 text-xs font-semibold text-white shadow-2xl border border-white/20">
            <RefreshCw className="h-3.5 w-3.5 animate-spin text-master-400" />
            Pembaruan sistem terdeteksi • Memuat versi terbaru...
          </div>
        </div>
      )}

      {/* Banner Instalasi PWA (hanya muncul jika belum diinstal) */}
      {!isStandalone && showInstallBanner && !updating && (
        <div className="fixed bottom-20 lg:bottom-4 left-4 right-4 z-50 mx-auto max-w-md animate-rise">
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-white p-3.5 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-master-500 to-master-800 text-white font-bold text-sm shadow-sm">
                M
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900">Pasang Master di Layar Utama</p>
                <p className="text-[11px] text-slate-500">
                  Cukup 1x pasang, otomatis selalu terupdate tanpa instal ulang!
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {deferredPrompt ? (
                <button
                  type="button"
                  onClick={handleInstallClick}
                  className="inline-flex items-center gap-1 rounded-xl bg-master-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-master-700 active:scale-95"
                >
                  <Download className="h-3.5 w-3.5" />
                  Instal
                </button>
              ) : isIos ? (
                <span className="flex items-center gap-1 rounded-xl bg-rose-50 px-2 py-1 text-[10px] font-semibold text-master-800">
                  <Share className="h-3 w-3" /> Bagikan ➔ Layar Utama
                </span>
              ) : null}

              <button
                type="button"
                onClick={() => setShowInstallBanner(false)}
                className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-slate-600"
                aria-label="Tutup"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
