'use client';

/**
 * F-12-029 «Визиты»: вкладки «предстоящие (N)» / «прошедшие», сгруппированные по дням, галочка «Подтвердить
 * запись» (F-12-031). F-12-030 «Лента активности по записям» с фильтрами источника (F-12-038) и полной историей
 * правок. F-12-032 — ID бизнеса и «Написать в поддержку» рядом (наш дом для этого блока, F-12-032 «🔒»).
 */
import { CalendarClock, Check, MessageCircleQuestion, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { cancelActivityBooking, confirmVisit, getActivityFeed, getVisits } from '@/api/reports';
import { useApiMutation, useApiQuery } from '@/api/request';
import { ReportHeader } from '@/areas/reports/components/ReportHeader';
import { useCan, useCurrent } from '@/demo/hooks';
import type { ActivityFilter, VisitRow } from '@/domain/reports';
import { formatClientNameForReports } from '@/domain/reports';
import { useT } from '@/i18n/useT';
import { useFormat } from '@/i18n/useFormat';
import { useToast } from '@/ui/Toast';
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { IconButton } from '@/ui/IconButton';
import { PermissionGate } from '@/ui/PermissionGate';
import { SkeletonText } from '@/ui/Skeleton';
import { Tabs } from '@/ui/Tabs';
import { usePagedList } from '@/ui/Pagination';

export function VisitsScreen() {
  const t = useT('reports');
  const { businessId, activeLocationIds, ready } = useCurrent();
  const canSeePhones = useCan('clients.phones');
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');

  const visitsQ = useApiQuery(
    ['reports', 'visits', businessId, activeLocationIds, tab, canSeePhones],
    () => getVisits({ businessId: businessId!, locationIds: activeLocationIds, tab, canSeePhones }),
    { enabled: ready && !!businessId, keepPrevious: true },
  );

  const upcomingCountQ = useApiQuery(
    ['reports', 'visits', businessId, activeLocationIds, 'upcoming', canSeePhones],
    () => getVisits({ businessId: businessId!, locationIds: activeLocationIds, tab: 'upcoming', canSeePhones }),
    { enabled: ready && !!businessId, keepPrevious: true },
  );

  // Вторая вкладка — заранее в кэше: переключение вкладок показывает готовый список, а не прежний под новым заголовком
  useApiQuery(
    ['reports', 'visits', businessId, activeLocationIds, 'past', canSeePhones],
    () => getVisits({ businessId: businessId!, locationIds: activeLocationIds, tab: 'past', canSeePhones }),
    { enabled: ready && !!businessId, keepPrevious: true },
  );

  // Постранично, как во всех списках (DESIGN.md → Long lists): листаем плоский список визитов, затем группируем по дням
  const flatVisits = (visitsQ.data?.days ?? []).flatMap((day) => day.rows.map((row) => ({ date: day.date, row })));
  const { pageItems: visitPage, pager: visitsPager } = usePagedList(flatVisits, { resetKey: tab });
  const pageDays: { date: string; rows: VisitRow[] }[] = [];
  for (const { date, row } of visitPage) {
    const last = pageDays[pageDays.length - 1];
    if (last?.date === date) last.rows.push(row);
    else pageDays.push({ date, rows: [row] });
  }

  // Контекст ещё не готов — та же страница со скелетонами (запросы отвечают isLoading), а не пустой кадр
  return (
    <PermissionGate permission="reports.view" fallback="message">
      <div data-f="F-12-029" className="flex flex-col gap-6">
        {/* Отч10: служебная строка «ID салона: biz_nuri» ушла — владельцу она ни к чему; поддержка осталась ссылкой в шапке */}
        <ReportHeader
          slug="visits"
          crumbGroup="attendance"
          helpBody={t('help.visits')}
          actions={
            <a
              data-f="F-12-032"
              href="/biz/support"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-primary-text hover:bg-surface-2"
            >
              <MessageCircleQuestion className="size-4" aria-hidden />
              <span className="hidden sm:inline">{t('visits.contactSupport')}</span>
            </a>
          }
        />


        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_1fr]">
          <div className="flex flex-col gap-3">
            <Tabs
              items={[
                { value: 'upcoming', label: t('visits.upcoming'), badge: upcomingCountQ.isLoading ? <SkeletonText width="2ch" /> : (upcomingCountQ.data?.count ?? 0) },
                { value: 'past', label: t('visits.past') },
              ]}
              value={tab}
              onValueChange={(v) => setTab(v as 'upcoming' | 'past')}
            />
            {visitsQ.isError ? (
              <ErrorState onRetry={() => visitsQ.refetch()} />
            ) : visitsQ.isLoading ? (
              <VisitsDayGroupSkeleton />
            ) : !visitsQ.data?.days.length ? (
              <EmptyState
                icon={<CalendarClock />}
                title={tab === 'upcoming' ? t('visits.emptyUpcomingTitle') : t('visits.emptyPastTitle')}
                description={t('visits.emptyText')}
              />
            ) : (
              <div className="flex flex-col gap-5">
                {pageDays.map((day) => (
                  <VisitsDayGroup key={day.date} date={day.date} rows={day.rows} onChanged={() => visitsQ.refetch()} />
                ))}
                {visitsPager}
              </div>
            )}
          </div>

          <ActivityFeed businessId={businessId} locationIds={activeLocationIds} ready={ready} canSeePhones={canSeePhones} />
        </div>
      </div>
    </PermissionGate>
  );
}

