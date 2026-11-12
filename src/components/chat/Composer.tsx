"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  FileText,
  ImagePlus,
  Loader2,
  MapPin,
  Mic,
  Plus,
  Send,
  Smile,
  Store,
  Trash2,
  UserRound,
  ArrowLeft,
} from "lucide-react";
import { cn, colorOf, formatDuration, formatPoints } from "@/lib/wa-utils";
import { uploadFile, MAX_UPLOAD_MB } from "@/lib/upload";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { ChatMessage, ContactRow, ProductRow, QuickReplyRow } from "./types";

const MAX_UPLOAD = MAX_UPLOAD_MB * 1024 * 1024; // 30 MB — sejajar dengan /api/upload

const EMOJIS = [
  "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣",
  "😊", "😍", "🥰", "😘", "😎", "🤔", "😴", "🙏",
  "👍", "👌", "👏", "💪", "🔥", "🎉", "❤️", "💚",
  "✅", "📦", "🛒", "💰",
];

interface ComposerProps {
  chatId: string;
  blocked?: boolean;
  onUnblock?: () => void;
  sendMessage: (payload: Partial<ChatMessage> & { type: string }) => void;
}

type AttachView = "main" | "location" | "contact" | "product";

export default function Composer({ chatId, blocked, onUnblock, sendMessage }: ComposerProps) {
  const { toast } = useToast();
  const [value, setValue] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [attachView, setAttachView] = useState<AttachView>("main");
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [quickReplies, setQuickReplies] = useState<QuickReplyRow[]>([]);

  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const [uploading, setUploading] = useState(false); // indikator unggah media (Batch 4)

  const mediaInputRef = useRef<HTMLInputElement | null>(null);
  const docInputRef = useRef<HTMLInputElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const cancelledRef = useRef(false);
  const recTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recSecondsRef = useRef(0);

  // Quick replies (route milik 3-b, read-only) — gagal diabaikan
  useEffect(() => {
    fetch("/api/quick-replies", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { quickReplies?: QuickReplyRow[] }) => setQuickReplies(d.quickReplies ?? []))
      .catch(() => setQuickReplies([]));
  }, []);

  useEffect(() => {
    return () => {
      if (recTimerRef.current) clearInterval(recTimerRef.current);
      const rec = recorderRef.current;
      if (rec && rec.state !== "inactive") rec.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const suggestions =
    value.trim().startsWith("/") && value.trim().length >= 1
      ? quickReplies.filter((qr) => qr.shortcut.startsWith(value.trim().toLowerCase()))
      : [];

  // ---------- Kirim teks ----------
  const sendText = () => {
    const text = value.trim();
    if (!text) return;
    sendMessage({ type: "TEXT", body: text });
    setValue("");
  };

  // ---------- File (Batch 4: unggah ke server dulu, kirim 1× dengan URL — bukan base64) ----------
  const handleMediaFile = async (file: File) => {
    if (file.size > MAX_UPLOAD) {
      toast({
        title: "Ukuran file terlalu besar",
        description: `Maksimal ${MAX_UPLOAD_MB.toLocaleString("id-ID")} MB untuk lampiran.`,
        variant: "destructive",
      });
      return;
    }
    setUploading(true);
    try {
      const url = await uploadFile(file, "chat");
      const isImage = file.type.startsWith("image/");
      const isVideo = file.type.startsWith("video/");
      sendMessage({
        type: isImage ? "IMAGE" : isVideo ? "VIDEO" : "DOC",
        mediaUrl: url,
        mediaName: file.name,
        mediaMime: file.type,
        mediaSize: file.size,
        body: "",
      });
    } catch (e) {
      toast({
        title: "Gagal mengunggah lampiran",
        description: e instanceof Error ? e.message : "Periksa koneksi lalu coba lagi.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDocFile = async (file: File) => {
    if (file.size > MAX_UPLOAD) {
      toast({
        title: "Ukuran file terlalu besar",
        description: `Maksimal ${MAX_UPLOAD_MB.toLocaleString("id-ID")} MB untuk dokumen.`,
        variant: "destructive",
      });
      return;
    }
    setUploading(true);
    try {
      const url = await uploadFile(file, "chat");
      sendMessage({
        type: "DOC",
        mediaUrl: url,
        mediaName: file.name,
        mediaMime: file.type || "application/octet-stream",
        mediaSize: file.size,
        body: "",
      });
    } catch (e) {
      toast({
        title: "Gagal mengunggah dokumen",
        description: e instanceof Error ? e.message : "Periksa koneksi lalu coba lagi.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  // ---------- Lokasi ----------
  const sendBusinessLocation = () => {
    sendMessage({
      type: "LOCATION",
      latitude: -7.7929,
      longitude: 110.3657,
      placeName: "IndiGoo, Malioboro",
      body: "",
    });
    setAttachOpen(false);
  };

  const sendCurrentLocation = () => {
    const fallbackSend = () => {
      sendMessage({
        type: "LOCATION",
        latitude: -7.79 + (Math.random() - 0.5) * 0.06,
        longitude: 110.36 + (Math.random() - 0.5) * 0.06,
        placeName: "Lokasi Saat Ini",
        body: "",
      });
    };
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          sendMessage({
            type: "LOCATION",
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            placeName: "Lokasi Saat Ini",
            body: "",
          });
        },
        () => {
          fallbackSend();
          toast({ title: "Tidak bisa mengakses GPS", description: "Mengirim perkiraan lokasi di sekitar Yogyakarta." });
        },
        { timeout: 5000 }
      );
    } else {
      fallbackSend();
    }
    setAttachOpen(false);
  };

  // ---------- Kontak & produk ----------
  const loadContacts = () => {
    if (contacts.length > 0) return;
    fetch("/api/contacts", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { contacts?: ContactRow[] }) => setContacts(d.contacts ?? []))
      .catch(() => setContacts([]));
  };

  const loadProducts = () => {
    if (products.length > 0) return;
    fetch("/api/products", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { products?: ProductRow[] }) => setProducts(d.products ?? []))
      .catch(() => setProducts([]));
  };

  const sendContactCard = (c: ContactRow) => {
    sendMessage({ type: "CONTACT_CARD", cardName: c.name, cardPhone: c.phone, body: "" });
    setAttachOpen(false);
  };

  const sendProduct = (p: ProductRow) => {
    sendMessage({ type: "PRODUCT", productId: p.id, body: p.name });
    setAttachOpen(false);
  };

  // ---------- Rekam pesan suara ----------
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      cancelledRef.current = false;
      recSecondsRef.current = 0;
      setRecSeconds(0);

      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : undefined;
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        if (cancelledRef.current) return;
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        if (blob.size === 0) {
          toast({ title: "Rekaman kosong", description: "Coba rekam sekali lagi ya." });
          return;
        }
        // Batch 4: rekaman diunggah ke server (URL), bukan base64 di database
        const audioFile = new File([blob], "pesan-suara.webm", { type: blob.type });
        const caption = `Pesan suara (${formatDuration(recSecondsRef.current)})`;
        setUploading(true);
        try {
          const url = await uploadFile(audioFile, "chat");
          sendMessage({
            type: "AUDIO",
            mediaUrl: url,
            mediaName: "pesan-suara.webm",
            mediaMime: blob.type,
            mediaSize: blob.size,
            body: caption,
          });
        } catch (e) {
          toast({
            title: "Gagal mengunggah pesan suara",
            description: e instanceof Error ? e.message : "Coba rekam ulang.",
            variant: "destructive",
          });
        } finally {
          setUploading(false);
        }
      };
      rec.start();
      recorderRef.current = rec;
      setRecording(true);
      recTimerRef.current = setInterval(() => {
        recSecondsRef.current += 1;
        setRecSeconds(recSecondsRef.current);
      }, 1000);
    } catch {
      toast({
        title: "Tidak dapat mengakses mikrofon",
        description: "Pastikan izin mikrofon sudah diberikan pada browser.",
        variant: "destructive",
      });
    }
  };

  const stopRecording = (send: boolean) => {
    cancelledRef.current = !send;
    setRecording(false);
    if (recTimerRef.current) {
      clearInterval(recTimerRef.current);
      recTimerRef.current = null;
    }
    const rec = recorderRef.current;
    recorderRef.current = null;
    if (rec && rec.state !== "inactive") rec.stop();
  };

  // ---------- Blokir ----------
  if (blocked) {
    return (
      <div className="shrink-0 bg-secondary border-t border-border px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground text-center sm:text-left">
          Kamu memblokir kontak ini. Buka blokir untuk mengirim pesan.
        </p>
        <Button variant="outline" size="sm" onClick={onUnblock}>
          Buka Blokir
        </Button>
      </div>
    );
  }

  const hasText = value.trim().length > 0;

  return (
    <div className="shrink-0 bg-[#f0f2f5] dark:bg-[#111b21] border-t border-border relative">
      {/* Saran quick reply (/) */}
      {suggestions.length > 0 && !recording && (
        <div
          className="absolute bottom-full left-2 right-2 mb-2 bg-white dark:bg-[#233138] rounded-xl shadow-lg border border-border p-1 max-h-48 overflow-y-auto wa-scrollbar z-10"
          role="listbox"
          aria-label="Saran balasan cepat"
        >
          {suggestions.map((qr) => (
            <button
              key={qr.id}
              type="button"
              role="option"
              aria-selected="false"
              onClick={() => {
                sendMessage({ type: "TEXT", body: qr.message });
                setValue("");
              }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-secondary text-left transition-colors"
            >
              <span className="text-sm font-semibold text-primary shrink-0">{qr.shortcut}</span>
              <span className="text-sm text-muted-foreground truncate">{qr.message}</span>
            </button>
          ))}
        </div>
      )}

      {uploading && (
        <div
          className="absolute bottom-full left-2 mb-2 flex items-center gap-2 bg-white dark:bg-[#233138] rounded-full shadow-lg border border-border px-3 py-1.5 z-10"
          role="status"
          aria-live="polite"
        >
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" aria-hidden="true" />
          <span className="text-xs text-muted-foreground">Mengunggah berkas…</span>
        </div>
      )}

      {recording ? (
        /* ---------- Bar rekaman ---------- */
        <div className="flex items-center gap-3 px-3 py-2.5" role="status" aria-label="Sedang merekam pesan suara">
          <button
            type="button"
            onClick={() => stopRecording(false)}
            aria-label="Batalkan rekaman"
            className="h-10 w-10 rounded-full flex items-center justify-center text-red-500 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="h-5 w-5" />
          </button>
          <span className="h-3 w-3 rounded-full bg-red-500 wa-rec-dot" aria-hidden="true" />
          <span className="text-sm font-medium tabular-nums">{formatDuration(recSeconds)}</span>
          <span className="text-sm text-muted-foreground">Merekam pesan suara…</span>
          <button
            type="button"
            onClick={() => stopRecording(true)}
            aria-label="Kirim pesan suara"
            className="ml-auto h-10 w-10 rounded-full bg-primary text-white flex items-center justify-center hover:opacity-90 transition-opacity"
          >
            <Check className="h-5 w-5" />
          </button>
        </div>
      ) : (
        /* ---------- Bar composer normal ---------- */
        <div className="flex items-end gap-1.5 px-2 py-2">
          {/* Emoji */}
          <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Pilih emoji"
                className="h-10 w-10 rounded-full flex items-center justify-center text-muted-foreground hover:bg-black/5 transition-colors shrink-0"
              >
                <Smile className="h-[22px] w-[22px]" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 p-2" side="top">
              <div className="grid grid-cols-7 gap-1">
                {EMOJIS.map((em) => (
                  <button
                    key={em}
                    type="button"
                    onClick={() => setValue((v) => v + em)}
                    className="h-8 w-8 rounded-md hover:bg-secondary text-lg leading-none transition-colors"
                    aria-label={`Sisipkan emoji ${em}`}
                  >
                    {em}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Lampiran */}
          <Popover
            open={attachOpen}
            onOpenChange={(o) => {
              setAttachOpen(o);
              if (!o) setAttachView("main");
              if (o) {
                setAttachView("main");
                loadContacts();
                loadProducts();
              }
            }}
          >
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Lampirkan berkas"
                className="h-10 w-10 rounded-full flex items-center justify-center text-muted-foreground hover:bg-black/5 transition-colors shrink-0"
              >
                <Plus className="h-[22px] w-[22px]" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 p-1.5" side="top">
              {attachView === "main" && (
                <div className="flex flex-col">
                  <AttachItem
                    icon={<ImagePlus className="h-[18px] w-[18px]" />}
                    label="Foto & Video"
                    onClick={() => mediaInputRef.current?.click()}
                  />
                  <AttachItem
                    icon={<FileText className="h-[18px] w-[18px]" />}
                    label="Dokumen"
                    onClick={() => docInputRef.current?.click()}
                  />
                  <AttachItem
                    icon={<MapPin className="h-[18px] w-[18px]" />}
                    label="Lokasi"
                    onClick={() => setAttachView("location")}
                  />
                  <AttachItem
                    icon={<UserRound className="h-[18px] w-[18px]" />}
                    label="Kontak"
                    onClick={() => setAttachView("contact")}
                  />
                  <AttachItem
                    icon={<Store className="h-[18px] w-[18px]" />}
                    label="Produk"
                    onClick={() => setAttachView("product")}
                  />
                </div>
              )}
              {attachView === "location" && (
                <div className="flex flex-col">
                  <button
                    type="button"
                    onClick={() => setAttachView("main")}
                    className="flex items-center gap-2 text-xs text-muted-foreground px-2 py-1.5 hover:bg-secondary rounded-md"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" /> Kembali
                  </button>
                  <AttachItem icon={<Store className="h-[18px] w-[18px]" />} label="Lokasi Bisnis" onClick={sendBusinessLocation} />
                  <AttachItem icon={<MapPin className="h-[18px] w-[18px]" />} label="Lokasi Saat Ini" onClick={sendCurrentLocation} />
                </div>
              )}
              {attachView === "contact" && (
                <div className="flex flex-col max-h-72 overflow-y-auto wa-scrollbar">
                  <button
                    type="button"
                    onClick={() => setAttachView("main")}
                    className="flex items-center gap-2 text-xs text-muted-foreground px-2 py-1.5 hover:bg-secondary rounded-md sticky top-0 bg-popover"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" /> Kembali
                  </button>
                  {contacts.length === 0 && <p className="text-xs text-muted-foreground px-2 py-3">Memuat kontak…</p>}
                  {contacts.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => sendContactCard(c)}
                      className="flex items-center gap-2.5 px-2 py-2 rounded-md hover:bg-secondary text-left transition-colors"
                    >
                      <span
                        className={cn(
                          "h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0",
                          colorOf(c.colorKey).bg
                        )}
                      >
                        {c.name.slice(0, 2).toUpperCase()}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm truncate">{c.name}</span>
                        <span className="block text-[11px] text-muted-foreground truncate">{c.phone}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {attachView === "product" && (
                <div className="flex flex-col max-h-72 overflow-y-auto wa-scrollbar">
                  <button
                    type="button"
                    onClick={() => setAttachView("main")}
                    className="flex items-center gap-2 text-xs text-muted-foreground px-2 py-1.5 hover:bg-secondary rounded-md sticky top-0 bg-popover"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" /> Kembali
                  </button>
                  {products.length === 0 && <p className="text-xs text-muted-foreground px-2 py-3">Memuat produk…</p>}
                  {products.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => sendProduct(p)}
                      className="flex items-center gap-2.5 px-2 py-2 rounded-md hover:bg-secondary text-left transition-colors"
                    >
                      <img src={p.imageUrl || "/images/logo.png"} alt={p.name} className="h-8 w-8 rounded-md object-cover bg-secondary shrink-0" />
                      <span className="min-w-0">
                        <span className="block text-sm truncate">{p.name}</span>
                        <span className="block text-[11px] text-primary font-medium">{formatPoints(p.price)}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </PopoverContent>
          </Popover>

          {/* Input teks */}
          <Input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendText();
              }
            }}
            placeholder="Ketik pesan…"
            aria-label="Ketik pesan"
            className="flex-1 rounded-full bg-white dark:bg-[#2a3942] dark:text-foreground border-transparent h-10"
          />

          {/* Mic / Send */}
          {hasText ? (
            <button
              type="button"
              onClick={sendText}
              aria-label="Kirim pesan"
              className="h-10 w-10 rounded-full bg-primary text-white flex items-center justify-center hover:opacity-90 transition-opacity shrink-0"
            >
              <Send className="h-[18px] w-[18px]" />
            </button>
          ) : (
            <button
              type="button"
              onClick={startRecording}
              aria-label="Rekam pesan suara"
              className="h-10 w-10 rounded-full flex items-center justify-center text-muted-foreground hover:bg-black/5 transition-colors shrink-0"
            >
              <Mic className="h-[22px] w-[22px]" />
            </button>
          )}
        </div>
      )}

      {/* Input file tersembunyi */}
      <input
        ref={mediaInputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleMediaFile(f);
          e.target.value = "";
          setAttachOpen(false);
        }}
      />
      <input
        ref={docInputRef}
        type="file"
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleDocFile(f);
          e.target.value = "";
          setAttachOpen(false);
        }}
      />
    </div>
  );
}

function AttachItem({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 px-2.5 py-2 rounded-lg hover:bg-secondary text-left text-sm transition-colors"
    >
      <span className="text-primary">{icon}</span>
      {label}
    </button>
  );
}
