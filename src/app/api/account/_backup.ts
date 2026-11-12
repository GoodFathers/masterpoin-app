/**
 * Helper bersama untuk BACKUP & RESTORE data akun (nyata — file snapshot JSON di db/backups/).
 * Dipakai oleh: /api/account/backup, /api/account/backup/[id]/download, /api/account/backup/[id]/file, /api/account/restore, /api/account/delete
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export const BACKUP_DIR = path.join(process.cwd(), "db", "backups");

/** Pastikan id aman untuk dipakai sebagai nama file (anti path traversal). */
function assertSafeId(id: string) {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) {
    throw new Error("ID backup tidak valid");
  }
}

export function backupFilePath(id: string): string {
  assertSafeId(id);
  return path.join(BACKUP_DIR, `backup-${id}.json`);
}

export async function ensureBackupDir(): Promise<void> {
  await fs.mkdir(BACKUP_DIR, { recursive: true });
}

/** ID unik gaya cuid (aman untuk nama file). */
export function newBackupId(): string {
  return `c${Date.now().toString(36)}${randomBytes(8).toString("hex")}`;
}

/** Hapus SEMUA file backup di db/backups/ (dipakai saat hapus akun). Best-effort. */
export async function clearBackupFiles(): Promise<number> {
  try {
    const entries = await fs.readdir(BACKUP_DIR);
    let removed = 0;
    for (const name of entries) {
      const p = path.join(BACKUP_DIR, name);
      try {
        const st = await fs.stat(p);
        if (st.isFile()) {
          await fs.unlink(p);
          removed += 1;
        }
      } catch {
        /* lanjut file berikutnya */
      }
    }
    return removed;
  } catch {
    return 0; // folder belum ada — tidak ada yang dihapus
  }
}

// ===================== BANGUN SNAPSHOT =====================

/** Ambil seluruh data dari DB (nyata) dan susun objek snapshot. */
export async function buildSnapshot() {
  // Pastikan profil ada agar snapshot selalu punya profile
  let profile = await db.profile.findUnique({ where: { id: "main" } });
  if (!profile) profile = await db.profile.create({ data: { id: "main" } });

  const [labels, contacts, chats, messages, products, collections, stories, broadcasts, quickReplies, channels, posts, communities, callLogs] =
    await Promise.all([
      db.label.findMany({ orderBy: { sortOrder: "asc" } }),
      db.contact.findMany({ orderBy: { createdAt: "asc" } }),
      db.chat.findMany({ orderBy: { createdAt: "asc" } }),
      db.message.findMany({ orderBy: { createdAt: "asc" } }),
      db.product.findMany({ orderBy: { createdAt: "asc" } }),
      db.collection.findMany({ orderBy: { name: "asc" } }),
      db.story.findMany({ orderBy: { createdAt: "asc" } }),
      db.broadcast.findMany({ orderBy: { createdAt: "asc" } }),
      db.quickReply.findMany({ orderBy: { sortOrder: "asc" } }),
      db.channel.findMany({ orderBy: { createdAt: "asc" } }),
      db.channelPost.findMany({ orderBy: { createdAt: "asc" } }),
      db.community.findMany({ orderBy: { createdAt: "asc" } }),
      db.callLog.findMany({ orderBy: { createdAt: "asc" } }),
    ]);

  const messagesByChat = new Map<string, unknown[]>();
  for (const m of messages) {
    const arr = messagesByChat.get(m.chatId) ?? [];
    arr.push(m);
    messagesByChat.set(m.chatId, arr);
  }
  const postsByChannel = new Map<string, unknown[]>();
  for (const p of posts) {
    const arr = postsByChannel.get(p.channelId) ?? [];
    arr.push(p);
    postsByChannel.set(p.channelId, arr);
  }

  const snapshot = {
    version: 1,
    createdAt: new Date().toISOString(),
    profile,
    labels,
    contacts,
    chats: chats.map((c) => ({ ...c, messages: messagesByChat.get(c.id) ?? [] })),
    products,
    collections,
    stories,
    broadcasts,
    quickReplies,
    channels: channels.map((ch) => ({ ...ch, posts: postsByChannel.get(ch.id) ?? [] })),
    communities,
    callLogs,
  };

  return { snapshot, messageCount: messages.length };
}

