'use client';

/**
 * Раздел «platform»: поддержка на настоящем сервере (booktime-backend, PLAN.md §7, этап 19; docs/backend/02 §19).
 * createSupportTicket не идёт через один общий маршрут панели — «обращение к нам» заводит СВОЙ раздел
 * (клиент: `POST /v1/me/support`, уже этап 9; бизнес: `POST /v1/biz/{b}/help-requests`, уже этап 18); эта
 * обёртка сама выбирает нужный по `input.from`, чтобы сигнатура createSupportTicket не менялась для вызывающих.
 */
import { http } from '@/api/http';
import { trackRead } from '@/api/request';
import { notifyDbChange } from '@/mock/db';
import type { Id } from '@/domain/core';
import type { SupportChannel, SupportStatus, SupportTicket, SupportTicketInput, SupportTicketView } from '@/domain/platform';

function read<T>(fn: () => Promise<T>): Promise<T> {
  trackRead('areas.platform');
  return fn();
}
async function write<T>(fn: () => Promise<T>): Promise<T> {
  const res = await fn();
  notifyDbChange('areas.platform');
  return res;
}

export const listSupportTickets = (filter?: { status?: SupportStatus | 'active'; channel?: SupportChannel }) =>
  read(() => http<SupportTicketView[]>('GET', '/v1/platform/support', undefined, { query: { status: filter?.status, channel: filter?.channel } }));

export async function createSupportTicket(input: SupportTicketInput): Promise<SupportTicket> {
  if (input.from === 'client') {
    await http<void>('POST', '/v1/me/support', { subject: input.topic, message: input.text, phone: input.phone });
  } else {
    await http<void>('POST', `/v1/biz/${input.businessId}/help-requests`, { topic: input.topic, message: input.text });
  }
  notifyDbChange('areas.platform');
  // Ни один из двух маршрутов не отдаёт SupportTicket мока целиком (F-00-182: карточка нужна только панели) —
  // вызывающая сторона (экран заявителя) читает свой собственный список после отправки, не эту заявку саму.
  return { id: '', number: 0, from: input.from, businessId: input.businessId, appUserId: input.appUserId, name: input.name, phone: input.phone, channel: input.channel, section: input.section, topic: input.topic, status: 'open', messages: [], createdAt: '', updatedAt: '' };
}

export const replySupportTicket = (id: Id, text: string) => write(() => http<SupportTicket>('POST', `/v1/platform/support/${id}/reply`, { text }));

export const closeSupportTicket = (id: Id) => write(() => http<SupportTicket>('POST', `/v1/platform/support/${id}/close`));

export const reopenSupportTicket = (id: Id) => write(() => http<SupportTicket>('POST', `/v1/platform/support/${id}/reopen`));
