'use client';

/**
 * F-12-064…067: отчёт «Акции» — приводит ли акция новых клиентов, возвращаются ли они, сколько денег
 * принесла и кто из мастеров лучше удерживает клиентов акции.
 * Работает только для нефакопительных видов акций (discountFixed/cashbackFixed…, F-12-064); для
 * накопительных — честная заглушка «отчёт недоступен» (F-12-064 готово-когда).
 */
import { Megaphone } from 'lucide-react';
import { useState } from 'react';
import { getPromotionNotReturned, getPromotionsReport, listAccumulatingPromotions, listReportablePromotions } from '@/api/reports';
import { useApiQuery } from '@/api/request';
import { ExportExcelButton } from '@/areas/reports/components/ExportExcelButton';
import { ReportHeader } from '@/areas/reports/components/ReportHeader';
import { useCan, useCurrent } from '@/demo/hooks';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { addDays, today } from '@/lib/date';
import type { DateRange } from '@/ui/Calendar';
import { LinkButton } from '@/ui/Button';
import { DateRangePicker } from '@/ui/DateRangePicker';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { PermissionGate } from '@/ui/PermissionGate';
import { Select } from '@/ui/Select';
import { StatCard } from '@/ui/StatCard';
import { Table, type TableColumn } from '@/ui/Table';

