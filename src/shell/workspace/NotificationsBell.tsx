'use client';

import { ArrowRight, Bell, BellOff, BellRing, CalendarClock, CalendarPlus, CalendarSync, CalendarX, CheckCheck, Clock, PackageMinus, Wallet } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { InboxEventKind, InboxPreviewItem } from '@/api/notify';
import { countUnreadInbox, getWebPopupSettings, listInboxEvents, listInboxPreview, markInboxRead } from '@/api/notify';
import { useApiMutation, useApiQuery } from '@/api/request';
import { listStockBellAlerts, markStockBellAlertsRead, type StockBellAlert } from '@/api/stock';
import type { Id } from '@/domain/core';
import { useCan, useCurrent } from '@/demo/hooks';
import { useLocale } from 'next-intl';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { LinkButton } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { IconButton } from '@/ui/IconButton';
import { NotificationRow } from '@/ui/NotificationRow';
import { Popover } from '@/ui/Popover';
import { Skeleton } from '@/ui/Skeleton';

export interface NotificationsBellProps {
  /** Экран всех уведомлений (у кабинета — /biz/notifications/inbox, если раздел виден персоне) */
  href?: string;
}

const EVENT_ICON: Record<InboxEventKind, typeof CalendarPlus> = {
  created: CalendarPlus,
  onlineCreated: CalendarPlus,
  cancelled: CalendarX,
  deleted: CalendarX,
  moved: CalendarSync,
  delayed: Clock,
  awaitingReminder: BellRing,
  dayClosed: Wallet,
};

const REMOVED_KINDS = new Set<InboxEventKind>(['cancelled', 'deleted']);

/**
 * Колокольчик (центр уведомлений, F-01-007/F-05-058/061/062). Данные — из `src/api/notify.ts`
 * (`countUnreadInbox`/`listInboxPreview`/`markInboxRead`, отданы разделом notify по просьбе из
 * `qa/requests/notify.md`, седьмой заход): счётчик непрочитанных на иконке, превью последних 5
 * в выпадающем списке, клик по строке отмечает её прочитанной и ведёт в журнал на нужный день
 * (`?date=&booking=` — без даты окно записи открывается пустым, тот же баг был в `InboxScreen`
 * до фикса g2-2-fix1), «Прочитать все» — по полному списку (`listInboxEvents`), не только по
 * показанным пяти строкам превью.
 */
