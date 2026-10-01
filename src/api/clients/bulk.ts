'use client';

/** Массовые действия: рассылки, категория, удаление, объединение дублей. */
import type { BroadcastChannel, BroadcastMessage } from '@/domain/clients';
import { emptyProfile } from '@/domain/clients';
import type { Id, ISODate } from '@/domain/core';
import * as C from '@/api/clients/clients.server';
import { isApiMode } from '@/api/http';
import { readArea, readCore, mutateArea } from '@/api/area';
import { assertCan, coreTx, currentActor } from '@/api/core';
import { ApiError, request } from '@/api/request';
import { countRecentAppPushes, getSmsSettings, WEEKLY_PUSH_LIMIT } from '@/api/notify';
import { newId } from '@/lib/id';
import { nowDateTime, today } from '@/lib/date';
import { logChange, deleteClientTx } from '@/api/clients/shared';

// ─────────────────────────── Массовые действия (F-04-037…042) ───────────────────────────

function logBroadcast(businessId: Id, channel: BroadcastChannel, text: string, audienceCount: number) {
  mutateArea('clients', (s) => {
    const entry: BroadcastMessage = {
      id: newId('msg'),
      businessId,
      channel,
      text,
      audienceCount,
      sentAt: nowDateTime(),
    };
    s.messageLog = [entry, ...s.messageLog];
  });
}

/**
 * F-04-038: SMS группе клиентов; клиентам, отказавшимся от рекламных рассылок, не уходит (F-04-089).
 * Отправленное записывается в messageLog — «видно в отчёте сообщений» (см. CrmSummaryScreen).
 */
/**
 * Кому реально уйдёт рассылка из выбранных (F-04-227, ux-best-c2 №6): без явного отказа от рекламы — SMS; из них с нашим
 * приложением — пуш. Окно рассылки показывает эти числа до отправки.
 */
export function bulkAudience(clientIds: Id[]): Promise<{ sms: Id[]; push: Id[] }> {
  if (isApiMode()) return C.bulkAudience(C.bizOf(), clientIds);
  return request(() => audienceOf(clientIds));
}

function audienceOf(clientIds: Id[]): { sms: Id[]; push: Id[] } {
  const core = readCore();
  const state = readArea('clients');
  const wanted = new Set(clientIds);
  const clients = core.clients.filter((c) => wanted.has(c.id) && !c.deletedAt && state.profiles[c.id]?.adConsent?.given !== false);
  return { sms: clients.map((c) => c.id), push: clients.filter((c) => c.appUserId).map((c) => c.id) };
}

/**
 * F-04-038, «Снято» №11, В-08 б: SMS без подключённого у бизнеса SMS-провайдера не уходит — тот же экран
 * должен предупредить и предложить подключить канал (src/app/biz/notifications/**), а не отправлять молча.
 */
export function bulkSendMessage(businessId: Id, clientIds: Id[], text: string): Promise<number> {
  if (isApiMode()) return C.bulkSendMessage(businessId, clientIds, text);
  return request(async () => {
    assertCan('notify.mailings');
    const smsSettings = await getSmsSettings(businessId);
    if (!smsSettings.connected) throw new ApiError('sms_not_connected');
    const targets = audienceOf(clientIds).sms;
    const day = today();
    mutateArea('clients', (s) => {
      targets.forEach((id) => {
        s.broadcastHistory[id] = [...(s.broadcastHistory[id] ?? []), day];
      });
    });
    logBroadcast(businessId, 'sms', text, targets.length);
    return targets.length;
  });
}

/**
 * F-04-039/040, «Снято» №3: пуш уходит только клиентам, у кого есть приложение и кто не отказался от рекламных
 * рассылок в CRM (audienceOf); слать сверх общего недельного лимита пушей бизнеса (notify.WEEKLY_PUSH_LIMIT,
 * тот же счётчик, что у раздела «Уведомления» — F-00-114) нельзя ни отсюда, ни оттуда.
 * ❓ нет доступного из CRM признака «подписан ❤ / приглушил новости» на конкретного клиента (это состояние
 * приложения — favorites раздела client) — заявка в qa/requests/clients.md; пока фильтр CRM = «есть приложение
 * и не отказался от рекламы» (adConsent), а не полноценная ❤-подписка.
 */
