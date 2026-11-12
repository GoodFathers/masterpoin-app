// Tipe bersama untuk fitur Chat (agent 3-a)

export interface ChatContact {
  id: string;
  name: string;
  phone: string;
  colorKey: string;
  lastSeen?: string | null;
  blocked: boolean;
  about: string;
  labelIds: string; // JSON array of label ids
}

export interface ChatLastMessage {
  type: string;
  body: string;
  sender: string;
  senderName?: string;
  status: string;
  createdAt: string;
}

export interface ChatSummary {
  id: string;
  type: string; // PRIVATE | GROUP
  name: string;
  avatarUrl?: string | null;
  colorKey: string;
  pinned: boolean;
  archived: boolean;
  muted: boolean;
  unread: number;
  isBusinessChat: boolean;
  favorite: boolean;
  disappearing: string; // off | 24h | 7d | 90d
  lastMessageAt: string;
  contact: ChatContact | null;
  members: string; // JSON [{contactId, role}]
  groupDesc: string;
  lastMessage: ChatLastMessage | null;
}

export interface ChatMessage {
  id: string;
  chatId: string;
  sender: string; // "me" | contactId | "system"
  senderName?: string;
  senderColorKey?: string;
  type: string; // TEXT | IMAGE | VIDEO | AUDIO | DOC | LOCATION | CONTACT_CARD | PRODUCT | SYSTEM
  body: string;
  mediaUrl?: string | null;
  mediaName?: string | null;
  mediaMime?: string | null;
  mediaSize?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  placeName?: string | null;
  cardName?: string | null;
  cardPhone?: string | null;
  productId?: string | null;
  status: string; // PENDING | SENT | DELIVERED | READ | FAILED
  starred?: boolean;
  createdAt: string;
}

export interface Participant {
  id: string;
  name: string;
  colorKey: string;
  role?: string;
}

export interface ContactRow {
  id: string;
  name: string;
  phone: string;
  colorKey: string;
  about?: string;
  lastSeen?: string | null;
  blocked?: boolean;
  labelIds?: string;
  createdAt?: string;
}

export interface ProductRow {
  id: string;
  name: string;
  price: number;
  imageUrl?: string | null;
  stock?: number;
  available?: boolean;
}

export interface QuickReplyRow {
  id: string;
  shortcut: string;
  message: string;
}

export interface LabelRow {
  id: string;
  name: string;
  colorKey: string;
}

export interface CallRow {
  id: string;
  contactId?: string | null;
  contactName: string;
  colorKey: string;
  kind: string; // VOICE | VIDEO
  direction: string; // IN | OUT | MISSED
  durationSec: number;
  createdAt: string;
}