export function NotificationsBell({ href }: NotificationsBellProps) {
  const t = useT('common');
  const tu = useT('ui');
  const tn = useT('notify');
  const format = useFormat();
  const router = useRouter();
  const locale = useLocale() as 'ru' | 'en' | 'hy';
  const ts = useT('stock');
  const { ready, businessId, locationId: rawLocationId, activeLocationIds } = useCurrent();
  const enabled = ready && !!businessId;
  // ⭐ F-00-137 (владелец, 01.10.2026): «заканчивается» и сроки годности склада — тем, кто ведёт склад
  const canStock = useCan('stock.edit');
  const stockLocationId = rawLocationId === 'all' ? activeLocationIds[0] : rawLocationId;
  const stockQ = useApiQuery(['stock', 'bellAlerts', businessId, stockLocationId], () => listStockBellAlerts(businessId!, stockLocationId!), {
    enabled: enabled && canStock && Boolean(stockLocationId),
  });
  const stockAlerts = canStock ? (stockQ.data ?? []) : [];
  const markStockRead = useApiMutation((input: { businessId: Id; ids: string[] }) => markStockBellAlertsRead(input.businessId, input.ids), {
    invalidates: [['stock', 'bellAlerts']],
  });

  // Ув10: галочки «Операции с записями» и ⭐ «Закрытие дня» (F-05-058, /biz/notifications/channels) гасят свои строки
  // в ленте (её фильтрует api); выключены обе — колокольчик молчит: без счётчика и без строк, как центр уведомлений.
  const popupsQ = useApiQuery(['notify', 'webPopups', businessId], () => getWebPopupSettings(businessId!), { enabled });
  const feedOn = (popupsQ.data?.bookingOps ?? true) || popupsQ.data?.dayClose !== false;
  const countQ = useApiQuery(['notify', 'unreadCount', businessId], () => countUnreadInbox(businessId!), { enabled: enabled && feedOn });
  const previewQ = useApiQuery(['notify', 'inboxPreview', businessId], () => listInboxPreview(businessId!, 5), { enabled: enabled && feedOn });
  const markRead = useApiMutation(markInboxRead);
  const markAll = useApiMutation(async (input: { businessId: Id }) => {
    const events = await listInboxEvents(input.businessId);
    const ids = events.filter((e) => e.unread).map((e) => e.id);
    if (ids.length) await markInboxRead({ businessId: input.businessId, ids });
    return ids;
  });

  const stockUnread = stockAlerts.filter((a) => a.unread).length;
  const unread = (feedOn ? (countQ.data ?? 0) : 0) + stockUnread;
  const items = feedOn ? (previewQ.data ?? []) : [];
  // Ув10: пока первой порции нет — скелет строк, а не «Новых уведомлений нет» (мигало при первом открытии)
  // У персоны без салона (наша панель) запросов нет вовсе — сразу пустое состояние, а не вечный скелет.
  const loadingFirst = !ready || (enabled && (popupsQ.isLoading || (feedOn && previewQ.isLoading)));

  const detailOf = (item: InboxPreviewItem): string | undefined => {
    const parts = [
      item.clientName,
      item.service ? item.service[locale] || item.service.ru : undefined,
      item.start ? format.dateTime(item.start) : undefined,
    ].filter(Boolean);
    return parts.length ? parts.join(' · ') : undefined;
  };

  const openStockAlert = (close: () => void, alert: StockBellAlert) => {
    if (businessId && alert.unread) void markStockRead.mutate({ businessId, ids: [alert.id] });
    close();
    router.push(alert.href);
  };

  const openItem = (close: () => void, item: InboxPreviewItem) => {
    if (businessId && item.unread) void markRead.mutate({ businessId, ids: [item.id] });
    close();
    // ⭐ «Закрыт день» — «Итоги дня» за эту дату (журнал открывает шторку по ?workday=dayClose)
    router.push(item.kind === 'dayClosed' ? `/biz/journal?date=${item.date}&workday=dayClose` : `/biz/journal?date=${item.date}&booking=${item.bookingId}`);
  };

  const dayCloseDetail = (d: NonNullable<InboxPreviewItem['dayClose']>) =>
    tn('inbox.dayClose.detail', {
      revenue: format.money(d.revenue),
      cash: format.money(d.cash),
      diff: d.discrepancy > 0 ? 'surplus' : d.discrepancy < 0 ? 'shortage' : 'none',
      amount: format.money(Math.abs(d.discrepancy)),
    });

  return (
    <Popover
      align="end"
      label={t('shell.notifications')}
      className="w-80 max-w-[calc(100vw-2rem)] p-2"
      trigger={(props) => (
        <span data-f="F-01-007" className="relative inline-flex">
          <IconButton {...props} variant="ghost" label={t('shell.notifications')} icon={<Bell />} />
          {unread > 0 && (
            <span
              aria-hidden
              className="pointer-events-none absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold leading-none text-primary-contrast ring-2 ring-surface"
            >
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </span>
      )}
    >
      {({ close }) => (
        <div className="flex flex-col">
          {enabled && unread > 0 && (
            <div className="flex items-center justify-between gap-2 px-2 pb-2">
              <span className="text-xs font-medium text-muted">{stockAlerts.length || items.some((i) => i.kind === 'dayClosed') ? t('shell.notifications') : tn('inbox.tabs.events')}</span>
              <button
                type="button"
                onClick={() => {
                  if (!businessId) return;
                  markAll.mutate({ businessId });
                  const stockIds = stockAlerts.filter((a) => a.unread).map((a) => a.id);
                  if (stockIds.length) void markStockRead.mutate({ businessId, ids: stockIds });
                }}
                disabled={markAll.isPending}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-primary-text hover:bg-primary-soft disabled:pointer-events-none disabled:opacity-50"
              >
                <CheckCheck aria-hidden className="size-3.5" />
                {tn('inbox.markAllRead')}
              </button>
            </div>
          )}

          {stockAlerts.length > 0 && (
            <ul data-f="F-00-137" className="mb-1 flex flex-col gap-1 border-b border-border pb-1">
              {stockAlerts.map((alert) => {
                const Icon = alert.kind === 'lowStock' ? PackageMinus : CalendarClock;
                return (
                  <li key={alert.id}>
                    <NotificationRow
                      icon={<Icon aria-hidden />}
                      tone={alert.kind === 'lowStock' ? 'danger' : 'primary'}
                      title={ts(alert.kind === 'lowStock' ? 'bell.lowStock' : 'bell.expiring', { count: alert.count })}
                      detail={alert.names.slice(0, 3).join(', ')}
                      time={ts('bell.stockLabel')}
                      unread={alert.unread}
                      onClick={() => openStockAlert(close, alert)}
                    />
                  </li>
                );
              })}
            </ul>
          )}

          {loadingFirst ? (
            <ul aria-hidden className="flex flex-col gap-1">
              {[0, 1, 2].map((i) => (
                <li key={i} className="flex items-center gap-3 px-2 py-2">
                  <Skeleton variant="circle" className="size-8 shrink-0" />
                  <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <Skeleton className="h-3.5 w-2/5" />
                    <Skeleton className="h-3 w-3/4" />
                    <Skeleton className="h-3 w-1/4" />
                  </span>
                </li>
              ))}
            </ul>
          ) : !feedOn ? (
            <EmptyState variant="section" icon={<BellOff />} title={tn('inbox.disabledTitle')} description={tn('inbox.disabledText')} />
          ) : items.length === 0 && stockAlerts.length > 0 ? null : items.length === 0 ? (
            <EmptyState variant="section" icon={<BellOff />} title={t('shell.noNotifications')} description={tu('bell.emptyHint')} />
          ) : (
            <ul className="flex flex-col gap-1">
              {items.map((item) => {
                const Icon = EVENT_ICON[item.kind];
                return (
                  <li key={item.id}>
                    <NotificationRow
                      icon={<Icon aria-hidden />}
                      tone={REMOVED_KINDS.has(item.kind) || (item.dayClose?.discrepancy ?? 0) < 0 ? 'danger' : 'primary'}
                      title={tn(`inbox.event.${item.kind}`, { deadline: item.deadline ? format.time(item.deadline) : 'none', name: item.dayClose?.closedByName ?? '' })}
                      detail={item.dayClose ? <span className="whitespace-normal">{dayCloseDetail(item.dayClose)}</span> : detailOf(item)}
                      time={format.dateTime(item.createdAt)}
                      unread={item.unread}
                      onClick={() => openItem(close, item)}
                    />
                  </li>
                );
              })}
            </ul>
          )}

          {href && (
            <div className="border-t border-border pt-2">
              <LinkButton href={href} variant="ghost" size="sm" fullWidth rightIcon={<ArrowRight aria-hidden />} onClick={close}>
                {tu('bell.all')}
              </LinkButton>
            </div>
          )}
        </div>
      )}
    </Popover>
  );
}