export function bulkSendPush(businessId: Id, clientIds: Id[], text: string): Promise<number> {
  if (isApiMode()) return C.bulkSendPush(businessId, clientIds, text);
  return request(async () => {
    assertCan('notify.mailings');
    const alreadySent = await countRecentAppPushes(businessId);
    if (alreadySent >= WEEKLY_PUSH_LIMIT) {
      throw new ApiError('weekly_push_limit');
    }
    const targets = audienceOf(clientIds).push;
    const day = today();
    mutateArea('clients', (s) => {
      targets.forEach((id) => {
        s.broadcastHistory[id] = [...(s.broadcastHistory[id] ?? []), day];
      });
    });
    logBroadcast(businessId, 'push', text, targets.length);
    return targets.length;
  });
}

export function listMessageLog(businessId: Id, range: { from: ISODate; to: ISODate }): Promise<BroadcastMessage[]> {
  if (isApiMode()) return C.listMessageLog(businessId, range);
  return request(() =>
    readArea('clients')
      .messageLog.filter((m) => m.businessId === businessId && m.sentAt.slice(0, 10) >= range.from && m.sentAt.slice(0, 10) <= range.to)
      .sort((a, b) => b.sentAt.localeCompare(a.sentAt)),
  );
}

/** F-04-100 «Готово, когда»: сообщение из окна записи видно в истории сообщений клиента */
export function listClientMessages(clientId: Id): Promise<BroadcastMessage[]> {
  if (isApiMode()) return C.listClientMessages(C.bizOf(), clientId);
  return request(() =>
    readArea('clients')
      .messageLog.filter((m) => m.clientId === clientId)
      .sort((a, b) => b.sentAt.localeCompare(a.sentAt)),
  );
}

/**
 * F-04-100: разовое сообщение клиенту из окна записи — по нашему решению (F-00-120/121) платных
 * SMS клиенту нет: пуш, если у клиента есть приложение, иначе WhatsApp самого мастера (deep-link,
 * ничего не отправляется от нас — только открывает WhatsApp с готовым текстом). Записывается в общую
 * историю сообщений с source: 'bookingWindow', чтобы отчёт «Сообщения» различал этот тип (см. ТЗ).
 */
export function sendBookingWindowMessage(input: { businessId: Id; clientId: Id; text: string; channel: 'push' | 'whatsapp' }): Promise<void> {
  if (isApiMode()) return C.sendBookingWindowMessage(input);
  return request(() => {
    const trimmed = input.text.trim();
    if (!trimmed) throw new ApiError('empty_text');
    if (input.channel === 'push') {
      const client = readCore().clients.find((c) => c.id === input.clientId);
      if (!client?.appUserId) throw new ApiError('no_app_user');
    }
    mutateArea('clients', (s) => {
      const entry: BroadcastMessage = {
        id: newId('msg'),
        businessId: input.businessId,
        channel: input.channel,
        text: trimmed,
        audienceCount: 1,
        sentAt: nowDateTime(),
        clientId: input.clientId,
        source: 'bookingWindow',
      };
      s.messageLog = [entry, ...s.messageLog];
    });
  });
}

export function bulkAddCategory(clientIds: Id[], category: string, color?: string): Promise<void> {
  if (isApiMode()) return C.bulkAddCategory(C.bizOf(), clientIds, category, color);
  return request(() => {
    assertCan('clients.edit');
    const trimmed = category.trim();
    if (!trimmed) throw new ApiError('empty_category', 'Укажите название категории');
    const core = readCore();
    for (const id of clientIds) {
      const c = core.clients.find((x) => x.id === id);
      if (c && !c.tags.includes(trimmed)) {
        coreTx.update('clients', id, { tags: [...c.tags, trimmed] });
      }
    }
    const businessId = clientIds.map((id) => core.clients.find((x) => x.id === id)?.businessId).find(Boolean) ?? currentActor().businessId;
    if (color && businessId) {
      mutateArea('clients', (s) => {
        (s.categoryColors[businessId] ??= {})[trimmed] = color;
      });
    }
  });
}