// ===================== VALIDASI & SANITISASI SNAPSHOT =====================

export class SnapshotError extends Error {}

type Row = Record<string, unknown>;

function reqRow(v: unknown, name: string): Row {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new SnapshotError(`Bagian "${name}" tidak valid`);
  return v as Row;
}
function reqArr(v: unknown, name: string): unknown[] {
  if (!Array.isArray(v)) throw new SnapshotError(`Bagian "${name}" wajib berupa daftar`);
  return v;
}
function reqId(v: unknown, label: string): string {
  if (typeof v !== "string" || !v.trim()) throw new SnapshotError(`ID pada ${label} wajib ada`);
  return v;
}
function str(v: unknown, fallback: string): string {
  return typeof v === "string" ? v : fallback;
}
function optStr(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}
function int(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}
function flt(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}
function iso(v: unknown, label: string, fallback?: string): string {
  const t = typeof v === "string" || typeof v === "number" ? Date.parse(v as string) : NaN;
  if (Number.isFinite(t)) return new Date(t).toISOString();
  if (fallback !== undefined) return fallback;
  throw new SnapshotError(`Tanggal pada ${label} tidak valid`);
}
function isoOpt(v: unknown, label: string): string | null {
  if (v === null || v === undefined || v === "") return null;
  return iso(v, label);
}

const PROFILE_DEFAULTS = {
  businessName: "IndiGoo",
  ownerName: "Pak Jaya Santoso",
  category: "Toko Souvenir & Pangan Olahan",
  description: "",
  address: "",
  lat: -7.7956,
  lng: 110.3695,
  phone: "+62 851-9651-3337",
  email: "",
  website: "",
  instagram: "",
  facebook: "",
  tiktok: "",
  hours: "[]",
  logoUrl: "/images/logo.png",
  verified: false,
  verificationStatus: "NONE",
  brandProtected: false,
  lastSeen: "everyone",
  onlineStatus: "everyone",
  profilePhotoVis: "everyone",
  statusVis: "contacts",
  readReceipts: true,
  twoStepEnabled: false,
  blockedStrangers: false,
  notifMessages: true,
  notifGroups: true,
  notifCalls: true,
  notifPreview: true,
  notifSound: true,
  phoneNumber: "+62 851-9651-3337",
  autoBackup: "daily",
  greetingEnabled: true,
  greetingText: "",
  awayEnabled: false,
  awayText: "",
  storeOpen: true,
};

type ProfileFields = Omit<Prisma.ProfileUncheckedCreateInput, "id">;
function sanitizeProfileFields(raw: Row): ProfileFields {
  const d = PROFILE_DEFAULTS;
  return {
    businessName: str(raw.businessName, d.businessName),
    ownerName: str(raw.ownerName, d.ownerName),
    category: str(raw.category, d.category),
    description: str(raw.description, d.description),
    address: str(raw.address, d.address),
    lat: flt(raw.lat, d.lat),
    lng: flt(raw.lng, d.lng),
    phone: str(raw.phone, d.phone),
    email: str(raw.email, d.email),
    website: str(raw.website, d.website),
    instagram: str(raw.instagram, d.instagram),
    facebook: str(raw.facebook, d.facebook),
    tiktok: str(raw.tiktok, d.tiktok),
    hours: str(raw.hours, d.hours),
    logoUrl: str(raw.logoUrl, d.logoUrl),
    verified: bool(raw.verified, d.verified),
    verificationStatus: str(raw.verificationStatus, d.verificationStatus),
    brandProtected: bool(raw.brandProtected, d.brandProtected),
    lastSeen: str(raw.lastSeen, d.lastSeen),
    onlineStatus: str(raw.onlineStatus, d.onlineStatus),
    profilePhotoVis: str(raw.profilePhotoVis, d.profilePhotoVis),
    statusVis: str(raw.statusVis, d.statusVis),
    readReceipts: bool(raw.readReceipts, d.readReceipts),
    twoStepEnabled: bool(raw.twoStepEnabled, d.twoStepEnabled),
    blockedStrangers: bool(raw.blockedStrangers, d.blockedStrangers),
    notifMessages: bool(raw.notifMessages, d.notifMessages),
    notifGroups: bool(raw.notifGroups, d.notifGroups),
    notifCalls: bool(raw.notifCalls, d.notifCalls),
    notifPreview: bool(raw.notifPreview, d.notifPreview),
    notifSound: bool(raw.notifSound, d.notifSound),
    phoneNumber: str(raw.phoneNumber, d.phoneNumber),
    autoBackup: str(raw.autoBackup, d.autoBackup),
    greetingEnabled: bool(raw.greetingEnabled, d.greetingEnabled),
    greetingText: str(raw.greetingText, d.greetingText),
    awayEnabled: bool(raw.awayEnabled, d.awayEnabled),
    awayText: str(raw.awayText, d.awayText),
    storeOpen: bool(raw.storeOpen, d.storeOpen),
  };
}

