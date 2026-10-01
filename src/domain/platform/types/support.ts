/** Типы раздела «platform»: support. */
import type { ISODateTime, Id } from '@/domain/core';

// ─────────────────────────── Поддержка (F-00-182) ───────────────────────────

export type SupportFrom = 'business' | 'client';
export type SupportChannel = 'app' | 'cabinet' | 'phone' | 'whatsapp' | 'telegram' | 'email';
export type SupportTopic = 'help' | 'newSphere' | 'banner' | 'ads' | 'billing' | 'bug' | 'other';
export type SupportStatus = 'open' | 'waiting' | 'closed';
/** Раздел, из которого пришло обращение */
export type SupportSection =
  | 'journal'
  | 'schedule'
  | 'clients'
  | 'online'
  | 'services'
  | 'staff'
  | 'stock'
  | 'finance'
  | 'billing'
  | 'coins'
  | 'settings'
  | 'clientApp';

export interface SupportMessage {
  id: Id;
  author: 'them' | 'us';
  text: string;
  at: ISODateTime;
}

export interface SupportTicket {
  id: Id;
  number: number;
  from: SupportFrom;
  businessId?: Id;
  appUserId?: Id;
  name: string;
  phone?: string;
  channel: SupportChannel;
  section?: SupportSection;
  topic: SupportTopic;
  status: SupportStatus;
  messages: SupportMessage[];
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/** Обращение для экрана: с названием бизнеса и последним сообщением */
export interface SupportTicketView extends SupportTicket {
  businessName?: string;
  lastMessage: string;
}

export interface SupportTicketInput {
  from: SupportFrom;
  businessId?: Id;
  appUserId?: Id;
  name: string;
  phone?: string;
  channel: SupportChannel;
  section?: SupportSection;
  topic: SupportTopic;
  text: string;
}
