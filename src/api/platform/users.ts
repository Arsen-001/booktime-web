'use client';

/**
 * Наша панель → «Пользователи» (03.10.2026): все зарегистрированные люди. Сервер — users.server.ts; в демо люди
 * собираются из ядра: пользователи приложения + сотрудники (один номер = один человек), входы, Telegram и Google —
 * выдуманы детерминированно по id. Блокировки демо живут до перезагрузки страницы (свой срез не заводим).
 * Поиск, фильтры, сортировка и страница — здесь, а не в экране (CONVENTIONS §16.10).
 */
import { isApiMode } from '@/api/http';
import { ApiError, request, trackRead } from '@/api/request';
import { readCore } from '@/api/area';
import { PANEL } from '@/api/platform/shared';
import * as S from '@/api/platform/users.server';
import type { CoreData, Id, ISODateTime } from '@/domain/core';
import type {
  PlatformCodeChannel,
  PlatformFirstLoginVia,
  PlatformLoginMethod,
  PlatformUserCard,
  PlatformUserRole,
  PlatformUserRow,
  PlatformUsersPage,
  PlatformUsersQuery,
  PlatformUserStatus,
} from '@/domain/platform/types/users';
import { addDays, addMinutes, datePart, nowDateTime } from '@/lib/date';
import { maskPhone } from '@/lib/phone';
import { normalizeSearch } from '@/lib/text';

const TAG = 'areas.platform.users' as const;

/** Демо: кого заблокировали в панели и когда завершали сессии (до перезагрузки) */
const blocks = new Map<Id, { blocked: boolean; at: ISODateTime; reason: string | null }>();
const revokedAt = new Map<Id, ISODateTime>();

interface DemoPerson {
  id: Id;
  name: string;
  phone: string | null;
  locale: string;
  createdAt: ISODateTime;
  staff: CoreData['staff'];
}

/** Стабильное число из id — «случайные» входы и подключения одинаковы при каждом открытии */
function hashOf(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h >>> 0;
}

function people(core: CoreData): DemoPerson[] {
  const byPhone = new Map<string, DemoPerson>();
  const out: DemoPerson[] = [];
  for (const u of core.appUsers) {
    const p: DemoPerson = { id: u.id, name: u.name, phone: u.phone, locale: u.locale, createdAt: u.createdAt, staff: [] };
    byPhone.set(u.phone, p);
    out.push(p);
  }
  for (const s of core.staff) {
    const known = s.phone ? byPhone.get(s.phone) : undefined;
    if (known) {
      known.staff.push(s);
      continue;
    }
    const p: DemoPerson = { id: `pu_${s.id}`, name: s.name, phone: s.phone || null, locale: 'ru', createdAt: `${s.hiredAt}T10:00`, staff: [s] };
    if (s.phone) byPhone.set(s.phone, p);
    out.push(p);
  }
  return out;
}

const rolesOf = (p: DemoPerson): PlatformUserRole[] => {
  const live = new Set(p.staff.filter((s) => s.status !== 'fired').map((s) => s.role));
  return (['owner', 'admin', 'master'] as const).filter((r) => live.has(r));
};

function statusOf(p: DemoPerson): PlatformUserStatus {
  const b = blocks.get(p.id);
  if (b) return b.blocked ? 'blocked' : 'active';
  const h = hashOf(p.id);
  // Пара людей в демо — с заявкой на удаление и заблокированный, чтобы было что фильтровать
  if (!p.staff.length && h % 29 === 3) return 'blocked';
  if (!p.staff.length && h % 31 === 7) return 'delete_requested';
  return 'active';
}

/** Выдуманные входы: 2–8 событий за последние 40 дней, иногда неверный код */
function loginsOf(p: DemoPerson, now: ISODateTime): PlatformUserCard['logins'] {
  const h = hashOf(p.id);
  // Каждый девятый ещё не входил (номер есть в базе салона, приложение не открывал)
  if (h % 9 === 4) return [];
  const n = 2 + (h % 7);
  const google = h % 4 === 0;
  const out: PlatformUserCard['logins'] = [];
  // Последний вход — от «только что» до полутора месяцев назад
  let at = addMinutes(now, -((h % 600) + 30) - ((h >>> 3) % 45) * 24 * 60);
  // Не раньше регистрации: зарегистрировался вчера — и входы со вчера
  if (at < p.createdAt) at = addMinutes(p.createdAt, 90) > now ? now : addMinutes(p.createdAt, 90);
  for (let i = 0; i < n; i++) {
    if (i > 0 && at < p.createdAt) break;
    const wrong = (h >>> i) % 5 === 0;
    const method: PlatformLoginMethod = p.staff.some((s) => s.role === 'admin') && i % 3 === 2 ? 'password' : google && i % 2 === 0 ? 'google' : 'code';
    out.push({ at, method, channel: method === 'code' ? codeChannelOf(p, i) : null, app: p.staff.length ? 'business' : 'client', result: wrong ? (method === 'password' ? 'wrong_password' : 'wrong_code') : 'ok', ip: `37.252.•.•` });
    at = addMinutes(at, -(((h >>> (i + 2)) % 5) + 1) * 24 * 60 - (i * 37) % 300);
  }
  return out;
}

