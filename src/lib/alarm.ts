// ===================== ALARM TUGAS INDIIGOO =====================
// Mesin bunyi berbasis Web Audio API (tanpa file audio — semua disintesis).
// - playTaskAlarm(): bunyi khusus saat WAKTU TUGAS TIBA (jadwal rutinitas,
//   Check-In kembali tersedia) — "di-di-di" elektronik 3 ketukan.
// - playTaskDone(): bunyi enak didengar saat tugas SELESAI dikerjakan /
//   diklaim / direspon (check-in, kegiatan, rutinitas, appointment).
// - Toggle aktif/nonaktif tersimpan di localStorage (default: aktif).
// File ini client-only yang aman dipanggil dari komponen mana pun
// (semua akses window/audio dijaga typeof window + try/catch).

import { jakartaDay } from "@/lib/indigoo";

// ---------- Preferensi (localStorage) ----------

const ENABLED_KEY = "indigoo:alarm:enabled";
const FIRED_PREFIX = "indigoo:alarmfired:";

export function isAlarmEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(ENABLED_KEY) !== "0";
  } catch {
    return true;
  }
}

export function setAlarmEnabled(on: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ENABLED_KEY, on ? "1" : "0");
  } catch {
    // localStorage penuh/diblokir — abaikan
  }
  updateDebug({ enabled: on });
}

// ---------- AudioContext singleton + buka kunci (autoplay policy) ----------

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

const ACtor = (): typeof AudioContext | null => {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return AC ?? null;
};

/** Ambil (atau buat) AudioContext + node master gain. null bila tak didukung. */
function getCtx(): AudioContext | null {
  const AC = ACtor();
  if (!AC) return null;
  try {
    if (!ctx) {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 1;
      master.connect(ctx.destination);
    }
    return ctx;
  } catch {
    return null;
  }
}

/** Coba aktifkan (resume) context — dipanggil tiap play & gestur pengguna. */
function resumeCtx(): AudioContext | null {
  const c = getCtx();
  if (c && c.state === "suspended") {
    void c.resume().catch(() => undefined);
  }
  return c;
}

let unlockInstalled = false;

/**
 * Pasang pendengar gestur sekali seumur halaman: interaksi pengguna pertama
 * (klik/ketuk/tombol) + kembali ke tab akan me-resume AudioContext sehingga
 * alarm dijamin boleh berbunyi (kebijakan autoplay browser).
 */
export function installAudioUnlock(): void {
  if (unlockInstalled || typeof window === "undefined") return;
  unlockInstalled = true;
  const unlock = () => resumeCtx();
  window.addEventListener("pointerdown", unlock, { passive: true });
  window.addEventListener("touchstart", unlock, { passive: true });
  window.addEventListener("keydown", unlock, { passive: true });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") unlock();
  });
  updateDebug({ enabled: isAlarmEnabled(), ctxState: ctx?.state ?? "none" });
}

/** Priming manual dari handler klik (mis. tombol toggle alarm). */
export function primeAudio(): void {
  resumeCtx();
}

// ---------- Sintesis nada ----------

function tone(c: AudioContext, at: number, freq: number, dur: number, type: OscillatorType, peak: number) {
  try {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, at);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(peak, at + 0.012);
    g.gain.setValueAtTime(peak, Math.max(at + 0.012, at + dur - 0.045));
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(g);
    g.connect(master ?? c.destination);
    osc.start(at);
    osc.stop(at + dur + 0.03);
  } catch {
    // Kegagalan sintesis satu nada tidak boleh merusak lainnya
  }
}

/** Bunyi KHUSUS "waktu tugas tiba": 3 ketukan ganda elektronik (±1,9 detik). */
export function playTaskAlarm(): void {
  if (!isAlarmEnabled()) return;
  const c = resumeCtx();
  if (!c || !master) return;
  try {
    const t0 = c.currentTime + 0.03;
    const E6 = 1318.51;
    const C6 = 1046.5;
    for (let burst = 0; burst < 3; burst++) {
      const b = t0 + burst * 0.62;
      tone(c, b, E6, 0.11, "triangle", 0.3);
      tone(c, b + 0.13, C6, 0.11, "triangle", 0.3);
      tone(c, b + 0.26, E6, 0.13, "triangle", 0.32);
    }
    updateDebug({ ctxState: c.state, lastAlarmAt: Date.now() });
  } catch {
    // abaikan
  }
}

/** Bunyi "tugas selesai / diklaim / direspon": arpeggio naik C-E-G-C (±0,6 detik). */
export function playTaskDone(): void {
  if (!isAlarmEnabled()) return;
  const c = resumeCtx();
  if (!c || !master) return;
  try {
    const t0 = c.currentTime + 0.02;
    tone(c, t0, 523.25, 0.13, "sine", 0.24); // C5
    tone(c, t0 + 0.1, 659.25, 0.13, "sine", 0.24); // E5
    tone(c, t0 + 0.2, 783.99, 0.13, "sine", 0.24); // G5
    tone(c, t0 + 0.3, 1046.5, 0.26, "sine", 0.26); // C6
    tone(c, t0 + 0.3, 1318.51, 0.22, "sine", 0.12); // E6 — kilau kecil
    updateDebug({ ctxState: c.state, lastDoneAt: Date.now() });
  } catch {
    // abaikan
  }
}

// ---------- Bunyi PANGGILAN NYATA (deri masuk, nada tunggu, nada akhir) ----------
// Berbeda dari alarm tugas: dering panggilan esensial untuk UX, jadi punya
// sakelar sendiri "indigoo:call:ring" (default AKTIF) dan pola berulang.

