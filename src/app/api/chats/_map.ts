// Shared mapping helpers for chat API routes (milik agent 3-a)
import { db } from "@/lib/db";

type ChatRow = {
  id: string;
  type: string;
  name: string | null;
  avatarUrl: string | null;
  colorKey: string;
  pinned: boolean;
  archived: boolean;
  muted: boolean;
  unread: number;
  isBusinessChat: boolean;
  favorite: boolean;
  disappearing: string;
  lastMessageAt: Date;
  members: string;
  groupDesc: string;
  contact: {
    id: string;
    name: string;
    phone: string;
    colorKey: string;
    lastSeen: Date | null;
    blocked: boolean;
    about: string;
    labelIds: string;
  } | null;
  messages: {
    type: string;
    body: string;
    sender: string;
    status: string;
    createdAt: Date;
  }[];
};

export type MappedChat = {
  id: string;
  type: string;
  name: string;
  avatarUrl: string | null;
  colorKey: string;
  pinned: boolean;
  archived: boolean;
  muted: boolean;
  unread: number;
  isBusinessChat: boolean;
  favorite: boolean;
  disappearing: string;
  lastMessageAt: string;
  contact: {
    id: string;
    name: string;
    phone: string;
    colorKey: string;
    lastSeen: string | null;
    blocked: boolean;
    about: string;
    labelIds: string;
  } | null;
  members: string;
  groupDesc: string;
  lastMessage: {
    type: string;
    body: string;
    sender: string;
    senderName?: string;
    status: string;
    createdAt: string;
  } | null;
};

export function mapChat(
  c: ChatRow,
  nameMap?: Map<string, { name: string; colorKey: string }>
): MappedChat {
  const last = c.messages[0];
  return {
    id: c.id,
    type: c.type,
    name: c.type === "GROUP" ? c.name ?? "Grup" : c.contact?.name ?? "Tanpa Nama",
    avatarUrl: c.avatarUrl,
    colorKey: c.type === "GROUP" ? c.colorKey : c.contact?.colorKey ?? c.colorKey,
    pinned: c.pinned,
    archived: c.archived,
    muted: c.muted,
    unread: c.unread,
    isBusinessChat: c.isBusinessChat,
    favorite: c.favorite,
    disappearing: c.disappearing,
    lastMessageAt: c.lastMessageAt.toISOString(),
    contact: c.contact
      ? {
          id: c.contact.id,
          name: c.contact.name,
          phone: c.contact.phone,
          colorKey: c.contact.colorKey,
          lastSeen: c.contact.lastSeen ? c.contact.lastSeen.toISOString() : null,
          blocked: c.contact.blocked,
          about: c.contact.about,
          labelIds: c.contact.labelIds,
        }
      : null,
    members: c.members,
    groupDesc: c.groupDesc,
    lastMessage: last
      ? {
          type: last.type,
          body: last.body,
          sender: last.sender,
          senderName:
            last.sender === "me" ? "Anda" : last.sender === "system" ? "Sistem" : nameMap?.get(last.sender)?.name,
          status: last.status,
          createdAt: last.createdAt.toISOString(),
        }
      : null,
  };
}

export async function getChatFull(id: string) {
  return db.chat.findUnique({
    where: { id },
    include: {
      contact: true,
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
}

type MessageRow = {
  id: string;
  chatId: string;
  sender: string;
  type: string;
  body: string;
  mediaUrl: string | null;
  mediaName: string | null;
  mediaMime: string | null;
  mediaSize: number | null;
  latitude: number | null;
  longitude: number | null;
  placeName: string | null;
  cardName: string | null;
  cardPhone: string | null;
  productId: string | null;
  status: string;
  starred: boolean;
  createdAt: Date;
};

export type MappedMessage = {
  id: string;
  chatId: string;
  sender: string;
  senderName?: string;
  senderColorKey?: string;
  type: string;
  body: string;
  mediaUrl: string | null;
  mediaName: string | null;
  mediaMime: string | null;
  mediaSize: number | null;
  latitude: number | null;
  longitude: number | null;
  placeName: string | null;
  cardName: string | null;
  cardPhone: string | null;
  productId: string | null;
  status: string;
  starred: boolean;
  createdAt: string;
};

export function mapMessage(
  m: MessageRow,
  nameMap?: Map<string, { name: string; colorKey: string }>
): MappedMessage {
  const info = m.sender !== "system" && m.sender !== "me" ? nameMap?.get(m.sender) : undefined;
  return {
    id: m.id,
    chatId: m.chatId,
    sender: m.sender,
    senderName: m.sender === "me" ? "Anda" : m.sender === "system" ? "Sistem" : info?.name,
    senderColorKey: m.sender === "me" ? "emerald" : m.sender === "system" ? undefined : info?.colorKey,
    type: m.type,
    body: m.body,
    mediaUrl: m.mediaUrl,
    mediaName: m.mediaName,
    mediaMime: m.mediaMime,
    mediaSize: m.mediaSize,
    latitude: m.latitude,
    longitude: m.longitude,
    placeName: m.placeName,
    cardName: m.cardName,
    cardPhone: m.cardPhone,
    productId: m.productId,
    status: m.status,
    starred: m.starred,
    createdAt: m.createdAt.toISOString(),
  };
}

export async function contactNameMap(contactIds: string[]) {
  const ids = Array.from(new Set(contactIds.filter((x) => x && x !== "me" && x !== "system")));
  if (ids.length === 0) return new Map<string, { name: string; colorKey: string }>();
  const contacts = await db.contact.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, colorKey: true },
  });
  return new Map(contacts.map((c) => [c.id, { name: c.name, colorKey: c.colorKey }]));
}

export const MESSAGE_TYPES = [
  "TEXT",
  "IMAGE",
  "VIDEO",
  "AUDIO",
  "DOC",
  "LOCATION",
  "CONTACT_CARD",
  "PRODUCT",
  "SYSTEM",
] as const;