export function getCategoryColors(): Promise<Record<string, string>> {
  if (isApiMode()) return C.listCategories(C.bizOf()).then((rows) => Object.fromEntries(rows.map((r) => [r.name, r.color])));
  return request(() => readArea('clients').categoryColors[currentActor().businessId ?? ''] ?? {});
}

// ─────────────────────────── Дубли: объединение (F-04-135…137) ───────────────────────────

/**
 * F-04-135/136: переносит визиты (записи) клиента-дубля на основную карточку и удаляет дубль.
 * Карта лояльности/абонемент/счёт с дубля НЕ переносятся (F-04-136) — сохраняем предупреждение на экране.
 */
export function mergeClients(businessId: Id, keepId: Id, duplicateId: Id, actorId?: Id, actorName?: string): Promise<void> {
  if (isApiMode()) return C.mergeClients(businessId, keepId, duplicateId);
  // Тело — внутри request(): раньше readCore()/mutateArea шли до первого await запроса и вне отслеживаемого
  // контекста, что печатало предупреждение «[mock-db] обращение к базе вне request()» при каждом объединении.
  return request(async () => {
    assertCan('clients.edit');
    if (keepId === duplicateId) throw new ApiError('same_client', 'Выберите двух разных клиентов');
    const core = readCore();
    const keep = core.clients.find((c) => c.id === keepId && c.businessId === businessId && !c.deletedAt);
    const dup = core.clients.find((c) => c.id === duplicateId && c.businessId === businessId && !c.deletedAt);
    if (!keep || !dup) throw new ApiError('not_found', 'Клиент не найден');

    const dupBookings = core.bookings.filter((b) => b.clientId === duplicateId && !b.deletedAt);
    for (const b of dupBookings) {
      coreTx.update('bookings', b.id, { clientId: keepId });
    }
    mutateArea('clients', (s) => {
      const keepProfile = s.profiles[keepId] ?? emptyProfile();
      const dupProfile = s.profiles[duplicateId] ?? emptyProfile();
      // Выручка/суммы дубля переезжают вместе с визитами (F-04-135 «суммы в отчётах не изменились»
      // относится к отчётам по бизнесу в целом — на уровне клиента сумма теперь на оставшейся карточке)
      s.profiles[keepId] = {
        ...keepProfile,
        importedSold: keepProfile.importedSold + dupProfile.importedSold,
        paidAmount: keepProfile.paidAmount + dupProfile.paidAmount,
      };
      delete s.profiles[duplicateId];
      delete s.comments[duplicateId];
      delete s.customFieldValues[duplicateId];
      delete s.appActivity[duplicateId];
      delete s.broadcastHistory[duplicateId];
      delete s.calls[duplicateId];
      delete s.files[duplicateId];
    });
    // Мягкое удаление дубля (core-rules №2), как при обычном удалении карточки (F-04-137)
    coreTx.update('clients', duplicateId, { deletedAt: nowDateTime() });
    // ⭐ F-00-040 → F-04-137: объединение — тоже правка клиента
    logChange(businessId, {
      clientId: duplicateId,
      clientName: dup.name,
      action: 'merged',
      targetName: keep.name,
      authorId: actorId,
      authorName: actorName,
    });
  });
}

/** F-04-042: массовое удаление требует ввода слова подтверждения (наше решение — предл.) */
export const BULK_DELETE_WORD = 'УДАЛИТЬ';

/** Одна операция на всех выбранных (recheck-c2: раньше — по запросу на клиента, «ушёл раньше — удалена часть») */
export function bulkDeleteClients(businessId: Id, clientIds: Id[], actorId?: Id, actorName?: string): Promise<void> {
  if (isApiMode()) return C.bulkDeleteClients(businessId, clientIds);
  return request(() => {
    assertCan('clients.delete');
    clientIds.forEach((id) => deleteClientTx(businessId, id, actorId, actorName));
  });
}