function VisitsDayGroup({ date, rows, onChanged }: { date: string; rows: import('@/domain/reports').VisitRow[]; onChanged: () => void }) {
  const t = useT('reports');
  const f = useFormat();
  const toast = useToast();
  const canSeePhones = useCan('clients.phones');
  const confirm = useApiMutation((id: string) => confirmVisit(id));
  const handleConfirm = async (id: string) => {
    try {
      await confirm.mutate(id);
      toast.success(t('visits.confirmed'));
      onChanged();
    } catch {
      toast.error(t('visits.confirmFailed'));
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <h3 className="sticky top-0 bg-surface/95 py-1 text-sm font-semibold text-fg backdrop-blur first-letter:uppercase">{f.date(date, 'weekdayLong')}</h3>
      <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-surface">
        {rows.map((row) => (
          <li key={row.bookingId} className="flex items-start gap-3 p-3">
            {row.canConfirm ? (
              <IconButton
                data-f="F-12-031 F-05-085"
                icon={<Check />}
                label={t('visits.confirmAction')}
                variant="outline"
                size="sm"
                disabled={confirm.isPending}
                onClick={() => handleConfirm(row.bookingId)}
              />
            ) : (
              <span className="size-10" aria-hidden />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-fg">
                {row.time} · {f.duration(row.durationMin)}
              </p>
              <p data-f="F-12-116" className="truncate text-sm text-fg">
                {formatClientNameForReports(row.clientName, canSeePhones) ?? t('visits.noClient')}
                {row.clientPhone && <span className="text-muted"> · {row.clientPhone === '•••' ? row.clientPhone : f.phone(row.clientPhone)}</span>}
              </p>
              <p className="truncate text-xs text-muted">
                {row.services.join(', ')} · {row.staffName}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Скелетон дня визитов — та же разметка: заголовок дня и строки (место галочки, время, клиент, услуги) */
function VisitsDayGroupSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h3 className="sticky top-0 bg-surface/95 py-1 text-sm font-semibold text-fg backdrop-blur first-letter:uppercase">
          <SkeletonText width="16ch" />
        </h3>
        <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-surface">
          {Array.from({ length: rows }, (_, i) => (
            <li key={i} className="flex items-start gap-3 p-3">
              {/* Место галочки «Подтвердить» — рамка той же кнопки (у подтверждённых строк её потом нет) */}
              <span aria-hidden className="size-10 shrink-0 rounded-md border border-border-strong/55 bg-surface shadow-xs md:size-9" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-fg">
                  <SkeletonText width="11ch" />
                </p>
                <p className="truncate text-sm text-fg">
                  <SkeletonText width="24ch" />
                </p>
                <p className="truncate text-xs text-muted">
                  <SkeletonText width="30ch" />
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Скелетон записи ленты — та же карточка: плашка источника, услуга, дата · мастер, клиент, место корзины */
function ActivityEntrySkeleton() {
  return (
    <li className="rounded-xl border border-border bg-surface p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="inline-flex rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium tracking-wide text-muted uppercase">
            <SkeletonText width="8ch" />
          </span>
          <p className="mt-1 truncate text-sm font-medium text-fg">
            <SkeletonText width="18ch" />
          </p>
          <p className="text-xs text-muted">
            <SkeletonText width="30ch" />
          </p>
          <p className="text-xs text-muted">
            <SkeletonText width="20ch" />
          </p>
        </div>
        <span className="size-10 shrink-0 md:size-9" aria-hidden />
      </div>
    </li>
  );
}

const FILTERS: ActivityFilter[] = ['newOnline', 'all', 'online', 'offline'];

function ActivityFeed({
  businessId,
  locationIds,
  ready,
  canSeePhones,
}: {
  businessId?: string;
  locationIds: string[];
  ready: boolean;
  canSeePhones: boolean;
}) {
  const t = useT('reports');
  const f = useFormat();
  const toast = useToast();
  const [filter, setFilter] = useState<ActivityFilter>('all');

  const feedQ = useApiQuery(
    ['reports', 'activity', businessId, locationIds, filter, canSeePhones],
    () => getActivityFeed({ businessId: businessId!, locationIds, filter, canSeePhones }),
    { enabled: ready && !!businessId, keepPrevious: true },
  );
  // Постранично, как во всех списках (DESIGN.md → Long lists)
  const { pageItems: feedPage, pager: feedPager } = usePagedList(feedQ.data ?? [], { resetKey: filter });
  const cancel = useApiMutation((id: string) => cancelActivityBooking(id));
  // Отмена записи уходит клиенту уведомлением и не откатывается тостом — спрашиваем (CONVENTIONS §0: опасное — ConfirmDialog)
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const handleCancel = async (id: string) => {
    try {
      await cancel.mutate(id);
      toast.success(t('visits.cancelled'));
      feedQ.refetch();
    } catch {
      toast.error(t('visits.cancelFailed'));
    }
  };

  return (
    <section data-f="F-12-030 F-01-099" className="flex flex-col gap-3">
      <ConfirmDialog
        open={confirmId !== null}
        onOpenChange={(open) => !open && setConfirmId(null)}
        tone="danger"
        title={t('visits.cancelConfirmTitle')}
        description={t('visits.cancelConfirmText')}
        confirmLabel={t('visits.cancelAction')}
        onConfirm={async () => {
          if (confirmId) await handleCancel(confirmId);
          setConfirmId(null);
        }}
      />
      <h2 className="text-lg font-semibold text-fg">{t('visits.activityTitle')}</h2>
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setFilter(k)}
            className={
              'min-h-11 rounded-full px-3 text-sm font-medium transition-colors ' +
              (filter === k ? 'bg-primary-soft text-primary-text' : 'bg-surface-2 text-muted hover:bg-surface-3')
            }
          >
            {t(`visits.activityFilters.${k}` as never)}
          </button>
        ))}
      </div>
      {feedQ.isError ? (
        <ErrorState onRetry={() => feedQ.refetch()} />
      ) : feedQ.isLoading ? (
        <ul className="flex flex-col gap-3">
          {Array.from({ length: 10 }, (_, i) => (
            <ActivityEntrySkeleton key={i} />
          ))}
        </ul>
      ) : !feedQ.data?.length ? (
        <EmptyState compact icon={<CalendarClock />} title={t('visits.activityEmptyTitle')} />
      ) : (
        <ul className="flex flex-col gap-3">
          {feedPage.map((entry) => (
            <li key={entry.bookingId} className="rounded-xl border border-border bg-surface p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span
                    data-f="F-12-038 F-14-138 F-13-057"
                    className="inline-flex rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium tracking-wide text-muted uppercase"
                  >
                    {t(`visits.source.${entry.sourceLabel}` as never)}
                  </span>
                  <p className="mt-1 truncate text-sm font-medium text-fg">{entry.serviceNames || t('visits.noService')}</p>
                  <p className="text-xs text-muted">
                    {f.date(entry.date, 'dayMonth')}, {entry.time} · {f.duration(entry.durationMin)} · {entry.staffName}
                  </p>
                  <p data-f="F-12-116" className="text-xs text-muted">
                    {entry.clientDeleted
                      ? t('visits.deletedClient')
                      : (formatClientNameForReports(entry.clientName, canSeePhones) ?? t('visits.noClient'))}
                    {entry.clientPhone && ` · ${entry.clientPhone === '•••' ? entry.clientPhone : f.phone(entry.clientPhone)}`}
                  </p>
                </div>
                <IconButton
                  icon={<Trash2 />}
                  label={t('visits.cancelAction')}
                  variant="ghost"
                  size="sm"
                  disabled={cancel.isPending}
                  onClick={() => setConfirmId(entry.bookingId)}
                />
              </div>
              {entry.history.length > 0 && (
                <ul className="mt-2 flex flex-col gap-1 border-t border-border pt-2 text-xs text-muted">
                  {entry.history.map((h) => (
                    <li key={h.id}>
                      <span className="font-medium text-fg">
                        {h.authorName === 'client' ? t('visits.byClient') : h.authorName === 'system' ? t('visits.bySystem') : h.authorName}
                      </span>
                      {' — '}
                      {t(`visits.historyAction.${h.action}` as never)}
                      {' — '}
                      {f.dateTime(h.at)}
                      {h.action === 'moved' && h.moved ? (
                        <span>
                          {' '}
                          (
                          {h.moved.prevStart && h.moved.start && h.moved.prevStart !== h.moved.start && (
                            <>
                              {f.dateTime(h.moved.prevStart)} → {f.dateTime(h.moved.start)}
                            </>
                          )}
                          {h.moved.prevStaffName && h.moved.staffName && (
                            <>
                              {h.moved.prevStart && h.moved.start && h.moved.prevStart !== h.moved.start ? ', ' : ''}
                              {h.moved.prevStaffName} → {h.moved.staffName}
                            </>
                          )}
                          )
                        </span>
                      ) : h.summary?.startsWith('+') ? (
                        <span> ({t('visits.historyDelay', { min: h.summary.slice(1) })})</span>
                      ) : (
                        h.summary && h.summary !== 'created' && h.summary !== 'updated' && <span> ({h.summary})</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
      {!feedQ.isError && feedPager}
    </section>
  );
}
