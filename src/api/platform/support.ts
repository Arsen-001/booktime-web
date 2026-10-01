'use client';

/** Поддержка (F-00-182): одна очередь обращений из всех каналов. */
import { isApiMode } from '@/api/http';
import { ApiError, request } from '@/api/request';
import { mutateArea, readArea, readCore } from '@/api/area';
import type { Id } from '@/domain/core';
import { sortSupportQueue, type SupportChannel, type SupportStatus, type SupportTicket, type SupportTicketInput, type SupportTicketView } from '@/domain/platform';
import { nowDateTime } from '@/lib/date';
import { newId } from '@/lib/id';
import { normalizePhone } from '@/lib/phone';
import { AREA, PANEL, businessNameOf } from '@/api/platform/shared';
import * as S from '@/api/platform/support.server';

function toView(t: SupportTicket, core: ReturnType<typeof readCore>): SupportTicketView {
  return { ...t, businessName: businessNameOf(core, t.businessId), lastMessage: t.messages[t.messages.length - 1]?.text ?? '' };
}

/** Очередь: ждут нас → ждём ответа → закрыто. status 'active' — открытые и ждущие ответа */
export function listSupportTickets(filter?: { status?: SupportStatus | 'active'; channel?: SupportChannel }): Promise<SupportTicketView[]> {
  if (isApiMode()) return S.listSupportTickets(filter);
  return request(() => {
    const core = readCore();
    const rows = readArea(AREA).supportTickets.filter((t) => {
      if (filter?.status === 'active' && t.status === 'closed') return false;
      if (filter?.status && filter.status !== 'active' && t.status !== filter.status) return false;
      return !filter?.channel || t.channel === filter.channel;
    });
    return sortSupportQueue(rows).map((t) => toView(t, core));
  }, PANEL);
}

export function createSupportTicket(input: SupportTicketInput): Promise<SupportTicket> {
  if (isApiMode()) return S.createSupportTicket(input);
  return request(() => {
    if (!input.name.trim() || !input.text.trim()) throw new ApiError('validation');
    const now = nowDateTime();
    const area = readArea(AREA);
    const ticket: SupportTicket = {
      id: newId('ticket'),
      number: area.supportTickets.reduce((max, t) => Math.max(max, t.number), 999) + 1,
      from: input.from,
      businessId: input.businessId,
      appUserId: input.appUserId,
      name: input.name.trim(),
      phone: input.phone ? (normalizePhone(input.phone) ?? input.phone) : undefined,
      channel: input.channel,
      section: input.section,
      topic: input.topic,
      status: 'open',
      messages: [{ id: newId('msg'), author: 'them', text: input.text.trim(), at: now }],
      createdAt: now,
      updatedAt: now,
    };
    mutateArea(AREA, (s) => {
      s.supportTickets.unshift(ticket);
    });
    return ticket;
  });
}

function updateTicket(id: Id, apply: (t: SupportTicket) => void): Promise<SupportTicket> {
  return request(() => {
    let result: SupportTicket | undefined;
    mutateArea(AREA, (s) => {
      const ticket = s.supportTickets.find((t) => t.id === id);
      if (!ticket) throw new ApiError('not_found');
      apply(ticket);
      result = ticket;
    });
    if (!result) throw new ApiError('not_found');
    return result;
  }, PANEL);
}

export function replySupportTicket(id: Id, text: string): Promise<SupportTicket> {
  if (isApiMode()) return S.replySupportTicket(id, text);
  const now = nowDateTime();
  return updateTicket(id, (t) => {
    if (!text.trim()) throw new ApiError('validation');
    t.messages.push({ id: newId('msg'), author: 'us', text: text.trim(), at: now });
    t.status = 'waiting';
    t.updatedAt = now;
  });
}

export function closeSupportTicket(id: Id): Promise<SupportTicket> {
  if (isApiMode()) return S.closeSupportTicket(id);
  const now = nowDateTime();
  return updateTicket(id, (t) => {
    t.status = 'closed';
    t.updatedAt = now;
  });
}

export function reopenSupportTicket(id: Id): Promise<SupportTicket> {
  if (isApiMode()) return S.reopenSupportTicket(id);
  return updateTicket(id, (t) => {
    t.status = 'open';
  });
}
