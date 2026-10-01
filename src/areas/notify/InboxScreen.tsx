'use client';

/**
 * /biz/notifications/inbox — центр уведомлений (F-05-061 веб, F-05-062 приложение для бизнеса — тот же
 * экран отвечает на телефоне 390 px) и вкладка «Новости сервиса» + связь с поддержкой (F-05-132).
 * Реальный колокольчик в шапке кабинета — фундамент (src/shell/workspace/NotificationsBell.tsx);
 * содержимое сюда отдаётся просьбой (qa/requests/notify.md).
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import {
  BellOff,
  BellRing,
  CalendarPlus,
  CalendarSync,
  CalendarX,
  CheckCheck,
  Clock,
  LifeBuoy,
  Mail,
  MessageCircle,
  Newspaper,
  Phone,
  PhoneIncoming,
  PhoneMissed,
  Send,
  Wallet,
} from 'lucide-react';
import type { InboxEventKind } from '@/api/notify';
import { getWebPopupSettings, listInboxEvents, listNews, markInboxRead } from '@/api/notify';
import { useCoreList } from '@/api/core';
import { listNetworkCalls } from '@/api/network';
import { useApiMutation, useApiQuery } from '@/api/request';
import { SupportChatModal } from '@/areas/notify/components/SupportChatModal';
import { useCurrent } from '@/demo/hooks';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { waLink } from '@/lib/phone';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { PageHeader } from '@/ui/PageHeader';
import { Reveal } from '@/ui/Reveal';
import { SectionCard } from '@/ui/SectionCard';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { Skeleton, SkeletonText } from '@/ui/Skeleton';
import { useSkeletonCount } from '@/ui/hooks/useSkeletonCount';
import { NotificationRow } from '@/ui/NotificationRow';
import { Tabs } from '@/ui/Tabs';
import { usePagedList } from '@/ui/Pagination';

type Filter = 'all' | 'new' | 'deleted';

// 🔒 демо-контакты поддержки (F-05-132): реальный Telegram/WhatsApp-аккаунт платформы не заведён — открывают
// настоящий deep-link мессенджера, но на выдуманный номер/юзернейм, помечено как демо в assumed отчёта.
const SUPPORT_TELEGRAM_HANDLE = 'booking_am_support';
const SUPPORT_WHATSAPP_PHONE = '+37400100000';
// 🔒 демо-персональный менеджер (F-05-132, проверка 1): в справке появляется «от 7 сотрудников» —
// условие показа взяли отсюда же (см. «Платно у них»: приоритетная поддержка тоже с 7 сотрудников),
// настоящего распределения по менеджерам в проекте нет — контакты выдуманы, помечено в assumed отчёта.
const MANAGER_MIN_STAFF = 7;
const DEMO_MANAGER = { name: 'Анна Погосян', phone: '+37400100010', email: 'anna@booking.am' };

/**
 * Скелетон строки центра уведомлений — та же разметка, что NotificationRow variant="card": рамка, круг 36 px,
 * три строки (что случилось · кто/что/когда · время уведомления).
 */
function InboxRowSkeleton() {
  return (
    <li aria-hidden>
      <span className="flex w-full items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3">
        <Skeleton variant="circle" className="size-9 shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 text-base font-medium text-fg">
            <SkeletonText width="16ch" />
          </span>
          <span className="block truncate text-sm text-fg/80">
            <SkeletonText width="30ch" />
          </span>
          <span className="block text-sm text-muted">
            <SkeletonText width="14ch" />
          </span>
        </span>
      </span>
    </li>
  );
}

/** Скелетон строки звонка — та же разметка: круг 36 px, номер и «пропущен · когда» */
function CallRowSkeleton() {
  return (
    <li aria-hidden className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3">
      <Skeleton variant="circle" className="size-9 shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-fg">
          <SkeletonText width="15ch" />
        </span>
        <span className="block text-sm text-muted">
          <SkeletonText width="22ch" />
        </span>
      </span>
    </li>
  );
}

