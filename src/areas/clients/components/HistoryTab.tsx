'use client';

/**
 * Вкладка «История визитов» карточки клиента (F-04-075, F-04-076, F-04-167, F-04-226): дата · мастер · статус · услуги ·
 * оплата (ux-r5 №14, e2e-q3 №4). Оплата визита — тем же правилом, что «Баланс» в карточке (domain/clients/money).
 * F-04-221 (первое «Готово, когда»): групповое событие, на которое записан клиент, видно здесь тем же списком,
 * бейджем «groupEvent» — `visit.groupEvent`. Расписание повторных посещений и вкладки самого группового события
 * («Клиенты»/«Расписание») — узел раздела `resources` (окно события), не наш; см. qa/requests/clients.md.
 */
import { useLocale } from 'next-intl';
import { ExternalLink, History, Plus } from 'lucide-react';
import { listClientVisits, listFiles } from '@/api/clients';
import { useCoreList } from '@/api/core';
import { useApiQuery } from '@/api/request';
import type { Service } from '@/domain/core';
import type { ClientVisit, HistoryFilter } from '@/domain/clients';
import { HISTORY_FILTERS } from '@/domain/clients';
import { useT } from '@/i18n/useT';
import { useFormat } from '@/i18n/useFormat';
import { pickText } from '@/lib/text';
import { Avatar } from '@/ui/Avatar';
import { Badge } from '@/ui/Badge';
import { BookingStatusBadge } from '@/ui/BookingStatusBadge';
import { Button, LinkButton } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { Skeleton, SkeletonText } from '@/ui/Skeleton';
import { usePagedList } from '@/ui/Pagination';

export interface HistoryTabProps {
  businessId: string;
  clientId: string;
  services: Service[];
  filter: HistoryFilter;
  onFilterChange: (filter: HistoryFilter) => void;
  /** «Внести прошлый визит» — только с правом правки */
  onAddVisit?: () => void;
  /** F-00-132: без права «Просмотр счетов» суммы визита не показываем (только статус оплаты) */
  canViewAccounts: boolean;
}

function serviceLabel(line: ClientVisit['services'][number], services: Service[], locale: string): string {
  if (line.customName) return line.customName;
  const svc = services.find((s) => s.id === line.serviceId);
  return svc ? pickText(svc.name, locale as never) : '—';
}

