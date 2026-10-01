'use client';

/** Проверка материалов (F-00-168…171, F-00-179): очередь, решения, причины отказа, видимость клиентам. */
import { isApiMode } from '@/api/http';
import { ApiError, request } from '@/api/request';
import { mutateArea, readArea, readCore } from '@/api/area';
import type { Id } from '@/domain/core';
import {
  moderationStatusFor,
  type ModerationCounts,
  type ModerationItem,
  type ModerationKind,
  type ModerationStatus,
  type ModerationSubmitInput,
  type ModerationView,
  type RejectReason,
} from '@/domain/platform';
import { nowDateTime } from '@/lib/date';
import { newId } from '@/lib/id';
import { AREA, PANEL, businessNameOf } from '@/api/platform/shared';
import * as S from '@/api/platform/moderation.server';

export function listModerationItems(filter?: { status?: ModerationStatus; kind?: ModerationKind }): Promise<ModerationView[]> {
  if (isApiMode()) return S.listModerationItems(filter);
  return request(() => {
    const core = readCore();
    const area = readArea(AREA);
    return area.moderationItems
      .filter((m) => (!filter?.status || m.status === filter.status) && (!filter?.kind || m.kind === filter.kind))
      .sort((a, b) => (filter?.status === 'pending' ? a.submittedAt.localeCompare(b.submittedAt) : b.submittedAt.localeCompare(a.submittedAt)))
      .map((m) => ({
        ...m,
        businessName: businessNameOf(core, m.businessId) ?? '',
        reasonLabel: m.reasonId ? area.rejectReasons.find((r) => r.id === m.reasonId)?.label : undefined,
      }));
  }, PANEL);
}

/** Сколько материалов в каждой вкладке — для счётчиков на вкладках */
export function getModerationCounts(): Promise<ModerationCounts> {
  if (isApiMode()) return S.getModerationCounts();
  return request(() => {
    const counts: ModerationCounts = { pending: 0, approved: 0, rejected: 0, auto: 0 };
    readArea(AREA).moderationItems.forEach((m) => {
      counts[m.status] += 1;
    });
    return counts;
  }, PANEL);
}

export function listRejectReasons(): Promise<RejectReason[]> {
  if (isApiMode()) return S.listRejectReasons();
  return request(() => readArea(AREA).rejectReasons.filter((r) => r.active).sort((a, b) => a.order - b.order), PANEL);
}

export function saveRejectReason(reason: Omit<RejectReason, 'id'> & { id?: Id }): Promise<void> {
  if (isApiMode()) return S.saveRejectReason(reason);
  return request(() => {
    mutateArea(AREA, (s) => {
      if (reason.id) {
        const idx = s.rejectReasons.findIndex((r) => r.id === reason.id);
        if (idx < 0) throw new ApiError('not_found');
        s.rejectReasons[idx] = { ...s.rejectReasons[idx], ...reason, id: reason.id };
      } else {
        s.rejectReasons.push({ ...reason, id: newId('rr') });
      }
    });
  }, PANEL);
}

/** Скрыть причину из справочника (старые отказы сохраняют подпись) */
export function hideRejectReason(id: Id): Promise<void> {
  if (isApiMode()) return S.hideRejectReason(id);
  return request(() => {
    mutateArea(AREA, (s) => {
      const reason = s.rejectReasons.find((r) => r.id === id);
      if (!reason) throw new ApiError('not_found');
      reason.active = false;
    });
  }, PANEL);
}

/**
 * Любой новый материал попадает в очередь (F-00-168). Шаблон и снятое нами на визите — без очереди (F-00-169);
 * повтор (reuse) — без очереди, только если исходник сам одобрен.
 * refId — id того, что скрывается до одобрения: строка фото (как в Staff.photos / Service.photos / Business.photos)
 * или id сущности (мастер, услуга, бизнес).
 */
