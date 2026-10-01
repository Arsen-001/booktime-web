'use client';

/**
 * F-12-055…056: «По клиентам» — выручка, доля, средний чек, визиты по каждому клиенту; выгрузка с историей
 * визитов или без (F-12-056). F-12-117: удалённый клиент остаётся в отчёте под своим именем (1:1 с Altegio).
 */
import { Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useCoreList } from '@/api/core';
import { getClientVisitsForExport, getSalesByClients, logDataExport } from '@/api/reports';
import { useApiMutation, useApiQuery } from '@/api/request';
import { ReportHeader } from '@/areas/reports/components/ReportHeader';
import { ReportPeriodPicker } from '@/areas/reports/components/ReportPeriodPicker';
import { useReportRange } from '@/areas/reports/reportPeriod';
import { useCan, useCurrent } from '@/demo/hooks';
import type { SalesByClientRow } from '@/domain/reports';
import { EXPORT_ROW_LIMIT } from '@/domain/reports';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { downloadCsv, toCsv } from '@/lib/csv';
import { Button } from '@/ui/Button';
import { DropdownMenu } from '@/ui/DropdownMenu';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { PermissionGate } from '@/ui/PermissionGate';
import { Table, type TableColumn } from '@/ui/Table';
import { useToast } from '@/ui/Toast';

export function SalesByClientsScreen() {
  const t = useT('reports');
  const f = useFormat();
  const { businessId, activeLocationIds, ready, staffId } = useCurrent();
  const canSeePhones = useCan('clients.phones');
  const toast = useToast();
  const range = useReportRange();
  const logMutation = useApiMutation(logDataExport);
  const staffQ = useCoreList('staff', { businessId: businessId ?? '' }, { enabled: Boolean(businessId) });
  const staffName = staffQ.data?.find((s) => s.id === staffId)?.name ?? '—';

  const q = useApiQuery(
    ['reports', 'salesByClients', businessId, activeLocationIds, range],
    () => getSalesByClients({ businessId: businessId!, locationIds: activeLocationIds, range }),
    { enabled: ready && !!businessId, keepPrevious: true },
  );

  const rows = q.data?.rows ?? [];

  const columns: TableColumn<SalesByClientRow>[] = useMemo(
    () => [
      { id: 'client', header: t('salesByClients.columns.client'), cell: (r) => <span data-f="F-12-117">{r.clientName}</span>, mobile: 'title' },
      { id: 'phone', header: t('salesByClients.columns.phone'), cell: (r) => (canSeePhones ? (r.clientPhone ?? '—') : r.clientPhone ? '•••' : '—'), mobile: 'meta' },
      { id: 'email', header: t('salesByClients.columns.email'), cell: (r) => r.clientEmail ?? '—', mobile: 'hidden' },
      { id: 'revenue', header: t('salesByClients.columns.revenue'), cell: (r) => f.money(r.revenue), align: 'right', sortable: true, sortValue: (r) => r.revenue, mobile: 'aside' },
      { id: 'share', header: t('salesByClients.columns.share'), cell: (r) => `${r.revenueSharePct}%`, align: 'right' },
      { id: 'avgReceipt', header: t('salesByClients.columns.avgReceipt'), cell: (r) => f.money(r.avgReceipt), align: 'right' },
      { id: 'visits', header: t('salesByClients.columns.visits'), cell: (r) => r.visits, align: 'right' },
    ],
    [t, f, canSeePhones],
  );

  const exportWith = async (withHistory: boolean) => {
    if (!businessId || !staffId) return;
    let csv: string;
    if (!withHistory) {
      csv = toCsv(
        rows.map((r) => [r.clientName, r.clientPhone ?? '', r.clientEmail ?? '', r.revenue, r.revenueSharePct, r.avgReceipt, r.visits]),
        [t('salesByClients.columns.client'), t('salesByClients.columns.phone'), t('salesByClients.columns.email'), t('salesByClients.columns.revenue'), t('salesByClients.columns.share'), t('salesByClients.columns.avgReceipt'), t('salesByClients.columns.visits')],
      );
    } else {
      const lines: (string | number)[][] = [];
      for (const r of rows) {
        const visits = await getClientVisitsForExport({ businessId, clientId: r.clientId, range });
        if (visits.length === 0) lines.push([r.clientName, '', '', '', r.revenue]);
        for (const v of visits) lines.push([r.clientName, v.date, v.services, v.staffName, v.amount]);
      }
      csv = toCsv(lines, [t('salesByClients.columns.client'), t('cashDay.columns.time'), t('salesByServices.columns.service'), t('salesByStaff.columns.staff'), t('salesByClients.columns.revenue')]);
    }
    const fileName = withHistory ? 'sales-by-clients-with-visits.csv' : 'sales-by-clients.csv';
    downloadCsv(fileName, csv);
    await logMutation.mutate({ businessId, staffId, staffName, type: 'reportBuilder', operation: 'browserDownload', fileName, rowCount: rows.length });
    toast.success(rows.length > EXPORT_ROW_LIMIT ? t('export.exportedPartial', { limit: EXPORT_ROW_LIMIT }) : t('export.exported'));
  };

  return (
    <PermissionGate permission="reports.view" fallback="message">
      <div data-f="F-12-055 F-08-108" className="flex flex-col gap-6">
        <div data-f="F-12-056" className="contents">
          <ReportHeader
            slug="salesByClients"
            crumbGroup="sales"
            helpBody={t('help.salesByClients')}
            actions={
              <DropdownMenu
                trigger={(p) => (
                  <Button {...p} variant="secondary" disabled={rows.length === 0}>
                    {t('export.button')}
                  </Button>
                )}
                items={[
                  { id: 'plain', label: t('salesByClients.exportPlain'), onSelect: () => void exportWith(false) },
                  { id: 'withHistory', label: t('salesByClients.exportWithHistory'), onSelect: () => void exportWith(true) },
                ]}
                label={t('export.button')}
              />
            }
          />
        </div>

        <ReportPeriodPicker />

        {q.isError ? (
          <ErrorState onRetry={() => q.refetch()} />
        ) : !q.isLoading && rows.length === 0 ? (
          <EmptyState variant="page" icon={<Users />} title={t('salesByClients.emptyTitle')} description={t('salesByClients.emptyText')} />
        ) : (
          <>
            <Table columns={columns} rows={rows} rowKey={(r) => r.clientId} loading={q.isLoading} label={t('catalog.items.salesByClients.title')} />
            <p className="text-sm text-muted">{t('salesByClients.grandTotal', { value: f.money(q.data?.grandRevenue ?? 0) })}</p>
          </>
        )}
      </div>
    </PermissionGate>
  );
}
