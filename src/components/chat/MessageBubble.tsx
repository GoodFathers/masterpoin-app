"use client";

import { memo, useMemo, useRef, useState } from "react";
import {
  Check,
  CheckCheck,
  CircleAlert,
  Clock,
  ChevronDown,
  FileText,
  MapPin,
  Play,
  Pause,
  Download,
  Languages,
  Loader2,
  MessageCircle,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { cn, colorOf, formatBytes, formatDuration, formatPoints, formatTime, getInitials } from "@/lib/wa-utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useDisplayPrefs } from "@/lib/display-prefs";
import { FOREIGN_LANGS, LOCAL_LANGS, langNameOf, type TranslateLang } from "@/lib/translate-langs";
import type { ChatMessage, ProductRow } from "./types";

// ---------- Status ticks ----------
function Ticks({ status }: { status: string }) {
  if (status === "PENDING") return <Clock className="h-3.5 w-3.5 text-muted-foreground/80" aria-label="Menunggu" />;
  if (status === "SENT") return <Check className="h-3.5 w-3.5 text-muted-foreground/80" aria-label="Terkirim" />;
  if (status === "DELIVERED")
    return <CheckCheck className="h-3.5 w-3.5 text-muted-foreground/80" aria-label="Tersampaikan" />;
  if (status === "READ") return <CheckCheck className="h-3.5 w-3.5 wa-tick-read" aria-label="Dibaca" />;
  if (status === "FAILED") return <CircleAlert className="h-3.5 w-3.5 text-red-500" aria-label="Gagal dikirim" />;
  return null;
}

// ---------- Voice note ----------
function parseDurationFromBody(body?: string | null): number | null {
  const m = body?.match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const sec = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  return Number.isFinite(sec) ? sec : null;
}

/** Gelombang statis deterministik dari id pesan (fungsi murni, aman lintas render). */
function hashBars(id: string, count: number): number[] {
  let seed = 0;
  for (let i = 0; i < id.length; i++) seed = (seed * 31 + id.charCodeAt(i)) % 100000;
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    out.push(6 + ((seed >> (i % 7)) % 16));
  }
  return out;
}

function VoiceNote({ url, body, id }: { url: string; body?: string | null; id: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [realDuration, setRealDuration] = useState<number | null>(null);
  const [progress, setProgress] = useState(0); // 0..1 (Batch 5: gelombang hidup)

  const parsed = parseDurationFromBody(body);
  const duration = parsed ?? (realDuration && Number.isFinite(realDuration) ? Math.round(realDuration) : 5);

  const bars = useMemo(() => hashBars(id, 22), [id]);

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      void el.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    }
  };

  return (
    <div className="flex items-center gap-2 min-w-[190px] py-0.5">
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Jeda pesan suara" : "Putar pesan suara"}
        className="h-9 w-9 rounded-full bg-primary text-white flex items-center justify-center shrink-0 hover:opacity-90 transition-opacity"
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
      </button>
      <div className="flex items-end gap-[2px] h-7 flex-1" aria-hidden="true">
        {bars.map((h, i) => {
          // Batch 5: batang yang sudah terlewati berwarna primer, sisanya redup
          const passed = progress > 0 && i / bars.length <= progress;
          return (
            <div
              key={i}
              className={cn(
                "w-[3px] rounded-full transition-colors",
                passed ? "bg-primary" : playing ? "bg-primary/40" : "bg-muted-foreground/40"
              )}
              style={{ height: `${h}px` }}
            />
          );
        })}
      </div>
      <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">{formatDuration(duration)}</span>
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        className="hidden"
        onEnded={() => {
          setPlaying(false);
          setProgress(0);
        }}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => {
          const el = e.currentTarget;
          if (Number.isFinite(el.duration) && el.duration > 0) {
            setProgress(el.currentTime / el.duration);
          }
        }}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d) && d > 0) setRealDuration(Math.round(d));
        }}
      />
    </div>
  );
}

// ---------- Kartu produk ----------
function ProductCard({
  message,
  product,
  onOpenProduct,
}: {
  message: ChatMessage;
  product?: ProductRow;
  onOpenProduct?: (productId?: string) => void;
}) {
  const name = product?.name || message.body || "Produk";
  const image = product?.imageUrl || "/images/logo.png";
  return (
    <button
      type="button"
      onClick={() => onOpenProduct?.(product?.id)}
      className="flex items-center gap-3 bg-white/70 dark:bg-white/10 rounded-lg p-2 border border-black/5 dark:border-white/10 min-w-[210px] max-w-[260px] hover:bg-white dark:hover:bg-white/15 transition-colors text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      aria-label={product ? `Lihat produk ${name} di katalog` : "Lihat katalog"}
    >
      <img src={image} alt={name} className="h-12 w-12 rounded-md object-cover shrink-0 bg-secondary" />
      <div className="min-w-0">
        <p className="text-sm font-medium truncate">{name}</p>
        <p className="text-xs text-primary font-semibold">
          {product ? formatPoints(product.price) : "Lihat katalog"}
        </p>
        {product && product.available === false && <p className="text-[11px] text-red-500">Stok habis</p>}
      </div>
    </button>
  );
}

