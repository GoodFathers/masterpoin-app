"use client";

// ===================== MAPS DI BELAKANG LAYAR INDIIGOO =====================
// Lapisan peta (Leaflet + tile OpenStreetMap) yang terpasang PALING BELAKANG
// (z-0) di bawah seluruh cangkang aplikasi. Menampilkan PIN titik lokasi
// setiap pengguna IndiGoo yang pernah berbagi lokasi:
//  - Mode normal : peta tersembunyi di belakang layar (terlihat di tepi
//    frame aplikasi pada layar lebar), tombol bulat "Peta" untuk membuka.
//  - Mode fokus  : cangkang aplikasi memudar, peta tampil penuh + panel
//    atas (judul, jumlah pengguna, saklar "Bagikan lokasi saya", tutup)
//    + baris chip pengguna di bawah untuk melompat ke pin-nya.
// Lokasi sendiri dibagikan via navigator.geolocation (watchPosition, throttle
// waktu & jarak) → POST /api/location; daftar pin → GET /api/location.

import "leaflet/dist/leaflet.css";
import type { LayerGroup, Map as LeafletMap, Marker } from "leaflet";
import { useCallback, useEffect, useRef, useState } from "react";
import { CircleUserRound, MapPin, Navigation, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn, getInitials, timeAgo } from "@/lib/wa-utils";
import { roleLabelId } from "@/lib/indigoo";

export interface MapUser {
  id: string;
  accessId: string;
  username: string;
  role: string;
  latitude: number | null;
  longitude: number | null;
  locationAt: string | null;
}

type GeoStatus = "idle" | "prompt" | "granted" | "denied" | "unsupported" | "error";

const SHARE_KEY = "indigoo:locshare"; // "0" = matikan
const SHARE_MIN_INTERVAL_MS = 30_000; // posting maks 1x / 30 detik
const SHARE_MIN_MOVE_M = 25; // atau saat pindah > 25 meter
const REFRESH_MS = 30_000;

