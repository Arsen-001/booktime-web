'use client';

/**
 * F-12-019…023, F-12-026, F-12-028: «Возвращаемость клиентов» — по каждому мастеру: клиентов за период
 * (Итого/Новые/Вернувшиеся), возвращаемость (клиентов прошлого окна, из них вернулись, %).
 */
import { Users2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useCoreList } from '@/api/core';
import { getRetentionReport } from '@/api/reports';
import { useApiQuery } from '@/api/request';
import { ExportExcelButton } from '@/areas/reports/components/ExportExcelButton';
import { ReportHeader } from '@/areas/reports/components/ReportHeader';
import { ReportPeriodPicker } from '@/areas/reports/components/ReportPeriodPicker';
import { useReportRange } from '@/areas/reports/reportPeriod';
import { useCurrent } from '@/demo/hooks';
import type { RetentionRow } from '@/domain/reports';
import { useT } from '@/i18n/useT';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { PermissionGate } from '@/ui/PermissionGate';
import { Select } from '@/ui/Select';
import { Table, type TableColumn } from '@/ui/Table';

export function RetentionScreen() {
  const t = useT('reports');
  const { businessId, activeLocationIds, ready } = useCurrent();
  const range = useReportRange();
  const [serviceId, setServiceId] = useState('');

  const servicesQ = useCoreList('services', { businessId: businessId ?? '' }, { enabled: Boolean(businessId) });

  const q = useApiQuery(
    ['reports', 'retention', businessId, activeLocationIds, range, serviceId],
    () => getRetentionReport({ businessId: businessId!, locationIds: activeLocationIds, range, serviceId: serviceId || undefined }),
    { enabled: ready && !!businessId, keepPrevious: true },
  );

  const rows = q.data?.rows ?? [];

  const columns: TableColumn<RetentionRow>[] = useMemo(
    () => [
      { id: 'staff', header: t('retention.columns.staff'), cell: (r) => r.staffName, mobile: 'title' },
      {
        id: 'total',
        header: <span data-f="F-12-020">{t('retention.columns.total')}</span>,
        cell: (r) => r.total,
        align: 'right',
        sortable: true,
        sortValue: (r) => r.total,
      },
      { id: 'new', header: <span data-f="F-12-021 F-12-027">{t('retention.columns.new')}</span>, cell: (r) => `${r.newCount} (${r.newPct}%)`, align: 'right' },
      {
        id: 'returning',
        header: <span data-f="F-12-022">{t('retention.columns.returning')}</span>,
        cell: (r) => `${r.returningCount} (${r.returningPct}%)`,
        align: 'right',
      },
      {
        id: 'priorWindow',
        header: <span data-f="F-12-023 F-12-026">{t('retention.columns.priorWindow', { n: q.data?.churnDays ?? 60 })}</span>,
        cell: (r) => r.priorWindowClients,
        align: 'right',
      },
      { id: 'priorReturned', header: t('retention.columns.priorReturned'), cell: (r) => r.priorWindowReturned, align: 'right' },
      {
        id: 'retentionPct',
        header: t('retention.columns.retentionPct'),
        cell: (r) => (r.retentionPct === null ? '—' : `${r.retentionPct}%`),
        align: 'right',
        sortable: true,
        sortValue: (r) => r.retentionPct ?? -1,
      },
    ],
    [t, q.data?.churnDays],
  );

  const exportRows = rows.map((r) => [r.staffName, r.total, r.newCount, r.newPct, r.returningCount, r.returningPct, r.priorWindowClients, r.priorWindowReturned, r.retentionPct ?? '']);

  return (
    <PermissionGate permission="reports.view" fallback="message">
      <div data-f="F-12-019" className="flex flex-col gap-6">
        <div data-f="F-12-028" className="contents">
          <ReportHeader
            slug="retention"
            crumbGroup="attendance"
            helpBody={t('help.retention')}
            actions={
              <ExportExcelButton
                fileName="retention.csv"
                type="reportBuilder"
                rows={exportRows}
                headers={[
                  t('retention.columns.staff'),
                  t('retention.columns.total'),
                  t('dashboard.attendance.newClients'),
                  '%',
                  t('dashboard.attendance.returningClients'),
                  '%',
                  t('retention.columns.priorWindow', { n: q.data?.churnDays ?? 60 }),
                  t('retention.columns.priorReturned'),
                  t('retention.columns.retentionPct'),
                ]}
                disabled={rows.length === 0}
              />
            }
          />
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <ReportPeriodPicker />
          <div className="w-full max-w-xs">
            <Select
              aria-label={t('retention.filterService')}
              value={serviceId}
              onValueChange={setServiceId}
              options={[{ value: '', label: t('dashboard.allValue') }, ...(servicesQ.data ?? []).map((s) => ({ value: s.id, label: s.name.ru || s.name.en || s.id }))]}
            />
          </div>
        </div>

        {q.isError ? (
          <ErrorState onRetry={() => q.refetch()} />
        ) : !q.isLoading && rows.length === 0 ? (
          <EmptyState variant="page" icon={<Users2 />} title={t('retention.emptyTitle')} description={t('retention.emptyText')} />
        ) : (
          <>
            <Table columns={columns} rows={rows} rowKey={(r) => r.staffId} loading={q.isLoading} label={t('catalog.items.retention.title')} />
            <p className="text-sm text-muted">{t('retention.totalUnique', { n: q.data?.totalUniqueClients ?? 0 })}</p>
            {/* Отч5: «новые» здесь и на сводке — разные вещи; говорим это прямо */}
            <p className="text-xs text-muted">{t('retention.newHint')}</p>
          </>
        )}
      </div>
    </PermissionGate>
  );
}