export function HistoryTab({ businessId, clientId, services, filter, onFilterChange, onAddVisit, canViewAccounts }: HistoryTabProps) {
  const t = useT('clients');
  const fmt = useFormat();
  const locale = useLocale();
  const visitsQ = useApiQuery(['clients', 'visits', businessId, clientId], () => listClientVisits(businessId, clientId), {
    enabled: Boolean(businessId) && Boolean(clientId),
  });
  const filesQ = useApiQuery(['clients', 'files', clientId], () => listFiles(clientId), { enabled: Boolean(clientId) });
  const staffQ = useCoreList('staff', { businessId }, { enabled: Boolean(businessId) });

  const rows = visitsQ.data ?? [];
  const filtered = filter === 'all' ? rows : rows.filter((r) => r.paymentStatus === filter);
  const staffName = (id: string) => staffQ.data?.find((s) => s.id === id)?.name;
  // Постранично, как во всех списках (DESIGN.md → Long lists)
  const { pageItems, pager } = usePagedList(filtered, { resetKey: filter });

  if (visitsQ.isError) return <ErrorState title={t('cardView.historyFailed')} onRetry={visitsQ.refetch} />;
  if (visitsQ.isLoading) return <HistoryTabSkeleton withAction={Boolean(onAddVisit)} />;

  const addButton = onAddVisit && (
    <Button size="sm" variant="outline" leftIcon={<Plus aria-hidden />} onClick={onAddVisit} data-f="F-00-129">
      {t('addPastVisit')}
    </Button>
  );

  return (
    <div data-f="F-04-075 F-04-076 F-04-221" className="flex flex-col gap-4">
      {rows.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SegmentedControl
            fullWidth
            className="sm:w-auto"
            aria-label={t('cardView.historyFilter')}
            value={filter}
            onValueChange={(v) => onFilterChange(v as HistoryFilter)}
            options={HISTORY_FILTERS.map((f) => ({ value: f, label: t(`card.history.filter.${f}`) }))}
          />
          {addButton}
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          variant="section"
          framed
          kind={rows.length === 0 ? 'default' : 'search'}
          icon={<History aria-hidden />}
          title={rows.length === 0 ? t('card.history.emptyTitle') : t('card.history.emptyFilteredTitle')}
          description={rows.length === 0 ? t('card.history.emptyText') : t('card.history.emptyFilteredText')}
          onReset={rows.length === 0 ? undefined : () => onFilterChange('all')}
          action={rows.length === 0 ? addButton : undefined}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {pageItems.map((visit) => {
            const photos = (filesQ.data ?? []).filter((f) => f.visitId === visit.id).map((f) => f.dataUrl);
            const master = staffName(visit.staffId);
            return (
              <li key={visit.id}>
                <Card padding="md" className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex min-w-0 flex-col gap-1">
                      <p className="text-base font-semibold text-fg">{fmt.dateTime(visit.date)}</p>
                      {master && (
                        <p className="flex items-center gap-2 text-sm text-muted">
                          <Avatar name={master} size="xs" />
                          {master}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <BookingStatusBadge status={visit.status} size="sm" />
                      {visit.manual && <Badge tone="neutral">{t('card.history.manual')}</Badge>}
                      {visit.groupEvent && <Badge tone="info">{t('card.history.groupEvent')}</Badge>}
                      {visit.paymentStatus === 'debt' && <Badge tone="danger">{t('card.history.debt')}</Badge>}
                      {visit.paymentStatus === 'unpaid' && visit.status === 'arrived' && <Badge tone="warning">{t('card.history.unpaid')}</Badge>}
                    </div>
                  </div>
                  <p className="text-base text-fg">{visit.services.map((l) => serviceLabel(l, services, locale)).join(', ') || t('card.history.noServices')}</p>
                  {photos.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {photos.map((src, i) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={i} src={src} alt="" className="size-14 rounded-lg border border-border object-cover" />
                      ))}
                    </div>
                  )}
                  {visit.note && <p className="text-sm text-muted">{visit.note}</p>}
                  <div data-f="F-00-132" className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-sm">
                    <span className="text-muted tabular-nums">
                      {!canViewAccounts
                        ? visit.status === 'arrived'
                          ? t('card.history.paidStatusOnly', {
                              status:
                                visit.paymentStatus === 'debt'
                                  ? t('card.history.debt')
                                  : visit.paymentStatus === 'unpaid'
                                    ? t('card.history.unpaid')
                                    : t('card.history.paidFull'),
                            })
                          : ''
                        : visit.status === 'arrived'
                          ? t('card.history.paidOf', { paid: fmt.money(visit.paid), total: fmt.money(visit.total) })
                          : fmt.money(visit.total)}
                    </span>
                    <LinkButton
                      // F-04-075 (исправлено): без `date=` журнал открывает СЕГОДНЯ и не находит визит не на сегодня —
                      // тот же формат параметра, что у notify/schedule (`?date=…&booking=…`)
                      href={`/biz/journal?date=${visit.date.slice(0, 10)}&booking=${visit.id}`}
                      variant="ghost"
                      size="sm"
                      rightIcon={<ExternalLink aria-hidden />}
                      className="text-primary-text"
                    >
                      {t('card.history.openBooking')}
                    </LinkButton>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
      {pager}

      <p data-f="F-04-226" className="text-sm text-muted">
        {t('card.history.cancelledHint')}
      </p>
    </div>
  );
}

/**
 * Скелетон вкладки той же формы, что и содержимое: ряд «Все / Не оплачены / Долг» (+ «Внести прошлый визит») и две
 * карточки визита — приход истории не толкает страницу (было 4 тонкие строки на месте карточек по ~190 px).
 */
export function HistoryTabSkeleton({ withAction, rows = 1 }: { withAction: boolean; rows?: number }) {
  const t = useT('clients');
  return (
    <div aria-busy className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SegmentedControl
          fullWidth
          className="sm:w-auto"
          aria-label={t('cardView.historyFilter')}
          value="all"
          onValueChange={() => {}}
          options={HISTORY_FILTERS.map((f) => ({ value: f, label: t(`card.history.filter.${f}`), disabled: true }))}
        />
        {withAction && (
          <Button size="sm" variant="outline" leftIcon={<Plus aria-hidden />} disabled>
            {t('addPastVisit')}
          </Button>
        )}
      </div>
      <ul className="flex flex-col gap-3">
        {Array.from({ length: rows }, (_, i) => (
          <li key={i}>
            <Card padding="md" className="flex flex-col gap-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex min-w-0 flex-col gap-1">
                  <p className="text-base font-semibold text-fg">
                    <SkeletonText width="16ch" />
                  </p>
                  <p className="flex items-center gap-2 text-sm text-muted">
                    <Skeleton variant="circle" className="size-6 shrink-0" />
                    <SkeletonText width="12ch" />
                  </p>
                </div>
                <Badge tone="neutral" size="sm">
                  <SkeletonText width="7ch" />
                </Badge>
              </div>
              <p className="text-base text-fg">
                <SkeletonText width="28ch" />
              </p>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-sm">
                <span className="text-muted tabular-nums">
                  <SkeletonText width="22ch" />
                </span>
                <Button variant="ghost" size="sm" rightIcon={<ExternalLink aria-hidden />} className="text-primary-text" disabled>
                  {t('card.history.openBooking')}
                </Button>
              </div>
            </Card>
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted">{t('card.history.cancelledHint')}</p>
    </div>
  );
}
