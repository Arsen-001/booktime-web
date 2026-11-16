'use client';

/**
 * Центр уведомлений — лёгкий вход для каркаса кабинета (07.10.2026, скорость): колокольчик (NotificationsBell) есть
 * на каждой странице /biz. В режиме api — запросы к серверу; в демо полный '@/api/notify' догружается отдельным
 * куском (viaMock). Без этого каждая страница кабинета тянула весь API уведомлений и настроек. Те же имена
 * реэкспортирует '@/api/notify' — разделы импортируют оттуда, как раньше.
 */
import { readArea } from '@/api/area';
import { isApiMode } from '@/api/http';
import * as N from '@/api/notify.server';
import { viaMock } from '@/api/request';
import type { Id } from '@/domain/core';

const notify = () => import('@/api/notify');

/** Общий недельный лимит пушей бизнеса (F-00-114): рассылки раздела «Уведомления» и пуши из CRM */
export const WEEKLY_PUSH_LIMIT = 3;

export const markInboxRead = (input: { businessId: Id; ids: Id[] }) => {
  // Возврат каллеру не важен (просто триггерит перечитывание) — но тип должен остаться тем же, что у мока
  // (вся область `notify`), а не Promise<void>, иначе useApiMutation типизируется по-разному в двух режимах.
  if (isApiMode()) return N.markInboxRead(input).then(() => readArea('notify'));
  return viaMock(notify, (m) => m.markInboxReadMock(input));
};

export const countUnreadInbox = (businessId: Id) => {
  if (isApiMode()) return N.countUnreadInbox(businessId);
  return viaMock(notify, (m) => m.countUnreadInboxMock(businessId));
};

export const listInboxPreview = (businessId: Id, limit = 5) => {
  if (isApiMode()) return N.listInboxPreview(businessId, limit);
  return viaMock(notify, (m) => m.listInboxPreviewMock(businessId, limit));
};

/** Полная вкладка «Записи» центра уведомлений (F-05-061/062) — та же лента, что и превью колокольчика */
export const listInboxEvents = (businessId: Id) => {
  if (isApiMode()) return N.listInboxEvents(businessId);
  return viaMock(notify, (m) => m.listInboxEventsMock(businessId));
};

export const getWebPopupSettings = (businessId: Id) => {
  if (isApiMode()) return N.getWebPopupSettings(businessId);
  return viaMock(notify, (m) => m.getWebPopupSettingsMock(businessId));
};