export function submitForModeration(input: ModerationSubmitInput): Promise<ModerationItem> {
  if (isApiMode()) return S.submitForModeration(input);
  return request(() => {
    const now = nowDateTime();
    const area = readArea(AREA);
    const source = input.source ?? 'user';
    const reuseSource = input.targetItemId ? area.moderationItems.find((m) => m.id === input.targetItemId) : undefined;
    const status = moderationStatusFor(source, reuseSource?.status === 'approved' || reuseSource?.status === 'auto');
    const auto = status === 'auto';
    const item: ModerationItem = {
      ...input,
      id: newId('mod'),
      status,
      source,
      submittedAt: now,
      decidedAt: auto ? now : undefined,
      history: [{ id: newId('mev'), at: now, kind: 'submitted' }, ...(auto ? [{ id: newId('mev'), at: now, kind: 'auto' as const }] : [])],
    };
    mutateArea(AREA, (s) => {
      s.moderationItems.unshift(item);
    });
    return item;
  });
}

export function approveModerationItem(id: Id): Promise<ModerationItem> {
  if (isApiMode()) return S.approveModerationItem(id);
  return request(() => {
    const now = nowDateTime();
    let result: ModerationItem | undefined;
    mutateArea(AREA, (s) => {
      const item = s.moderationItems.find((m) => m.id === id);
      if (!item) throw new ApiError('not_found');
      if (item.status !== 'pending') throw new ApiError('conflict');
      item.status = 'approved';
      item.decidedAt = now;
      item.history.push({ id: newId('mev'), at: now, kind: 'approved' });
      result = item;
    });
    if (!result) throw new ApiError('not_found');
    return result;
  }, PANEL);
}

/** Отклонить с причиной; платное — монеты возвращаются (F-00-170) */
export function rejectModerationItem(id: Id, reasonId: Id, reasonNote?: string): Promise<ModerationItem> {
  if (isApiMode()) return S.rejectModerationItem(id, reasonId, reasonNote);
  return request(() => {
    const now = nowDateTime();
    let result: ModerationItem | undefined;
    mutateArea(AREA, (s) => {
      const item = s.moderationItems.find((m) => m.id === id);
      if (!item) throw new ApiError('not_found');
      if (item.status !== 'pending') throw new ApiError('conflict');
      if (!s.rejectReasons.some((r) => r.id === reasonId)) throw new ApiError('validation');
      item.status = 'rejected';
      item.reasonId = reasonId;
      item.reasonNote = reasonNote;
      item.decidedAt = now;
      item.history.push({ id: newId('mev'), at: now, kind: 'rejected', note: reasonNote });
      if (item.paidCoins) {
        item.history.push({ id: newId('mev'), at: now, kind: 'refund', coins: item.paidCoins });
        s.coinEntries.push({ id: newId('coin'), businessId: item.businessId, kind: 'refund', amount: item.paidCoins, reason: 'moderationReject', refId: item.id, at: now });
      }
      result = item;
    });
    if (!result) throw new ApiError('not_found');
    return result;
  }, PANEL);
}

/**
 * «Отменить» в тосте после решения: материал снова на проверке. Если при отказе монеты вернули — списываем их обратно,
 * чтобы баланс бизнеса сошёлся.
 */
export function reopenModerationItem(id: Id): Promise<ModerationItem> {
  if (isApiMode()) return S.reopenModerationItem(id);
  return request(() => {
    const now = nowDateTime();
    let result: ModerationItem | undefined;
    mutateArea(AREA, (s) => {
      const item = s.moderationItems.find((m) => m.id === id);
      if (!item) throw new ApiError('not_found');
      if (item.status === 'rejected' && item.paidCoins) {
        s.coinEntries.push({ id: newId('coin'), businessId: item.businessId, kind: 'charge', amount: -item.paidCoins, reason: 'manual', refId: item.id, at: now });
      }
      item.status = 'pending';
      item.reasonId = undefined;
      item.reasonNote = undefined;
      item.decidedAt = undefined;
      item.history.push({ id: newId('mev'), at: now, kind: 'reopened' });
      result = item;
    });
    if (!result) throw new ApiError('not_found');
    return result;
  }, PANEL);
}