export type ParsedSnapshot = {
  profileFields: ProfileFields | null;
  labels: Prisma.LabelCreateManyInput[];
  contacts: Prisma.ContactCreateManyInput[];
  chats: (Prisma.ChatCreateManyInput & { messages: Prisma.MessageCreateManyInput[] })[];
  products: Prisma.ProductCreateManyInput[];
  collections: Prisma.CollectionCreateManyInput[];
  stories: Prisma.StoryCreateManyInput[];
  broadcasts: Prisma.BroadcastCreateManyInput[];
  quickReplies: Prisma.QuickReplyCreateManyInput[];
  channels: (Prisma.ChannelCreateManyInput & { posts: Prisma.ChannelPostCreateManyInput[] })[];
  communities: Prisma.CommunityCreateManyInput[];
  callLogs: Prisma.CallLogCreateManyInput[];
};

/** Validasi struktur snapshot + sanitasi tiap baris (whitelist kolom). Melempar SnapshotError bila tidak valid. */
export function parseSnapshot(raw: unknown): ParsedSnapshot {
  const root = reqRow(raw, "snapshot");
  if (root.version !== undefined && int(root.version, 0) !== 1) {
    throw new SnapshotError("Versi file backup tidak didukung");
  }

  const profileFields = root.profile ? sanitizeProfileFields(reqRow(root.profile, "profile")) : null;

  const collections = reqArr(root.collections, "collections").map((item, i) => {
    const r = reqRow(item, `collections[${i}]`);
    return { id: reqId(r.id, `collections[${i}]`), name: str(r.name, "Koleksi") };
  });
  const collectionIds = new Set(collections.map((c) => String(c.id)));

  const labels = reqArr(root.labels, "labels").map((item, i) => {
    const r = reqRow(item, `labels[${i}]`);
    return {
      id: reqId(r.id, `labels[${i}]`),
      name: str(r.name, "Label"),
      colorKey: str(r.colorKey, "amber"),
      sortOrder: int(r.sortOrder, i),
    };
  });
  const labelIds = new Set(labels.map((l) => String(l.id)));

  const contacts = reqArr(root.contacts, "contacts").map((item, i) => {
    const r = reqRow(item, `contacts[${i}]`);
    const labelIdsRaw = str(r.labelIds, "[]");
    // Validasi labelIds adalah JSON array string yang valid
    try {
      const parsed: unknown = JSON.parse(labelIdsRaw);
      if (!Array.isArray(parsed)) throw new Error("bukan array");
    } catch {
      throw new SnapshotError(`labelIds pada contacts[${i}] bukan JSON array yang valid`);
    }
    let lastSeen: string | null = null;
    try {
      lastSeen = isoOpt(r.lastSeen, `contacts[${i}].lastSeen`);
    } catch {
      lastSeen = null;
    }
    return {
      id: reqId(r.id, `contacts[${i}]`),
      name: str(r.name, "Kontak"),
      phone: str(r.phone, ""),
      colorKey: str(r.colorKey, "emerald"),
      about: str(r.about, "Tersedia"),
      lastSeen,
      blocked: bool(r.blocked, false),
      labelIds: labelIdsRaw,
      createdAt: iso(r.createdAt, `contacts[${i}].createdAt`, new Date().toISOString()),
    };
  });
  const contactIds = new Set(contacts.map((c) => String(c.id)));

  const chats = reqArr(root.chats, "chats").map((item, i) => {
    const r = reqRow(item, `chats[${i}]`);
    const chatId = reqId(r.id, `chats[${i}]`);
    const contactId = optStr(r.contactId);
    if (contactId && !contactIds.has(contactId)) {
      throw new SnapshotError(`chats[${i}] merujuk kontak yang tidak ada di snapshot`);
    }
    const messages = reqArr(r.messages, `chats[${i}].messages`).map((mm, j) => {
      const m = reqRow(mm, `chats[${i}].messages[${j}]`);
      if (String(m.chatId ?? "") !== chatId) {
        throw new SnapshotError(`chats[${i}].messages[${j}].chatId tidak cocok dengan induknya`);
      }
      return {
        id: reqId(m.id, `chats[${i}].messages[${j}]`),
        chatId,
        sender: str(m.sender, "me"),
        type: str(m.type, "TEXT"),
        body: str(m.body, ""),
        mediaUrl: optStr(m.mediaUrl),
        mediaName: optStr(m.mediaName),
        mediaMime: optStr(m.mediaMime),
        mediaSize: m.mediaSize === null || m.mediaSize === undefined ? null : int(m.mediaSize, 0),
        latitude: m.latitude === null || m.latitude === undefined ? null : flt(m.latitude, 0),
        longitude: m.longitude === null || m.longitude === undefined ? null : flt(m.longitude, 0),
        placeName: optStr(m.placeName),
        cardName: optStr(m.cardName),
        cardPhone: optStr(m.cardPhone),
        productId: optStr(m.productId),
        status: str(m.status, "SENT"),
        createdAt: iso(m.createdAt, `chats[${i}].messages[${j}].createdAt`, new Date().toISOString()),
      };
    });
    return {
      id: chatId,
      type: str(r.type, "PRIVATE"),
      name: optStr(r.name),
      avatarUrl: optStr(r.avatarUrl),
      colorKey: str(r.colorKey, "emerald"),
      contactId,
      members: str(r.members, "[]"),
      groupDesc: str(r.groupDesc, ""),
      pinned: bool(r.pinned, false),
      archived: bool(r.archived, false),
      muted: bool(r.muted, false),
      unread: int(r.unread, 0),
      isBusinessChat: bool(r.isBusinessChat, false),
      lastMessageAt: iso(r.lastMessageAt, `chats[${i}].lastMessageAt`, new Date().toISOString()),
      createdAt: iso(r.createdAt, `chats[${i}].createdAt`, new Date().toISOString()),
      messages,
    };
  });

  const products = reqArr(root.products, "products").map((item, i) => {
    const r = reqRow(item, `products[${i}]`);
    const collectionId = optStr(r.collectionId);
    if (collectionId && !collectionIds.has(collectionId)) {
      throw new SnapshotError(`products[${i}] merujuk koleksi yang tidak ada di snapshot`);
    }
    return {
      id: reqId(r.id, `products[${i}]`),
      name: str(r.name, "Produk"),
      price: flt(r.price, 0),
      description: str(r.description, ""),
      sku: str(r.sku, `BJ-RST-${i}`),
      imageUrl: optStr(r.imageUrl),
      link: str(r.link, ""),
      stock: int(r.stock, 0),
      available: bool(r.available, true),
      collectionId,
      createdAt: iso(r.createdAt, `products[${i}].createdAt`, new Date().toISOString()),
    };
  });

  const stories = reqArr(root.stories, "stories").map((item, i) => {
    const r = reqRow(item, `stories[${i}]`);
    return {
      id: reqId(r.id, `stories[${i}]`),
      sender: str(r.sender, "me"),
      mediaType: str(r.mediaType, "IMAGE"),
      body: str(r.body, ""),
      mediaUrl: optStr(r.mediaUrl),
      bgColor: str(r.bgColor, "emerald"),
      views: int(r.views, 0),
      createdAt: iso(r.createdAt, `stories[${i}].createdAt`, new Date().toISOString()),
      expiresAt: iso(r.expiresAt, `stories[${i}].expiresAt`, new Date(Date.now() + 86_400_000).toISOString()),
    };
  });

  const broadcasts = reqArr(root.broadcasts, "broadcasts").map((item, i) => {
    const r = reqRow(item, `broadcasts[${i}]`);
    let sentAt: string | null = null;
    try {
      sentAt = isoOpt(r.sentAt, `broadcasts[${i}].sentAt`);
    } catch {
      sentAt = null;
    }
    return {
      id: reqId(r.id, `broadcasts[${i}]`),
      name: str(r.name, "Siaran"),
      message: str(r.message, ""),
      mediaUrl: optStr(r.mediaUrl),
      audienceType: str(r.audienceType, "ALL"),
      audienceLabel: optStr(r.audienceLabel),
      recipientCount: int(r.recipientCount, 0),
      sentCount: int(r.sentCount, 0),
      deliveredCount: int(r.deliveredCount, 0),
      readCount: int(r.readCount, 0),
      failedCount: int(r.failedCount, 0),
      status: str(r.status, "DRAFT"),
      createdAt: iso(r.createdAt, `broadcasts[${i}].createdAt`, new Date().toISOString()),
      sentAt,
    };
  });

  const quickReplies = reqArr(root.quickReplies, "quickReplies").map((item, i) => {
    const r = reqRow(item, `quickReplies[${i}]`);
    return {
      id: reqId(r.id, `quickReplies[${i}]`),
      shortcut: str(r.shortcut, `/cepat${i + 1}`),
      message: str(r.message, ""),
      sortOrder: int(r.sortOrder, i),
    };
  });

  const channels = reqArr(root.channels, "channels").map((item, i) => {
    const r = reqRow(item, `channels[${i}]`);
    const channelId = reqId(r.id, `channels[${i}]`);
    const posts = reqArr(r.posts, `channels[${i}].posts`).map((pp, j) => {
      const p = reqRow(pp, `channels[${i}].posts[${j}]`);
      if (String(p.channelId ?? "") !== channelId) {
        throw new SnapshotError(`channels[${i}].posts[${j}].channelId tidak cocok dengan induknya`);
      }
      return {
        id: reqId(p.id, `channels[${i}].posts[${j}]`),
        channelId,
        body: str(p.body, ""),
        imageUrl: optStr(p.imageUrl),
        likes: int(p.likes, 0),
        likedByMe: bool(p.likedByMe, false),
        views: int(p.views, 0),
        createdAt: iso(p.createdAt, `channels[${i}].posts[${j}].createdAt`, new Date().toISOString()),
      };
    });
    return {
      id: channelId,
      name: str(r.name, "Channel"),
      handle: str(r.handle, `channel-${i + 1}`),
      description: str(r.description, ""),
      colorKey: str(r.colorKey, "emerald"),
      imageUrl: optStr(r.imageUrl),
      followers: int(r.followers, 0),
      following: bool(r.following, false),
      isMine: bool(r.isMine, false),
      verified: bool(r.verified, false),
      createdAt: iso(r.createdAt, `channels[${i}].createdAt`, new Date().toISOString()),
      posts,
    };
  });

  const communities = reqArr(root.communities, "communities").map((item, i) => {
    const r = reqRow(item, `communities[${i}]`);
    return {
      id: reqId(r.id, `communities[${i}]`),
      name: str(r.name, "Komunitas"),
      description: str(r.description, ""),
      colorKey: str(r.colorKey, "teal"),
      memberCount: int(r.memberCount, 0),
      groups: str(r.groups, "[]"),
      announcement: str(r.announcement, ""),
      createdAt: iso(r.createdAt, `communities[${i}].createdAt`, new Date().toISOString()),
    };
  });

  const callLogs = reqArr(root.callLogs, "callLogs").map((item, i) => {
    const r = reqRow(item, `callLogs[${i}]`);
    return {
      id: reqId(r.id, `callLogs[${i}]`),
      contactId: optStr(r.contactId),
      contactName: str(r.contactName, "Tanpa Nama"),
      colorKey: str(r.colorKey, "emerald"),
      kind: str(r.kind, "VOICE"),
      direction: str(r.direction, "OUT"),
      durationSec: int(r.durationSec, 0),
      createdAt: iso(r.createdAt, `callLogs[${i}].createdAt`, new Date().toISOString()),
    };
  });

  // Validasi konsistensi labelIds terhadap label snapshot
  if (labelIds.size > 0) {
    for (const c of contacts) {
      try {
        const ids: unknown = JSON.parse(String(c.labelIds ?? "[]"));
        if (Array.isArray(ids)) {
          for (const id of ids) {
            if (typeof id === "string" && id && !labelIds.has(id)) {
              throw new SnapshotError(`kontak "${c.name ?? c.id}" merujuk label yang tidak ada di snapshot`);
            }
          }
        }
      } catch (e) {
        if (e instanceof SnapshotError) throw e;
      }
    }
  }

  return { profileFields, labels, contacts, chats, products, collections, stories, broadcasts, quickReplies, channels, communities, callLogs };
}