export function PromotionsScreen() {
  const t = useT('reports');
  const f = useFormat();
  const { businessId, locationId: rawLocationId, activeLocationIds, ready } = useCurrent();
  const activeLocations = rawLocationId === 'all' ? activeLocationIds : activeLocationIds.slice(0, 1);
  const canSeePhones = useCan('clients.phones');

  const [promotionId, setPromotionId] = useState('');
  const [range, setRange] = useState<Required<DateRange>>({ from: addDays(today(), -29), to: today() });

  const reportableQ = useApiQuery(['reports', 'promotions', 'reportable', businessId], () => listReportablePromotions(businessId!), { enabled: ready && !!businessId, keepPrevious: true });
  const accumulatingQ = useApiQuery(['reports', 'promotions', 'accumulating', businessId], () => listAccumulatingPromotions(businessId!), { enabled: ready && !!businessId, keepPrevious: true });

  const dataQ = useApiQuery(
    ['reports', 'promotionsReport', businessId, activeLocations, promotionId, range],
    () => getPromotionsReport({ businessId: businessId!, locationIds: activeLocations, filters: { promotionId, range } }),
    { enabled: ready && !!businessId && !!promotionId },
  );

  const notReturnedQ = useApiQuery(
    ['reports', 'promotionNotReturned', businessId, promotionId],
    () => getPromotionNotReturned({ businessId: businessId!, promotionId }),
    { enabled: ready && !!businessId && !!promotionId && canSeePhones },
  );

  const promotions = reportableQ.data ?? [];
  const hasAccumulatingOnly = promotions.length === 0 && (accumulatingQ.data?.length ?? 0) > 0;
  const notReturnedRows = notReturnedQ.data ?? [];

  const notReturnedColumns: TableColumn<(typeof notReturnedRows)[number]>[] = [
    { id: 'name', header: t('promotions.notReturned.columns.name'), cell: (r) => r.clientName, mobile: 'title' },
    { id: 'phone', header: t('promotions.notReturned.columns.phone'), cell: (r) => r.clientPhone ?? '—', mobile: 'aside' },
    { id: 'email', header: t('promotions.notReturned.columns.email'), cell: (r) => r.clientEmail ?? '—', mobile: 'hidden' },
    { id: 'registered', header: t('promotions.notReturned.columns.registered'), cell: (r) => (r.registeredAt ? f.date(r.registeredAt, 'short') : '—'), mobile: 'hidden' },
    { id: 'lastVisit', header: t('promotions.notReturned.columns.lastVisit'), cell: (r) => (r.lastVisitAt ? f.date(r.lastVisitAt, 'short') : '—'), mobile: 'subtitle' },
    { id: 'paid', header: t('promotions.notReturned.columns.paid'), cell: (r) => f.money(r.paidByPromotion), align: 'right', mobile: 'meta' },
    { id: 'balance', header: t('promotions.notReturned.columns.balance'), cell: (r) => f.money(r.accountBalance), align: 'right' },
  ];

  return (
    <PermissionGate permission="reports.view" fallback="message">
      <div data-f="F-12-064 F-06-172" className="flex flex-col gap-6">
        <ReportHeader slug="promotions" crumbGroup="marketing" helpBody={t('help.promotions')} />

        {promotions.length === 0 ? (
          <EmptyState
            variant="page"
            icon={<Megaphone />}
            title={hasAccumulatingOnly ? t('promotions.accumulatingOnlyTitle') : t('promotions.emptyTitle')}
            description={hasAccumulatingOnly ? t('promotions.accumulatingOnlyText') : t('promotions.emptyText')}
            action={!hasAccumulatingOnly ? <LinkButton href="/biz/loyalty/promotions" variant="secondary">{t('promotions.goCreate')}</LinkButton> : undefined}
          />
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-full max-w-xs">
                <Select
                  aria-label={t('promotions.pick')}
                  value={promotionId}
                  onValueChange={setPromotionId}
                  options={[{ value: '', label: t('promotions.pickPlaceholder') }, ...promotions.map((p) => ({ value: p.id, label: p.name }))]}
                />
              </div>
              <DateRangePicker value={range} onValueChange={(r) => setRange({ from: r.from ?? range.from, to: r.to ?? range.to })} presets />
            </div>

            {!promotionId ? (
              <EmptyState variant="page" icon={<Megaphone />} title={t('promotions.pickPlaceholder')} description={t('promotions.pickHint')} />
            ) : dataQ.isError ? (
              <ErrorState onRetry={() => dataQ.refetch()} />
            ) : (
              <div data-f="F-12-065 F-12-066" className="flex flex-col gap-6">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <StatCard label={t('promotions.stats.new')} value={String(dataQ.data?.clients.newCount ?? 0)} loading={dataQ.isLoading} />
                  <StatCard label={t('promotions.stats.returning')} value={String(dataQ.data?.clients.returningCount ?? 0)} loading={dataQ.isLoading} />
                  <StatCard label={t('promotions.stats.cameByPromotion')} value={String(dataQ.data?.clients.cameByPromotion ?? 0)} loading={dataQ.isLoading} />
                  <StatCard label={t('promotions.stats.notReturned')} value={String(dataQ.data?.clients.notReturned ?? 0)} loading={dataQ.isLoading} />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <StatCard label={t('promotions.stats.revenue')} value={f.money(dataQ.data?.revenue ?? 0)} loading={dataQ.isLoading} />
                  <StatCard label={t('promotions.stats.repeatRevenue')} value={f.money(dataQ.data?.repeatRevenue ?? 0)} loading={dataQ.isLoading} />
                </div>

                <Table
                  columns={[
                    { id: 'staff', header: t('promotions.staffColumns.staff'), cell: (r) => r.staffName, mobile: 'title' },
                    { id: 'served', header: t('promotions.staffColumns.served'), cell: (r) => r.clientsServed, align: 'right', mobile: 'aside' },
                    { id: 'returned', header: t('promotions.staffColumns.returned'), cell: (r) => r.clientsReturned, align: 'right', mobile: 'meta' },
                  ]}
                  rows={dataQ.data?.staff ?? []}
                  rowKey={(r) => r.staffId}
                  loading={dataQ.isLoading}
                  label={t('promotions.staffColumns.staff')}
                />

                <div data-f="F-12-067" className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-fg">{t('promotions.notReturned.title')}</h3>
                    {canSeePhones && (
                      <ExportExcelButton
                        fileName="promotion-not-returned.csv"
                        type="reportBuilder"
                        rows={notReturnedRows.map((r) => [r.clientName, r.clientPhone ?? '', r.clientEmail ?? '', r.registeredAt ?? '', r.lastVisitAt ?? '', r.paidByPromotion, r.accountBalance])}
                        headers={notReturnedColumns.map((c) => String(c.header))}
                        disabled={notReturnedRows.length === 0}
                      />
                    )}
                  </div>
                  {!canSeePhones ? (
                    <p className="text-sm text-muted">{t('promotions.notReturned.needPhonesPermission')}</p>
                  ) : (
                    <Table columns={notReturnedColumns} rows={notReturnedRows} rowKey={(r) => r.clientId} loading={notReturnedQ.isLoading} label={t('promotions.notReturned.title')} />
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </PermissionGate>
  );
}