/**
 * Решение по нескольким материалам сразу (выбор галочками в очереди): одна операция = один request().
 * Уже решённые (кто-то успел раньше) пропускаются, а не роняют всю пачку; ответ — что реально решено.
 * Этап 21, лейн rest: на сервере теперь настоящий пакетный эндпоинт (`/v1/platform/moderation/bulk/*`,
 * одна транзакция) — раньше здесь стояли N параллельных одиночных вызовов.
 */
export function approveModerationItems(ids: Id[]): Promise<Id[]> {
  if (isApiMode()) return S.approveModerationItems(ids);
  return request(() => {
    const now = nowDateTime();
    const done: Id[] = [];
    mutateArea(AREA, (s) => {
      for (const id of ids) {
        const item = s.moderationItems.find((m) => m.id === id);
        if (!item || item.status !== 'pending') continue;
        item.status = 'approved';
        item.decidedAt = now;
        item.history.push({ id: newId('mev'), at: now, kind: 'approved' });
        done.push(id);
      }
    });
    return done;
  }, PANEL);
}

export function rejectModerationItems(ids: Id[], reasonId: Id, reasonNote?: string): Promise<Id[]> {
  if (isApiMode()) return S.rejectModerationItems(ids, reasonId, reasonNote);
  return request(() => {
    const now = nowDateTime();
    const done: Id[] = [];
    mutateArea(AREA, (s) => {
      if (!s.rejectReasons.some((r) => r.id === reasonId)) throw new ApiError('validation');
      for (const id of ids) {
        const item = s.moderationItems.find((m) => m.id === id);
        if (!item || item.status !== 'pending') continue;
        item.status = 'rejected';
        item.reasonId = reasonId;
        item.reasonNote = reasonNote;
        item.decidedAt = now;
        item.history.push({ id: newId('mev'), at: now, kind: 'rejected', note: reasonNote });
        if (item.paidCoins) {
          item.history.push({ id: newId('mev'), at: now, kind: 'refund', coins: item.paidCoins });
          s.coinEntries.push({ id: newId('coin'), businessId: item.businessId, kind: 'refund', amount: item.paidCoins, reason: 'moderationReject', refId: item.id, at: now });
        }
        done.push(id);
      }
    });
    return done;
  }, PANEL);
}

/** «Отменить» в тосте после решения пачкой — все снова на проверке (монеты за отклонённые списываются обратно) */
export function reopenModerationItems(ids: Id[]): Promise<void> {
  if (isApiMode()) return S.reopenModerationItems(ids);
  return request(() => {
    const now = nowDateTime();
    mutateArea(AREA, (s) => {
      for (const id of ids) {
        const item = s.moderationItems.find((m) => m.id === id);
        if (!item || item.status === 'pending') continue;
        if (item.status === 'rejected' && item.paidCoins) {
          s.coinEntries.push({ id: newId('coin'), businessId: item.businessId, kind: 'charge', amount: -item.paidCoins, reason: 'manual', refId: item.id, at: now });
        }
        item.status = 'pending';
        item.reasonId = undefined;
        item.reasonNote = undefined;
        item.decidedAt = undefined;
        item.history.push({ id: newId('mev'), at: now, kind: 'reopened' });
      }
    });
  }, PANEL);
}

export function getModerationStatus(refId: Id): Promise<ModerationItem | undefined> {
  if (isApiMode()) return S.getModerationStatus(refId);
  return request(() => readArea(AREA).moderationItems.find((m) => m.refId === refId));
}

/**
 * Видно ли клиенту (F-00-168). Нет записи в очереди — материал старый (до проверки) и виден; есть — виден только
 * одобренный или прошедший без очереди. То же правило ядро применяет в каталоге (moderationHiddenIds).
 */
export function isVisibleToClients(refId: Id): Promise<boolean> {
  if (isApiMode()) return S.isVisibleToClients(refId);
  return request(() => {
    const item = readArea(AREA).moderationItems.find((m) => m.refId === refId);
    return !item || item.status === 'approved' || item.status === 'auto';
  });
}
