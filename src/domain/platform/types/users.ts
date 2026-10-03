/**
 * Наша панель → «Пользователи» (03.10.2026): все зарегистрированные люди. Те же DTO, что отдаёт сервер
 * (booktime-backend, src/modules/platform/users.service.ts). Даты — 'YYYY-MM-DDTHH:mm' по Еревану.
 * Секретов нет: ни хэшей, ни токенов, ни кодов; IP входов — с маской; телефон в списке — с маской.
 */
import type { BookingStatus, ISODate, ISODateTime, Id } from '@/domain/core';

export type PlatformUserStatus = 'active' | 'blocked' | 'delete_requested' | 'deleted';
export type PlatformUserRole = 'owner' | 'admin' | 'master';
export type PlatformUserRoleFilter = 'client' | PlatformUserRole | 'multiple';
export type PlatformUserSort = 'registered' | 'last_login' | 'bookings';
/** code — код из Telegram/SMS, google — «Войти через Google», password — логин администратора или команды */
export type PlatformLoginMethod = 'code' | 'google' | 'password' | 'platform' | 'second_factor';

export interface PlatformUsersQuery {
  q?: string;
  role?: PlatformUserRoleFilter;
  regFrom?: ISODate;
  regTo?: ISODate;
  activeDays?: number;
  telegram?: 'yes' | 'no';
  google?: 'yes' | 'no';
  status?: PlatformUserStatus;
  sort: PlatformUserSort;
  dir: 'asc' | 'desc';
  page: number;
  pageSize: number;
}

export interface PlatformUserRow {
  id: Id;
  name: string;
  phoneMasked: string | null;
  locale: string;
  createdAt: ISODateTime;
  lastLoginAt: ISODateTime | null;
  lastActiveAt: ISODateTime | null;
  roles: PlatformUserRole[];
  telegram: boolean;
  google: boolean;
  status: PlatformUserStatus;
  bookingsCount: number;
  team: boolean;
}

export interface PlatformUsersCounters {
  total: number;
  new7d: number;
  active7d: number;
  telegram: number;
}

export interface PlatformUsersPage {
  rows: PlatformUserRow[];
  total: number;
  page: number;
  pageSize: number;
  counters: PlatformUsersCounters;
}

export interface PlatformUserCard {
  id: Id;
  name: string;
  phone: string | null;
  locale: string;
  createdAt: ISODateTime;
  status: PlatformUserStatus;
  blockedAt: ISODateTime | null;
  blockReason: string | null;
  deleteRequestedAt: ISODateTime | null;
  deletedAt: ISODateTime | null;
  lastLogin: { at: ISODateTime; method: PlatformLoginMethod | string } | null;
  lastActiveAt: ISODateTime | null;
  team: { role: string; disabled: boolean } | null;
  roles: { businessId: Id; businessName: string; businessSlug: string; kind: string; role: PlatformUserRole; fired: boolean }[];
  networks: { id: Id; name: string }[];
  telegram: { connected: boolean; since: ISODateTime | null; stopped: boolean };
  google: { linked: boolean; email: string | null; since: ISODateTime | null; lastUsedAt: ISODateTime | null };
  bookings: { total: number; recent: { id: Id; businessId: Id; businessName: string; start: ISODateTime; status: BookingStatus | string }[] };
  logins: { at: ISODateTime; method: PlatformLoginMethod | string; app: string; result: string; ip: string | null }[];
  activeSessions: number;
}