export function InboxScreen() {
  const t = useT('notify');
  const format = useFormat();
  const router = useRouter();
  const locale = useLocale() as 'ru' | 'en' | 'hy';
  const { ready, businessId, networkId } = useCurrent();
  const [tab, setTab] = useState<'events' | 'calls' | 'news'>('events');
  const [supportChatOpen, setSupportChatOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');

  // F-05-061: ключ свой (namespace 'notify'), не 'journal' — раздел не должен делить кэш-ключ с чужим разделом.
  // core-k2/core-k4: лента строится ядром (listBookingEvents — создана/статус/перенесена/удалена/опоздание),
  // не самодельным чтением bookings, иначе обычная отмена (без soft-delete) не попадала в центр уведомлений.
  const eventsQ = useApiQuery(['notify', 'inboxEvents', businessId], () => listInboxEvents(businessId!), { enabled: ready && !!businessId });
  const staffQ = useCoreList('staff', { businessId }, { enabled: ready && !!businessId });
  const newsQ = useApiQuery(['notify', 'news'], () => listNews());
  const markRead = useApiMutation(markInboxRead);
  const webPopupQ = useApiQuery(['notify', 'webPopups', businessId], () => getWebPopupSettings(businessId!), { enabled: ready && !!businessId });
  // F-13-209: раздел «Звонки» в центре уведомлений — только при подключённой телефонии сети
  // (F-11-146…152, @/api/network); без сети или без разрешённого маршрута вкладка просто пуста,
  // а не «не показываем совсем» — «Готово, когда» сети без телефонии из F-05-061 всё ещё требует
  // видеть разделы «Записи»/«Остальные».
  const callsQ = useApiQuery(
    ['notify', 'inboxCalls', networkId, businessId],
    () => listNetworkCalls(networkId!, businessId),
    { enabled: ready && !!networkId },
  );
  // F-05-058: галочка «Операции с записями» (/biz/notifications/channels) — выключена, значит новые записи
  // не всплывают попапом и не попадают в центр уведомлений вовсе (то же правило для попапа и для колокольчика).
  // ⭐ «Закрытие дня» (01.10.2026) — своя галочка; строки ленты фильтрует api, выключены обе — пусто с подсказкой
  const bookingOpsOn = (webPopupQ.data?.bookingOps ?? true) || webPopupQ.data?.dayClose !== false;

  // F-05-061/F-05-062: журнал ищет запись только среди бронирований выбранного дня (по умолчанию сегодня) —
  // без ?date= клик по не-сегодняшней записи открывал ПУСТОЕ окно (activeBooking не находился).
  const events = bookingOpsOn ? (eventsQ.data ?? []) : [];

  // Фильтр «Удалённые» — записи, которых больше нет в расписании: и мягко удалённые, и просто отменённые.
  const REMOVED_KINDS = new Set<InboxEventKind>(['deleted', 'cancelled']);
  const filteredEvents = events.filter((e) => (filter === 'all' ? true : filter === 'new' ? !REMOVED_KINDS.has(e.kind) : REMOVED_KINDS.has(e.kind)));
  const unreadCount = events.filter((e) => e.unread).length;
  const eventsLoading = !ready || eventsQ.isLoading || webPopupQ.isLoading;
  // Скелетон ленты — столько строк, сколько было в прошлый раз (не больше страницы)
  const eventsSkeletonRows = useSkeletonCount('inboxEvents', { loading: eventsLoading, count: eventsLoading ? undefined : Math.min(filteredEvents.length, 10), fallback: 0, max: 10 });
  // Постранично, как во всех списках (DESIGN.md → Long lists): лента, звонки и новости
  const { pageItems: eventsPage, pager: eventsPager } = usePagedList(filteredEvents, { resetKey: filter });
  const { pageItems: callsPage, pager: callsPager } = usePagedList(callsQ.data ?? []);
  const { pageItems: newsPage, pager: newsPager } = usePagedList(newsQ.data ?? []);

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

  const markAllRead = async () => {
    if (!businessId) return;
    await markRead.mutate({ businessId, ids: filteredEvents.map((e) => e.id) });
  };

  return (
    <div data-f="F-05-061 F-05-062 F-14-130" className="flex flex-col gap-6">
      <PageHeader
        title={t('inbox.title')}
        description={t('inbox.subtitle')}
        meta={
          tab === 'events' && !eventsLoading && unreadCount > 0 ? (
            <Badge tone="primary" size="sm" dot>
              {t('inbox.unreadCount', { count: unreadCount })}
            </Badge>
          ) : undefined
        }
      />

      <Tabs
        variant="pill"
        value={tab}
        onValueChange={(v) => setTab(v as 'events' | 'calls' | 'news')}
        items={[
          { value: 'events', label: t('inbox.tabs.events'), icon: <CalendarPlus aria-hidden /> },
          { value: 'calls', label: t('inbox.tabs.calls'), icon: <Phone aria-hidden /> },
          { value: 'news', label: t('inbox.tabs.news'), icon: <Newspaper aria-hidden /> },
        ]}
      />

      {tab === 'events' ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SegmentedControl
              value={filter}
              onValueChange={(v) => setFilter(v as Filter)}
              options={[
                { value: 'all', label: t('inbox.filter.all') },
                { value: 'new', label: t('inbox.filter.new') },
                { value: 'deleted', label: t('inbox.filter.deleted') },
              ]}
            />
            <Button variant="ghost" size="sm" leftIcon={<CheckCheck aria-hidden />} onClick={markAllRead} disabled={!filteredEvents.length}>
              {t('inbox.markAllRead')}
            </Button>
          </div>

          {eventsQ.isError ? (
            <ErrorState onRetry={eventsQ.refetch} />
          ) : (
            <Reveal
              loading={eventsLoading}
              skeleton={
                // В прошлый раз лента была пуста (и в демо она обычно пуста) — то же пустое состояние, а не строки из ниоткуда
                eventsSkeletonRows === 0 ? (
                  <EmptyState title={t('inbox.emptyTitle')} description={t('inbox.emptyText')} />
                ) : (
                  <ul className="flex flex-col gap-2" aria-hidden>
                    {Array.from({ length: eventsSkeletonRows }, (_, i) => (
                      <InboxRowSkeleton key={i} />
                    ))}
                  </ul>
                )
              }
            >
              {!bookingOpsOn ? (
                <EmptyState
                  icon={<BellOff aria-hidden />}
                  title={t('inbox.disabledTitle')}
                  description={t('inbox.disabledText')}
                  action={
                    <Button variant="secondary" size="sm" onClick={() => router.push('/biz/notifications/channels')}>
                      {t('inbox.disabledAction')}
                    </Button>
                  }
                />
              ) : !filteredEvents.length ? (
                <EmptyState title={t('inbox.emptyTitle')} description={t('inbox.emptyText')} />
              ) : (
                <ul className="flex flex-col gap-2">
                  {eventsPage.map((event) => {
                    const Icon = EVENT_ICON[event.kind];
                    const dc = event.dayClose;
                    const detail = dc
                      ? t('inbox.dayClose.detail', {
                          revenue: format.money(dc.revenue),
                          cash: format.money(dc.cash),
                          diff: dc.discrepancy > 0 ? 'surplus' : dc.discrepancy < 0 ? 'shortage' : 'none',
                          amount: format.money(Math.abs(dc.discrepancy)),
                        })
                      : [
                      event.clientName,
                      event.service ? event.service[locale] || event.service.ru : undefined,
                      event.start ? format.dateTime(event.start) : undefined,
                    ]
                      .filter(Boolean)
                      .join(' · ');
                    return (
                      <li key={event.id}>
                        <NotificationRow
                          variant="card"
                          icon={<Icon aria-hidden />}
                          tone={REMOVED_KINDS.has(event.kind) || (dc?.discrepancy ?? 0) < 0 ? 'danger' : 'primary'}
                          title={t(`inbox.event.${event.kind}`, { deadline: event.deadline ? format.time(event.deadline) : 'none', name: dc?.closedByName ?? '' })}
                          detail={dc ? <span className="whitespace-normal">{detail}</span> : detail || undefined}
                          time={format.dateTime(event.createdAt)}
                          unread={event.unread}
                          onClick={() => {
                            if (businessId && event.unread) void markRead.mutate({ businessId, ids: [event.id] });
                            router.push(
                              event.kind === 'dayClosed' ? `/biz/journal?date=${event.date}&workday=dayClose` : `/biz/journal?date=${event.date}&booking=${event.bookingId}`,
                            );
                          }}
                        />
                      </li>
                    );
                  })}
                </ul>
              )}
            </Reveal>
          )}
          {!eventsQ.isError && bookingOpsOn && eventsPager}
        </div>
      ) : tab === 'calls' ? (
        <div data-f="F-13-209" className="flex flex-col gap-2">
          {!ready ? (
            <ul className="flex flex-col gap-2" aria-hidden>
              {Array.from({ length: 4 }, (_, i) => (
                <CallRowSkeleton key={i} />
              ))}
            </ul>
          ) : !networkId ? (
            <EmptyState icon={<Phone aria-hidden />} title={t('inbox.calls.noTelephonyTitle')} description={t('inbox.calls.noTelephonyText')} />
          ) : callsQ.isLoading ? (
            <ul className="flex flex-col gap-2" aria-hidden>
              {Array.from({ length: 4 }, (_, i) => (
                <CallRowSkeleton key={i} />
              ))}
            </ul>
          ) : callsQ.isError ? (
            <ErrorState onRetry={callsQ.refetch} />
          ) : !callsQ.data?.length ? (
            <EmptyState icon={<Phone aria-hidden />} title={t('inbox.calls.emptyTitle')} />
          ) : (
            <ul className="flex flex-col gap-2">
              {callsPage.map((call) => {
                const Icon = call.status === 'missed' ? PhoneMissed : PhoneIncoming;
                return (
                  <li key={call.id} className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3">
                    <span
                      className={`grid size-9 shrink-0 place-items-center rounded-full ${call.status === 'missed' ? 'bg-danger-soft text-danger' : 'bg-primary-soft text-primary-text'}`}
                    >
                      <Icon aria-hidden className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-fg">{format.phone(call.phone)}</span>
                      <span className="block text-sm text-muted">
                        {t(call.status === 'missed' ? 'inbox.calls.missed' : 'inbox.calls.accepted')} · {format.dateTime(call.at)}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          {ready && networkId && !callsQ.isError && callsPager}
        </div>
      ) : (
        <div data-f="F-05-132" className="flex flex-col gap-4">
          {newsQ.isLoading ? (
            <Skeleton lines={4} />
          ) : newsQ.isError ? (
            <ErrorState onRetry={newsQ.refetch} />
          ) : !newsQ.data?.length ? (
            <EmptyState title={t('inbox.newsEmptyTitle')} />
          ) : (
            <ul className="flex flex-col gap-3">
              {newsPage.map((item) => (
                <li key={item.id}>
                  <SectionCard title={item.title} description={format.date(item.date, 'long')}>
                    <p className="text-sm text-fg">{item.text}</p>
                  </SectionCard>
                </li>
              ))}
            </ul>
          )}
          {!newsQ.isError && newsPager}

          {(staffQ.data?.length ?? 0) >= MANAGER_MIN_STAFF && (
            <SectionCard title={t('inbox.managerTitle')} description={t('inbox.managerHint')}>
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-medium text-fg">{DEMO_MANAGER.name}</span>
                <a href={`tel:${DEMO_MANAGER.phone}`} className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Badge tone="neutral" icon={<Phone aria-hidden />} size="md" className="cursor-pointer hover:opacity-80">
                    {format.phone(DEMO_MANAGER.phone)}
                  </Badge>
                </a>
                <a href={`mailto:${DEMO_MANAGER.email}`} className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Badge tone="neutral" icon={<Mail aria-hidden />} size="md" className="cursor-pointer hover:opacity-80">
                    {DEMO_MANAGER.email}
                  </Badge>
                </a>
              </div>
            </SectionCard>
          )}

          <SectionCard title={t('inbox.supportTitle')} description={t('inbox.supportHint')}>
            <div className="flex flex-wrap gap-2">
              <a
                href={`https://t.me/${SUPPORT_TELEGRAM_HANDLE}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Badge tone="info" icon={<MessageCircle aria-hidden />} size="md" className="cursor-pointer hover:opacity-80">
                  {t('inbox.telegram')}
                </Badge>
              </a>
              <a
                href={waLink(SUPPORT_WHATSAPP_PHONE, t('inbox.whatsappPrefill'))}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Badge tone="success" icon={<Send aria-hidden />} size="md" className="cursor-pointer hover:opacity-80">
                  {t('inbox.whatsapp')}
                </Badge>
              </a>
              <button
                type="button"
                onClick={() => setSupportChatOpen(true)}
                className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Badge tone="neutral" icon={<LifeBuoy aria-hidden />} size="md" className="cursor-pointer hover:opacity-80">
                  {t('inbox.supportChat')}
                </Badge>
              </button>
            </div>
          </SectionCard>
        </div>
      )}

      <SupportChatModal open={supportChatOpen} onOpenChange={setSupportChatOpen} />
    </div>
  );
}