// ---------- Kartu lokasi ----------
function LocationCard({ message }: { message: ChatMessage }) {
  const lat = message.latitude ?? 0;
  const lng = message.longitude ?? 0;
  return (
    <div className="rounded-lg overflow-hidden border border-black/10 w-[240px] max-w-full">
      <a
        href={`https://www.google.com/maps?q=${lat},${lng}`}
        target="_blank"
        rel="noopener noreferrer"
        className="block relative h-28 bg-[#e8eee9]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,120,90,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(0,120,90,0.15) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
        aria-label={`Buka lokasi ${message.placeName ?? ""} di Google Maps`}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="relative flex items-center justify-center">
            <span className="absolute h-8 w-8 rounded-full bg-red-500/20 animate-ping" />
            <MapPin className="h-7 w-7 text-red-500 fill-red-500 drop-shadow" />
          </span>
        </div>
      </a>
      <div className="bg-white dark:bg-secondary px-2.5 py-2">
        <p className="text-sm font-medium truncate">{message.placeName || "Lokasi"}</p>
        <a
          href={`https://www.google.com/maps?q=${lat},${lng}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary hover:underline"
        >
          Buka di Google Maps
        </a>
      </div>
    </div>
  );
}

// ---------- Kartu kontak ----------
function ContactCard({ message }: { message: ChatMessage }) {
  const phoneDigits = (message.cardPhone ?? "").replace(/[^\d]/g, "");
  return (
    <div className="flex items-center gap-3 bg-white/70 dark:bg-white/10 border border-black/5 dark:border-white/10 rounded-lg p-2.5 min-w-[210px]">
      <div className="h-10 w-10 rounded-full bg-primary/15 text-primary flex items-center justify-center font-semibold shrink-0">
        {getInitials(message.cardName)}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium truncate">{message.cardName || "Kontak"}</p>
        <p className="text-xs text-muted-foreground truncate">{message.cardPhone}</p>
        <a
          href={`https://wa.me/${phoneDigits}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-0.5"
        >
          <MessageCircle className="h-3 w-3" /> Pesan ke nomor
        </a>
      </div>
    </div>
  );
}

// ---------- Kartu dokumen ----------
function DocCard({ message }: { message: ChatMessage }) {
  const downloadable = !!message.mediaUrl && message.mediaUrl !== "#";
  return (
    <div className="flex items-center gap-3 bg-white/60 dark:bg-white/10 border border-black/5 dark:border-white/10 rounded-lg p-2.5 min-w-[220px] max-w-[260px]">
      <div className="h-10 w-10 rounded-md bg-red-100 dark:bg-red-500/15 text-red-500 flex items-center justify-center shrink-0">
        <FileText className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{message.mediaName || "Dokumen"}</p>
        <p className="text-[11px] text-muted-foreground">
          {formatBytes(message.mediaSize)}
          {message.mediaMime ? ` • ${message.mediaMime.split("/").pop()?.toUpperCase()}` : ""}
        </p>
      </div>
      {downloadable && (
        <a
          href={message.mediaUrl ?? "#"}
          download={message.mediaName ?? "dokumen"}
          aria-label={`Unduh ${message.mediaName ?? "dokumen"}`}
          className="h-8 w-8 rounded-full flex items-center justify-center text-primary hover:bg-primary/10 transition-colors shrink-0"
        >
          <Download className="h-4 w-4" />
        </a>
      )}
    </div>
  );
}

// ---------- Tombol bahasa di dialog terjemahan ----------
function LangButton({
  lang,
  active,
  disabled,
  onClick,
}: {
  lang: TranslateLang;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant={active ? "default" : "outline"}
      size="sm"
      className="justify-start h-9 min-h-9"
      disabled={disabled}
      onClick={onClick}
    >
      <span className="truncate">{lang.name}</span>
    </Button>
  );
}

// ---------- Menu aksi pesan (dipakai dua sisi) ----------
function MessageActions({
  message,
  onDelete,
  align,
  onTranslate,
}: {
  message: ChatMessage;
  onDelete: (id: string) => void;
  align: "start" | "end";
  onTranslate?: () => void;
}) {
  const [starred, setStarred] = useState(!!message.starred);

  const toggleStar = () => {
    const next = !starred;
    setStarred(next);
    void fetch(`/api/messages/${message.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ starred: next }),
    }).catch(() => setStarred(!next));
  };

  return (
    <div className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Menu pesan"
            className="h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground hover:bg-black/10 transition-colors"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={align} className="w-44">
          <DropdownMenuItem onClick={toggleStar} className="gap-2 cursor-pointer">
            <Star className={cn("h-4 w-4", starred && "text-amber-500 fill-amber-500")} />
            {starred ? "Hapus bintang" : "Beri bintang"}
          </DropdownMenuItem>
          {message.body?.trim() && onTranslate && (
            <DropdownMenuItem onClick={onTranslate} className="gap-2 cursor-pointer">
              <Languages className="h-4 w-4" /> Terjemahkan
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            variant="destructive"
            onClick={() => onDelete(message.id)}
            className="gap-2 cursor-pointer"
          >
            <Trash2 className="h-4 w-4" /> Hapus pesan
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// ---------- Bubble utama ----------
interface MessageBubbleProps {
  message: ChatMessage;
  isGroup: boolean;
  product?: ProductRow;
  onDelete: (id: string) => void;
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  /** Batch 5: kartu produk bisa diklik → buka produk di marketplace. */
  onOpenProduct?: (productId?: string) => void;
}

function MessageBubbleInner({
  message,
  isGroup,
  product,
  onDelete,
  selectMode = false,
  selected = false,
  onToggleSelect,
  onOpenProduct,
}: MessageBubbleProps) {
  const mine = message.sender === "me";
  const [imgError, setImgError] = useState(false);
  const { translateTarget } = useDisplayPrefs();
  const [transOpen, setTransOpen] = useState(false);
  const [transLoading, setTransLoading] = useState(false);
  const [trans, setTrans] = useState<{ target: string; text?: string; error?: string } | null>(null);

  const runTranslate = async (code: string) => {
    const text = message.body?.trim();
    if (!text || transLoading) return;
    setTransOpen(false);
    setTransLoading(true);
    setTrans({ target: code });
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, target: code }),
      });
      const data = (await res.json()) as { translation?: string; error?: string };
      if (!res.ok || !data.translation) throw new Error(data.error || "Terjemahan gagal, coba lagi");
      setTrans({ target: code, text: data.translation });
    } catch (err) {
      setTrans({ target: code, error: err instanceof Error ? err.message : "Terjemahan gagal, coba lagi" });
    } finally {
      setTransLoading(false);
    }
  };

  if (message.type === "SYSTEM" || message.sender === "system") {
    return (
      <div className="flex justify-center my-2 px-4" role="note">
        <span className="bg-white/85 dark:bg-secondary text-muted-foreground text-xs italic px-3 py-1.5 rounded-lg shadow-sm text-center max-w-[80%]">
          {message.body}
        </span>
      </div>
    );
  }

  const showSender = isGroup && !mine && message.senderName;

  return (
    <div
      className={cn("group flex items-end gap-1.5 px-2 sm:px-4", mine ? "justify-end" : "justify-start")}
    >
      {selectMode && (
        <button
          type="button"
          onClick={onToggleSelect}
          aria-label={selected ? "Batalkan pilih pesan" : "Pilih pesan"}
          aria-pressed={selected}
          className={cn(
            "h-6 w-6 rounded-full border-2 flex items-center justify-center shrink-0 mb-1 transition-colors",
            selected
              ? "bg-primary border-primary text-white"
              : "border-muted-foreground/50 bg-white/80 dark:bg-secondary hover:border-primary"
          )}
        >
          {selected && <Check className="h-3.5 w-3.5" />}
        </button>
      )}

      {!selectMode && mine && (
        <MessageActions
          message={message}
          onDelete={onDelete}
          align="end"
          onTranslate={message.body?.trim() ? () => setTransOpen(true) : undefined}
        />
      )}

      <div
        onClick={selectMode ? onToggleSelect : undefined}
        role={selectMode ? "button" : undefined}
        aria-pressed={selectMode ? selected : undefined}
        className={cn(
          "relative max-w-[85%] sm:max-w-[75%] rounded-lg shadow-sm px-2.5 pt-2 pb-1",
          mine ? "bubble-out" : "bubble-in",
          selectMode && "cursor-pointer transition-shadow",
          selectMode && selected && "ring-2 ring-primary"
        )}
      >
        {showSender && (
          <p className={cn("text-xs font-semibold mb-0.5", colorOf(message.senderColorKey).text)}>
            {message.senderName}
          </p>
        )}

        {message.type === "IMAGE" && message.mediaUrl && !imgError && (
          <div className="mb-1">
            <img
              src={message.mediaUrl}
              alt={message.body || "Foto terlampir"}
              className="rounded-md max-h-72 w-auto max-w-full object-cover cursor-pointer"
              onError={() => setImgError(true)}
            />
          </div>
        )}
        {message.type === "IMAGE" && (imgError || !message.mediaUrl) && (
          <p className="text-sm italic text-muted-foreground mb-1">📷 Foto tidak dapat ditampilkan</p>
        )}

        {message.type === "VIDEO" && message.mediaUrl && (
          <video src={message.mediaUrl} controls className="rounded-md max-h-72 max-w-full mb-1" aria-label="Video terlampir" />
        )}

        {message.type === "AUDIO" && message.mediaUrl && (
          <VoiceNote url={message.mediaUrl} body={message.body} id={message.id} />
        )}

        {message.type === "DOC" && <DocCard message={message} />}
        {message.type === "LOCATION" && <LocationCard message={message} />}
        {message.type === "CONTACT_CARD" && <ContactCard message={message} />}
        {message.type === "PRODUCT" && <ProductCard message={message} product={product} onOpenProduct={onOpenProduct} />}

        {message.body && message.type !== "AUDIO" && message.type !== "PRODUCT" && (
          <p className="text-sm whitespace-pre-wrap break-words leading-snug">{message.body}</p>
        )}
        {message.body && message.type === "PRODUCT" && product && (
          <p className="text-xs text-muted-foreground mt-1">{message.body}</p>
        )}

        {/* Hasil terjemahan — tampil menempel di gelembung pesan */}
        {trans && (
          <div
            className="mt-1.5 rounded-md border-l-2 border-primary bg-black/5 dark:bg-white/10 px-2 py-1.5"
            data-translate-block=""
          >
            <div className="flex items-center gap-1">
              {transLoading ? (
                <Loader2 className="h-3 w-3 animate-spin text-primary" aria-hidden="true" />
              ) : (
                <Languages className="h-3 w-3 text-primary" aria-hidden="true" />
              )}
              <span className="text-[10px] font-semibold text-primary">
                {transLoading ? "Menerjemahkan…" : langNameOf(trans.target)}
              </span>
              <button
                type="button"
                onClick={() => setTrans(null)}
                className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Tutup terjemahan"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
            {trans.text && (
              <p className="text-sm whitespace-pre-wrap break-words leading-snug mt-0.5">{trans.text}</p>
            )}
            {trans.error && <p className="text-xs text-destructive mt-0.5">{trans.error}</p>}
          </div>
        )}

        <div className="flex items-center justify-end gap-1 mt-0.5">
          {message.status === "FAILED" && <span className="text-[10px] text-red-500">Gagal dikirim</span>}
          <span className="text-[10px] text-muted-foreground/80 tabular-nums">{formatTime(message.createdAt)}</span>
          {mine && <Ticks status={message.status} />}
          {message.starred && <Star className="h-3 w-3 text-amber-500 fill-amber-500" aria-label="Berbintang" />}
        </div>
      </div>

      {!selectMode && !mine && (
        <MessageActions
          message={message}
          onDelete={onDelete}
          align="start"
          onTranslate={message.body?.trim() ? () => setTransOpen(true) : undefined}
        />
      )}

      {/* Dialog pilih bahasa terjemahan */}
      <Dialog open={transOpen} onOpenChange={setTransOpen}>
        <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto wa-scrollbar">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Languages className="h-4 w-4 text-primary" aria-hidden="true" /> Terjemahkan pesan
            </DialogTitle>
            <DialogDescription>Pilih bahasa tujuan. Hasil terjemahan tampil di gelembung pesan.</DialogDescription>
          </DialogHeader>
          <p className="text-xs text-muted-foreground border-l-2 border-border pl-2 line-clamp-3 italic">
            {message.body}
          </p>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              Bahasa Lokal Indonesia
            </p>
            <div className="grid grid-cols-2 gap-2">
              {LOCAL_LANGS.map((l) => (
                <LangButton
                  key={l.code}
                  lang={l}
                  active={l.code === (trans?.target ?? translateTarget)}
                  disabled={transLoading}
                  onClick={() => void runTranslate(l.code)}
                />
              ))}
            </div>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              Bahasa Asing
            </p>
            <div className="grid grid-cols-2 gap-2">
              {FOREIGN_LANGS.map((l) => (
                <LangButton
                  key={l.code}
                  lang={l}
                  active={l.code === (trans?.target ?? translateTarget)}
                  disabled={transLoading}
                  onClick={() => void runTranslate(l.code)}
                />
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Batch 4: memo — bubble hanya dirender ulang saat properti substantifnya berubah.
// onToggleSelect sengaja dikecualikan (identitas berubah tiap render parent, tetapi
// selalu menutup message.id yang sama sehingga perilakunya identik).
export default memo(MessageBubbleInner, (a, b) =>
  a.message === b.message &&
  a.isGroup === b.isGroup &&
  a.product === b.product &&
  a.onDelete === b.onDelete &&
  a.selectMode === b.selectMode &&
  a.selected === b.selected &&
  a.onOpenProduct === b.onOpenProduct
);
