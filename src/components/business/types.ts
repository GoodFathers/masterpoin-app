// Tipe bersama untuk modul Bisnis (Task 3-b)

export interface HourRow {
  day: string;
  open: string;
  close: string;
  closed: boolean;
}

export interface Profile {
  id: string;
  businessName: string;
  ownerName: string;
  category: string;
  description: string;
  address: string;
  lat: number;
  lng: number;
  phone: string;
  email: string;
  website: string;
  instagram: string;
  facebook: string;
  tiktok: string;
  hours: string;
  logoUrl: string;
  coverUrl: string;
  verified: boolean;
  verificationStatus: string;
  storeOpen: boolean;
  greetingEnabled: boolean;
  greetingText: string;
  awayEnabled: boolean;
  awayText: string;
}

export interface Collection {
  id: string;
  name: string;
  _count?: { products: number };
}

export interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
  sku: string;
  imageUrl: string | null;
  link: string;
  stock: number;
  available: boolean;
  collectionId: string | null;
  collection?: Collection | null;
  createdAt: string;
}

export interface Label {
  id: string;
  name: string;
  colorKey: string;
  sortOrder: number;
}

export interface ContactWithLabels {
  id: string;
  name: string;
  phone: string;
  colorKey: string;
  about: string;
  blocked: boolean;
  labelIds: string;
  labels: Label[];
}

export interface Broadcast {
  id: string;
  name: string;
  message: string;
  mediaUrl: string | null;
  audienceType: string;
  audienceLabel: string | null;
  audienceLabelName?: string | null;
  recipientCount: number;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
  status: string;
  createdAt: string;
  sentAt: string | null;
}

export interface QuickReply {
  id: string;
  shortcut: string;
  message: string;
  sortOrder: number;
}

// ---------- helper parse labelIds ----------
export function parseLabelIds(json: string | null | undefined): string[] {
  try {
    const arr = JSON.parse(json ?? "[]");
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

// ---------- jam operasional ----------
export const WEEK_DAYS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

export function defaultHours(): HourRow[] {
  return WEEK_DAYS.map((day, i) => ({ day, open: "08:00", close: "17:00", closed: i === 6 }));
}

export function parseHours(json: string | null | undefined): HourRow[] {
  try {
    const arr = JSON.parse(json ?? "[]");
    if (Array.isArray(arr) && arr.length > 0) {
      return WEEK_DAYS.map((day, i) => {
        const row = arr.find((r: { day?: string }) => r && typeof r === "object" && r.day === day) as
          | { open?: string; close?: string; closed?: boolean }
          | undefined;
        if (row) {
          return {
            day,
            open: typeof row.open === "string" && row.open ? row.open : "08:00",
            close: typeof row.close === "string" && row.close ? row.close : "17:00",
            closed: Boolean(row.closed),
          };
        }
        return { day, open: "08:00", close: "17:00", closed: i === 6 };
      });
    }
  } catch {
    // ignore
  }
  return defaultHours();
}

// ---------- colorKey valid ----------
export const VALID_COLOR_KEYS = [
  "emerald",
  "green",
  "teal",
  "purple",
  "violet",
  "amber",
  "orange",
  "pink",
  "rose",
  "red",
  "cyan",
  "lime",
] as const;