/** Baca file snapshot sebagai teks (melempar bila tidak ada). */
export async function readSnapshotFile(id: string): Promise<string> {
  return fs.readFile(backupFilePath(id), "utf8");
}

/** Pulihkan data dari snapshot yang sudah tervalidasi (transaksional: hapus lalu recreate). */
export async function restoreFromSnapshot(snap: ParsedSnapshot) {
  return db.$transaction(async (tx) => {
    // 1) Hapus data terkait (urutan aman FK)
    await tx.message.deleteMany({});
    await tx.channelPost.deleteMany({});
    await tx.chat.deleteMany({});
    await tx.callLog.deleteMany({});
    await tx.story.deleteMany({});
    await tx.broadcast.deleteMany({});
    await tx.quickReply.deleteMany({});
    await tx.community.deleteMany({});
    await tx.channel.deleteMany({});
    await tx.product.deleteMany({});
    await tx.collection.deleteMany({});
    await tx.label.deleteMany({});
    await tx.contact.deleteMany({});

    // 2) Recreate dari snapshot (id asli dipertahankan agar relasi utuh)
    if (snap.collections.length) await tx.collection.createMany({ data: snap.collections });
    if (snap.labels.length) await tx.label.createMany({ data: snap.labels });
    if (snap.contacts.length) await tx.contact.createMany({ data: snap.contacts });
    const chatRows = snap.chats.map(({ messages: _m, ...c }) => c);
    if (chatRows.length) await tx.chat.createMany({ data: chatRows });
    const messageRows = snap.chats.flatMap((c) => c.messages);
    if (messageRows.length) await tx.message.createMany({ data: messageRows });
    if (snap.products.length) await tx.product.createMany({ data: snap.products });
    if (snap.stories.length) await tx.story.createMany({ data: snap.stories });
    if (snap.broadcasts.length) await tx.broadcast.createMany({ data: snap.broadcasts });
    if (snap.quickReplies.length) await tx.quickReply.createMany({ data: snap.quickReplies });
    const channelRows = snap.channels.map(({ posts: _p, ...c }) => c);
    if (channelRows.length) await tx.channel.createMany({ data: channelRows });
    const postRows = snap.channels.flatMap((c) => c.posts);
    if (postRows.length) await tx.channelPost.createMany({ data: postRows });
    if (snap.communities.length) await tx.community.createMany({ data: snap.communities });
    if (snap.callLogs.length) await tx.callLog.createMany({ data: snap.callLogs });

    // 3) Profil: upsert dari snapshot (selalu id "main")
    if (snap.profileFields) {
      await tx.profile.upsert({
        where: { id: "main" },
        update: snap.profileFields as Prisma.ProfileUpdateInput,
        create: { id: "main", ...snap.profileFields },
      });
    }

    return {
      restoredMessages: messageRows.length,
      restoredChats: chatRows.length,
      restoredContacts: snap.contacts.length,
      restoredProducts: snap.products.length,
    };
  });
}