/** Демо: у части людей коды приходят в WhatsApp (нет Telegram или выбрали сами), у редких — по SMS */
function whatsappOf(p: DemoPerson): boolean {
  return Boolean(p.phone) && hashOf(`wa${p.id}`) % 3 === 0;
}
function codeChannelOf(p: DemoPerson, i: number): PlatformCodeChannel {
  if (whatsappOf(p) && (!telegramOf(p) || i % 2 === 0)) return 'whatsapp';
  return hashOf(p.id) % 17 === 5 ? 'sms' : 'telegram';
}

function telegramOf(p: DemoPerson): boolean {
  return Boolean(p.phone) && hashOf(p.id) % 5 < 2;
}
function googleOf(p: DemoPerson): boolean {
  return hashOf(p.id) % 4 === 0;
}

function rowOf(p: DemoPerson, core: CoreData, now: ISODateTime): PlatformUserRow {
  const logins = loginsOf(p, now);
  const lastOk = logins.find((l) => l.result === 'ok');
  return {
    id: p.id,
    name: p.name,
    phoneMasked: p.phone ? maskPhone(p.phone) : null,
    locale: p.locale,
    createdAt: p.createdAt,
    lastLoginAt: lastOk?.at ?? null,
    lastActiveAt: logins[0]?.at ?? null,
    roles: rolesOf(p),
    telegram: telegramOf(p),
    // Как на сервере: WhatsApp есть, если код туда приходил и был введён
    whatsapp: logins.some((l) => l.channel === 'whatsapp' && l.result === 'ok'),
    google: googleOf(p),
    status: statusOf(p),
    bookingsCount: core.bookings.filter((b) => b.appUserId === p.id).length,
    team: false,
  };
}

function matches(r: PlatformUserRow, p: DemoPerson, q: PlatformUsersQuery, now: ISODateTime): boolean {
  const text = q.q?.trim();
  if (text) {
    const digits = text.replace(/\D/g, '').replace(/^0(\d{8})$/, '$1');
    const byName = normalizeSearch(r.name).includes(normalizeSearch(text));
    const byPhone = digits.length >= 3 && Boolean(p.phone?.includes(digits));
    if (!byName && !byPhone) return false;
  }
  if (q.role === 'client' && r.roles.length) return false;
  if (q.role === 'multiple' && r.roles.length < 2) return false;
  if ((q.role === 'owner' || q.role === 'admin' || q.role === 'master') && !r.roles.includes(q.role)) return false;
  if (q.regFrom && datePart(r.createdAt) < q.regFrom) return false;
  if (q.regTo && datePart(r.createdAt) > q.regTo) return false;
  if (q.activeDays && (!r.lastActiveAt || datePart(r.lastActiveAt) < addDays(datePart(now), -q.activeDays))) return false;
  if (q.telegram && r.telegram !== (q.telegram === 'yes')) return false;
  if (q.whatsapp && r.whatsapp !== (q.whatsapp === 'yes')) return false;
  if (q.google && r.google !== (q.google === 'yes')) return false;
  if (q.status && r.status !== q.status) return false;
  return true;
}

export function listPlatformUsers(query: PlatformUsersQuery): Promise<PlatformUsersPage> {
  if (isApiMode()) return S.listPlatformUsers(query);
  return request(() => {
    trackRead(TAG);
    const core = readCore();
    const now = nowDateTime();
    const all = people(core).map((p) => ({ p, r: rowOf(p, core, now) }));
    const found = all.filter(({ p, r }) => matches(r, p, query, now)).map(({ r }) => r);
    const sign = query.dir === 'asc' ? 1 : -1;
    const value = (r: PlatformUserRow): string | number | null =>
      query.sort === 'bookings' ? r.bookingsCount : query.sort === 'last_login' ? r.lastLoginAt : r.createdAt;
    found.sort((a, b) => {
      const va = value(a);
      const vb = value(b);
      if (va === null || vb === null) return va === vb ? a.id.localeCompare(b.id) : va === null ? 1 : -1;
      const d = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb));
      return d * sign || a.id.localeCompare(b.id);
    });
    const weekAgo = addDays(datePart(now), -7);
    const live = all.filter(({ r }) => r.status !== 'deleted');
    return {
      rows: found.slice((query.page - 1) * query.pageSize, query.page * query.pageSize),
      total: found.length,
      page: query.page,
      pageSize: query.pageSize,
      counters: {
        total: live.length,
        new7d: live.filter(({ r }) => datePart(r.createdAt) >= weekAgo).length,
        active7d: live.filter(({ r }) => r.lastActiveAt && datePart(r.lastActiveAt) >= weekAgo).length,
        telegram: live.filter(({ r }) => r.telegram).length,
        whatsapp: live.filter(({ r }) => r.whatsapp).length,
      },
    };
  }, PANEL);
}