const CALL_RING_KEY = "indigoo:call:ring";

export function isCallRingEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(CALL_RING_KEY) !== "0";
  } catch {
    return true;
  }
}

export function setCallRingEnabled(on: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CALL_RING_KEY, on ? "1" : "0");
  } catch {
    // abaikan
  }
}

/** Pola deri masuk: dua nada cepat "br-ring" klasik (diulang setiap 2 detik). */
function ringBurstOnce(c: AudioContext) {
  const t0 = c.currentTime + 0.02;
  // Nada ganda 2-nada E5+A5 bergoyang — jelas terdengar tapi tidak menyakitkan
  for (let i = 0; i < 2; i++) {
    const at = t0 + i * 0.28;
    tone(c, at, 659.25, 0.18, "sine", 0.28); // E5
    tone(c, at + 0.02, 880, 0.18, "sine", 0.2); // A5 (nada kedua menyatu)
  }
}

let ringTimer: ReturnType<typeof setInterval> | null = null;

/** Mulai DERING panggilan masuk (berulang sampai stopIncomingRing). */
export function startIncomingRing(): void {
  if (typeof window === "undefined" || ringTimer) return;
  const burst = () => {
    if (!isCallRingEnabled()) return;
    const c = resumeCtx();
    if (c) ringBurstOnce(c);
  };
  burst();
  ringTimer = setInterval(burst, 2000);
  updateDebug({ lastRingStartAt: Date.now() });
}

export function stopIncomingRing(): void {
  if (ringTimer) {
    clearInterval(ringTimer);
    ringTimer = null;
    updateDebug({ lastRingStopAt: Date.now() });
  }
}

let backTimer: ReturnType<typeof setInterval> | null = null;

/** Nada tunggu panggilan keluar (beep lembut setiap 3 detik). */
export function startRingback(): void {
  if (typeof window === "undefined" || backTimer) return;
  const beep = () => {
    const c = resumeCtx();
    if (!c) return;
    const t0 = c.currentTime + 0.02;
    tone(c, t0, 440, 0.32, "sine", 0.16);
  };
  beep();
  backTimer = setInterval(beep, 3000);
}

export function stopRingback(): void {
  if (backTimer) {
    clearInterval(backTimer);
    backTimer = null;
  }
}

/** Nada pendek panggilan berakhir / ditolak / sibuk. */
export function playCallEndTone(kind: "end" | "busy" = "end"): void {
  const c = resumeCtx();
  if (!c) return;
  const t0 = c.currentTime + 0.02;
  if (kind === "busy") {
    tone(c, t0, 370, 0.18, "square", 0.12);
    tone(c, t0 + 0.26, 370, 0.18, "square", 0.12);
  } else {
    tone(c, t0, 523.25, 0.14, "sine", 0.2);
    tone(c, t0 + 0.16, 392, 0.22, "sine", 0.2);
  }
}

// ---------- Pencatat "sudah dibunyikan" (anti dobel, per hari WIB) ----------

/** true bila alarm utk (hari WIB, key tugas) sudah dibunyikan hari ini. */
export function wasFired(day: string, key: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(`${FIRED_PREFIX}${day}:${key}`) === "1";
  } catch {
    return true; // gagal baca → anggap sudah (hindari dobel)
  }
}

/** Tandai alarm (hari WIB, key tugas) sebagai pernah dibunyikan + bersihkan hari lama. */
export function markFired(day: string, key: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${FIRED_PREFIX}${day}:${key}`, "1");
    const stale: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(FIRED_PREFIX) && !k.startsWith(`${FIRED_PREFIX}${day}:`)) stale.push(k);
    }
    for (const k of stale) localStorage.removeItem(k);
  } catch {
    // abaikan
  }
  updateDebug({ firedToday: listFired(day) });
}

function listFired(day: string): string[] {
  const out: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(`${FIRED_PREFIX}${day}:`)) out.push(k.slice((`${FIRED_PREFIX}${day}:`).length));
    }
  } catch {
    // abaikan
  }
  return out;
}

/** Hari WIB (yyyy-mm-dd) untuk kunci anti-dobel. */
export function alarmDay(): string {
  return jakartaDay();
}

// ---------- Pemilih tugas yang waktunya baru tiba (fungsi murni) ----------

/** Tugas dianggap "baru tiba" selama X menit pertama sejak jam mulainya. */
export const ALARM_CATCHUP_MIN = 2;

export interface DueTaskInput {
  key: string;
  minutes: number;
  time: string;
  title: string;
  rewardMp: number;
  done: boolean;
  available: boolean;
}

/**
 * Dari status jadwal hari ini, ambil kegiatan yang waktunya BARU tiba:
 * belum selesai, sudah tersedia, dan selisih menit 0..ALARM_CATCHUP_MIN.
 */
export function pickDueTasks<T extends DueTaskInput>(schedule: T[], nowMinutes: number): T[] {
  return schedule.filter(
    (a) => !a.done && a.available && nowMinutes >= a.minutes && nowMinutes - a.minutes <= ALARM_CATCHUP_MIN
  );
}

// ---------- Hook diagnostik (dipakai verifikasi E2E & debugging) ----------

interface AlarmDebug {
  enabled?: boolean;
  ctxState?: string;
  lastAlarmAt?: number;
  lastDoneAt?: number;
  lastRingStartAt?: number;
  lastRingStopAt?: number;
  firedToday?: string[];
}

function updateDebug(patch: AlarmDebug): void {
  if (typeof window === "undefined") return;
  const w = window as unknown as { __indigooAlarm?: AlarmDebug };
  w.__indigooAlarm = { ...(w.__indigooAlarm ?? {}), ...patch };
}