/** Warna pin stabil dari accessId (hue dari hash sederhana). */
function pinColor(accessId: string): string {
  let h = 0;
  for (let i = 0; i < accessId.length; i++) h = (h * 31 + accessId.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 60% 42%)`;
}

/** Jarak meter antara dua koordinat (haversine). */
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371e3;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

const PIN_CSS = `
.ig-pin-wrap{background:transparent;border:0;}
.ig-pin{width:34px;height:34px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:var(--pin);border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;}
.ig-pin>span{transform:rotate(45deg);color:#fff;font:700 11px/1.2 system-ui,sans-serif;letter-spacing:.02em;}
.ig-pin-me{box-shadow:0 0 0 5px rgba(16,185,129,.30),0 2px 10px rgba(0,0,0,.45);}
.leaflet-container{font:inherit;}
.leaflet-popup-content{margin:10px 12px;}
`;

interface MapLayerProps {
  meId: string;
  /** Mode fokus: cangkang aplikasi memudar & peta tampil penuh. */
  focus: boolean;
  onFocusChange: (v: boolean) => void;
}

export default function MapLayer({ meId, focus, onFocusChange }: MapLayerProps) {
  const [users, setUsers] = useState<MapUser[]>([]);
  const [shareOn, setShareOn] = useState(true);
  const [geoStatus, setGeoStatus] = useState<GeoStatus>("idle");
  const [mapReady, setMapReady] = useState(false);

  const mapElRef = useRef<HTMLDivElement | null>(null);
  const LRef = useRef<typeof import("leaflet") | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const didFitRef = useRef(false);
  const watchRef = useRef<number | null>(null);
  const lastPostRef = useRef<{ at: number; lat: number; lng: number } | null>(null);

  // ---------- Preferensi bagikan lokasi (tersimpan di perangkat) ----------
  useEffect(() => {
    try {
      setShareOn(localStorage.getItem(SHARE_KEY) !== "0");
    } catch {
      /* storage diblokir — pakai default aktif */
    }
  }, []);

  const toggleShare = (v: boolean) => {
    setShareOn(v);
    try {
      localStorage.setItem(SHARE_KEY, v ? "1" : "0");
    } catch {
      /* abaikan */
    }
  };

  // ---------- Muat daftar titik lokasi ----------
  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/location", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { users?: MapUser[] };
      setUsers(data.users ?? []);
    } catch {
      /* jaringan gagal — coba lagi di tick berikutnya */
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), REFRESH_MS);
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  // ---------- Inisialisasi Leaflet (sekali) ----------
  useEffect(() => {
    let cancelled = false;
    let map: LeafletMap | null = null;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !mapElRef.current || mapElRef.current.dataset.leaflet === "1") return;
      mapElRef.current.dataset.leaflet = "1";
      LRef.current = L;
      map = L.map(mapElRef.current, {
        center: [-2.2, 117.5], // Indonesia
        zoom: 5,
        zoomControl: false,
      });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      L.control.zoom({ position: "bottomleft" }).addTo(map);
      layerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      setMapReady(true);
    })();
    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
      layerRef.current = null;
      markersRef.current.clear();
      didFitRef.current = false;
      setMapReady(false);
    };
  }, []);

  // ---------- Gambar / segarkan pin setiap pengguna ----------
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!L || !map || !layer || !mapReady) return;

    layer.clearLayers();
    markersRef.current.clear();
    const pts: [number, number][] = [];
    for (const u of users) {
      if (u.latitude == null || u.longitude == null) continue;
      const pos: [number, number] = [u.latitude, u.longitude];
      pts.push(pos);
      const isMe = u.id === meId;
      const color = isMe ? "#a83a4c" : pinColor(u.accessId);
      const icon = L.divIcon({
        className: "ig-pin-wrap",
        html: `<div class="ig-pin${isMe ? " ig-pin-me" : ""}" style="--pin:${color}"><span>${getInitials(u.username)}</span></div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 34],
        popupAnchor: [0, -32],
      });
      const m = L.marker(pos, { icon, title: u.username, zIndexOffset: isMe ? 1000 : 0 }).addTo(layer);
      m.bindPopup(
        `<div style="min-width:150px">
          <p style="font-weight:700;font-size:13px;margin:0">${u.username}${isMe ? " <span style='color:#a83a4c'>(Anda)</span>" : ""}</p>
          <p style="font-size:11px;color:#666;margin:2px 0 4px">${u.accessId} · ${roleLabelId(u.role)}</p>
          <p style="font-size:11px;color:#888;margin:0">📍 ${u.locationAt ? timeAgo(u.locationAt) : "-"}</p>
        </div>`,
      );
      markersRef.current.set(u.id, m);
    }
    // Sekali di awal: pas-kan tampilan ke semua pin
    if (pts.length > 0 && !didFitRef.current) {
      didFitRef.current = true;
      map.fitBounds(L.latLngBounds(pts).pad(0.25), { maxZoom: 12 });
    }
  }, [users, mapReady, meId]);

  // ---------- Bagikan lokasi sendiri (geolocation, throttled) ----------
  useEffect(() => {
    if (!shareOn) {
      if (watchRef.current != null) {
        navigator.geolocation.clearWatch(watchRef.current);
        watchRef.current = null;
      }
      setGeoStatus("idle");
      return;
    }
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setGeoStatus("unsupported");
      return;
    }
    setGeoStatus("prompt");
    const wid = navigator.geolocation.watchPosition(
      (pos) => {
        setGeoStatus("granted");
        const { latitude, longitude } = pos.coords;
        const last = lastPostRef.current;
        const now = Date.now();
        if (last && now - last.at < SHARE_MIN_INTERVAL_MS && haversine(last.lat, last.lng, latitude, longitude) < SHARE_MIN_MOVE_M) {
          return;
        }
        lastPostRef.current = { at: now, lat: latitude, lng: longitude };
        fetch("/api/location", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ latitude, longitude }),
        })
          .then(() => void load())
          .catch(() => {
            /* coba lagi pada posisi berikutnya */
          });
      },
      (err) => {
        setGeoStatus(err.code === err.PERMISSION_DENIED ? "denied" : "error");
      },
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 20_000 },
    );
    watchRef.current = wid;
    return () => {
      navigator.geolocation.clearWatch(wid);
      watchRef.current = null;
    };
  }, [shareOn, load]);

  // Saat masuk mode fokus: hitung ulang ukuran peta setelah transisi selesai
  useEffect(() => {
    if (!focus) return;
    const t = setTimeout(() => mapRef.current?.invalidateSize(), 330);
    return () => clearTimeout(t);
  }, [focus]);

  /** Lompat ke pin pengguna (dari chip). */
  const flyToUser = (u: MapUser) => {
    const map = mapRef.current;
    if (!map || u.latitude == null || u.longitude == null) return;
    map.flyTo([u.latitude, u.longitude], Math.max(map.getZoom(), 14), { duration: 0.7 });
    const m = markersRef.current.get(u.id);
    if (m) window.setTimeout(() => m.openPopup(), 760);
  };

  const me = users.find((u) => u.id === meId) ?? null;
  const others = users.filter((u) => u.id !== meId);
  const chipUsers = me ? [me, ...others] : others;

  const geoLabel =
    geoStatus === "granted"
      ? "lokasi Anda dibagikan"
      : geoStatus === "prompt"
        ? "meminta izin lokasi…"
        : geoStatus === "denied"
          ? "izin lokasi ditolak — pin Anda tetap tampil"
          : geoStatus === "unsupported"
            ? "perangkat tidak mendukung GPS"
            : geoStatus === "error"
              ? "GPS gagal — coba muat ulang"
              : "berbagi lokasi mati";

  return (
    <>
      <style>{PIN_CSS}</style>

      {/* ===== LAPISAN PETA — paling belakang (z-0) ===== */}
      <div
        className={cn("fixed inset-0 z-0", !focus && "pointer-events-none")}
        aria-hidden={!focus}
        data-testid="map-layer"
      >
        <div ref={mapElRef} className="h-full w-full bg-[#e6e8eb] dark:bg-[#1a1d21]" />
      </div>

      {/* ===== TOMBOL BULAT "Peta" (di atas navigasi bawah) ===== */}
      {!focus && (
        <button
          type="button"
          onClick={() => onFocusChange(true)}
          aria-label={`Buka peta lokasi pengguna — ${users.length} pengguna`}
          data-testid="map-fab"
          className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-4 z-30 flex h-12 items-center gap-2 rounded-full bg-primary pl-3.5 pr-4 text-primary-foreground shadow-xl shadow-primary/30 transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95 lg:bottom-6 lg:right-6"
        >
          <MapPin className="h-5 w-5" aria-hidden="true" />
          <span className="text-sm font-semibold">Peta</span>
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-black/20 px-1 text-[11px] font-bold">
            {users.length}
          </span>
        </button>
      )}

      {/* ===== MODE FOKUS PETA ===== */}
      {focus && (
        <>
          {/* Panel atas: judul + status + saklar bagikan lokasi + tutup */}
          <div className="fixed inset-x-0 top-0 z-40 p-3 sm:p-4" data-testid="map-overlay-top">
            <div className="mx-auto flex max-w-3xl items-center gap-3 rounded-2xl border border-border bg-card/95 p-3 shadow-2xl backdrop-blur">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-maroon-500/15 text-maroon-600">
                <Navigation className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold leading-tight">Peta Lokasi Pengguna</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {users.length} titik lokasi · {geoLabel}
                </p>
              </div>
              <label className="flex shrink-0 cursor-pointer items-center gap-2 rounded-full border border-border px-3 py-1.5">
                <CircleUserRound className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <span className="hidden text-xs font-medium sm:inline">Bagikan lokasi saya</span>
                <span className="text-xs font-medium sm:hidden">Lokasi</span>
                <Switch checked={shareOn} onCheckedChange={toggleShare} aria-label="Bagikan lokasi saya" />
              </label>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0"
                aria-label="Tutup peta"
                onClick={() => onFocusChange(false)}
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </Button>
            </div>
          </div>

          {/* Panel bawah: chip pengguna → lompat ke pin-nya */}
          <div
            className="fixed inset-x-0 bottom-0 z-40 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:p-4"
            data-testid="map-overlay-bottom"
          >
            <div className="mx-auto max-w-3xl">
              {chipUsers.length === 0 ? (
                <p className="rounded-2xl border border-border bg-card/95 px-4 py-3 text-center text-xs text-muted-foreground shadow-2xl backdrop-blur">
                  Belum ada pengguna yang berbagi titik lokasi.
                </p>
              ) : (
                <div
                  role="listbox"
                  aria-label="Daftar pengguna di peta"
                  className="wa-scrollbar flex gap-2 overflow-x-auto pb-1"
                >
                  {chipUsers.map((u) => {
                    const isMe = u.id === meId;
                    return (
                      <button
                        key={u.id}
                        type="button"
                        role="option"
                        aria-selected={isMe}
                        onClick={() => flyToUser(u)}
                        className={cn(
                          "flex shrink-0 items-center gap-2 rounded-full border bg-card/95 py-1.5 pl-1.5 pr-3.5 shadow-lg backdrop-blur transition-colors hover:bg-secondary/70",
                          isMe ? "border-maroon-500/60 ring-1 ring-maroon-500/40" : "border-border",
                        )}
                      >
                        <span
                          aria-hidden="true"
                          className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold text-white"
                          style={{ backgroundColor: isMe ? "#a83a4c" : pinColor(u.accessId) }}
                        >
                          {getInitials(u.username)}
                        </span>
                        <span className="text-left leading-tight">
                          <span className="block max-w-[120px] truncate text-xs font-semibold">
                            {u.username}
                            {isMe && " (Anda)"}
                          </span>
                          <span className="block text-[10px] text-muted-foreground">
                            {u.accessId} · {u.locationAt ? timeAgo(u.locationAt) : "-"}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