export function getPlatformUser(id: Id): Promise<PlatformUserCard> {
  if (isApiMode()) return S.getPlatformUser(id);
  return request(() => {
    trackRead(TAG);
    const core = readCore();
    const now = nowDateTime();
    const p = people(core).find((x) => x.id === id);
    if (!p) throw new ApiError('not_found');
    const row = rowOf(p, core, now);
    const logins = loginsOf(p, now);
    const bookings = core.bookings.filter((b) => b.appUserId === p.id).sort((a, b) => b.start.localeCompare(a.start));
    const bizName = (bid: Id) => core.businesses.find((b) => b.id === bid)?.name ?? '';
    const block = blocks.get(p.id);
    const revoked = revokedAt.get(p.id);
    const sessionsAlive = row.status === 'blocked' ? 0 : logins.filter((l) => l.result === 'ok' && (!revoked || l.at > revoked)).slice(0, 3).length;
    const h = hashOf(p.id);
    // Подключения — после регистрации, но не позже «сейчас»
    const notLater = (dt: ISODateTime) => (dt > now ? now : dt);
    const tgSince = row.telegram ? notLater(addMinutes(p.createdAt, 60 * 24 * ((h % 9) + 1))) : null;
    const lastOk = logins.find((l) => l.result === 'ok');
    const waCodes = logins.filter((l) => l.channel === 'whatsapp' && l.result === 'ok');
    const first = logins.filter((l) => l.result === 'ok').at(-1);
    const firstLoginVia: PlatformFirstLoginVia | null = first ? ((first.channel as PlatformCodeChannel | null) ?? (first.method === 'google' ? 'google' : null)) : null;
    return {
      id: p.id,
      name: p.name,
      phone: p.phone,
      locale: p.locale,
      createdAt: p.createdAt,
      status: row.status,
      blockedAt: row.status === 'blocked' ? (block?.at ?? addMinutes(now, -60 * 24 * 3)) : null,
      blockReason: row.status === 'blocked' ? (block?.reason ?? null) : null,
      deleteRequestedAt: row.status === 'delete_requested' ? addMinutes(now, -60 * 24 * 5) : null,
      deletedAt: null,
      lastLogin: lastOk ? { at: lastOk.at, method: lastOk.method } : null,
      lastActiveAt: row.lastActiveAt,
      team: null,
      roles: p.staff.map((s) => {
        const b = core.businesses.find((x) => x.id === s.businessId);
        return { businessId: s.businessId, businessName: b?.name ?? '', businessSlug: b?.slug ?? '', kind: b?.kind ?? 'salon', role: s.role, fired: s.status === 'fired' };
      }),
      networks: core.networks.filter((n) => p.staff.some((s) => s.id === n.ownerStaffId)).map((n) => ({ id: n.id, name: n.name })),
      telegram: { connected: row.telegram, since: tgSince, stopped: false },
      whatsapp: { used: waCodes.length > 0, since: waCodes.at(-1)?.at ?? null, lastAt: waCodes[0]?.at ?? null },
      firstLoginVia,
      google: row.google
        ? { linked: true, email: `${(p.name.split(' ')[0] ?? 'user').toLowerCase().replace(/[^a-z]/g, '') || 'user'}${h % 100}@gmail.com`, since: notLater(addMinutes(p.createdAt, 60 * 24 * 2)), lastUsedAt: lastOk?.at ?? null }
        : { linked: false, email: null, since: null, lastUsedAt: null },
      bookings: {
        total: bookings.length,
        recent: bookings.slice(0, 10).map((b) => ({ id: b.id, businessId: b.businessId, businessName: bizName(b.businessId), start: b.start, status: b.status })),
      },
      logins,
      activeSessions: sessionsAlive,
    };
  }, PANEL);
}

/** Заблокировать (причина обязательна, сессии завершаются) / разблокировать. Сервер пускает только admin команды. */
export function setPlatformUserBlocked(id: Id, blocked: boolean, reason?: string): Promise<{ status: PlatformUserStatus; revokedSessions: number }> {
  if (isApiMode()) return S.setPlatformUserBlocked(id, blocked, reason);
  return request(() => {
    if (blocked && (reason?.trim().length ?? 0) < 3) throw new ApiError('validation');
    const core = readCore();
    if (!people(core).some((p) => p.id === id)) throw new ApiError('not_found');
    const at = nowDateTime();
    blocks.set(id, { blocked, at, reason: blocked ? (reason?.trim() ?? null) : null });
    if (blocked) revokedAt.set(id, at);
    S.notifyUsersChanged();
    return { status: blocked ? 'blocked' : 'active', revokedSessions: blocked ? 2 : 0 };
  }, PANEL);
}

export function revokePlatformUserSessions(id: Id): Promise<{ revoked: number }> {
  if (isApiMode()) return S.revokePlatformUserSessions(id);
  return request(() => {
    const core = readCore();
    if (!people(core).some((p) => p.id === id)) throw new ApiError('not_found');
    revokedAt.set(id, nowDateTime());
    S.notifyUsersChanged();
    return { revoked: 1 };
  }, PANEL);
}
