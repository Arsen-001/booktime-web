'use client';

/**
 * F-12-074…080: «Операции с данными» — журнал выгрузок/загрузок: кто, когда, что, каким способом.
 * F-12-075: каждый видит все выгрузки салона (⭐ F-00-040 — владелец видит журнал целиком).
 * F-12-112: «Отчет из конструктора отчетов» — тип есть в фильтре (❓ у Altegio своего конструктора не
 * нашли), у нас он появляется, только если экран когда-то выгрузит отчёт этим типом.
 */
import { Download, FileSpreadsheet } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useCoreList } from '@/api/core';
import { listDataExports } from '@/api/reports';
import { useApiQuery } from '@/api/request';
import { ReportHeader } from '@/areas/reports/components/ReportHeader';
import { useCurrent } from '@/demo/hooks';
import type { DataExportLogEntry, DataExportOperationType, DataExportType } from '@/domain/reports';
import { DATA_EXPORT_TYPES } from '@/domain/reports';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { downloadCsv, toCsv } from '@/lib/csv';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { IconButton } from '@/ui/IconButton';
import { PermissionGate } from '@/ui/PermissionGate';
import { Select } from '@/ui/Select';
import { Table, type TableColumn } from '@/ui/Table';

const OPERATIONS: DataExportOperationType[] = ['upload', 'copyFromExcel', 'emailLink', 'browserDownload'];

export function DataExportsScreen() {
  const t = useT('reports');
  const f = useFormat();
  const { businessId, ready } = useCurrent();
  const [staffId, setStaffId] = useState('');
  const [type, setType] = useState<DataExportType | ''>('');
  const [operation, setOperation] = useState<DataExportOperationType | ''>('');

  const staffQ = useCoreList('staff', { businessId: businessId ?? '' }, { enabled: Boolean(businessId) });

  const q = useApiQuery(
    ['reports', 'dataExports', businessId, staffId, type, operation],
    () => listDataExports(businessId!, { staffId: staffId || undefined, type: type || undefined, operation: operation || undefined }),
    { enabled: ready && !!businessId, keepPrevious: true },
  );

  const rows = q.data ?? [];

  const redownload = useCallback(
    (row: DataExportLogEntry) => {
      // F-12-075: файл уже отдан — мок не хранит бинарник, повторное скачивание строит заново пустую строку
      // с теми же метаданными (реальные данные того момента в моке не архивируются отдельно).
      downloadCsv(row.fileName, toCsv([[row.fileName, `${f.date(row.at, 'short')} ${f.time(row.at)}`]], [t('dataExports.columns.file'), t('dataExports.columns.at')]));
    },
    [f, t],
  );

  const columns: TableColumn<DataExportLogEntry>[] = useMemo(
    () => [
      { id: 'at', header: t('dataExports.columns.at'), cell: (r) => `${f.date(r.at, 'short')} ${f.time(r.at)}`, mobile: 'aside' },
      { id: 'staff', header: t('dataExports.columns.staff'), cell: (r) => r.staffName, mobile: 'title' },
      { id: 'type', header: t('dataExports.columns.type'), cell: (r) => t(`dataExports.type.${r.type}` as never), mobile: 'subtitle' },
      { id: 'operation', header: t('dataExports.columns.operation'), cell: (r) => t(`dataExports.operation.${r.operation}` as never), mobile: 'meta' },
      { id: 'file', header: t('dataExports.columns.file'), cell: (r) => r.fileName, mobile: 'meta' },
      { id: 'rows', header: t('dataExports.columns.rows'), cell: (r) => r.rowCount, align: 'right' },
      {
        id: 'redownload',
        header: '',
        cell: (r) => <IconButton icon={<Download />} label={t('dataExports.redownload')} variant="ghost" onClick={() => redownload(r)} />,
        align: 'right',
        mobile: 'hidden',
      },
    ],
    [t, f, redownload],
  );

  return (
    <PermissionGate permission="reports.view" fallback="message">
      <div data-f="F-12-074 F-06-174" className="flex flex-col gap-6">
        <div data-f="F-12-112" className="contents">
          <ReportHeader slug="dataExports" crumbGroup="security" helpBody={t('help.dataExports')} />
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="w-full max-w-xs">
            <Select
              aria-label={t('dataExports.filterStaff')}
              value={staffId}
              onValueChange={setStaffId}
              options={[{ value: '', label: t('dashboard.allValue') }, ...(staffQ.data ?? []).map((s) => ({ value: s.id, label: s.name }))]}
            />
          </div>
          <div className="w-full max-w-xs">
            <Select
              aria-label={t('dataExports.filterType')}
              value={type}
              onValueChange={(v) => setType(v as DataExportType | '')}
              options={[{ value: '', label: t('dashboard.allValue') }, ...DATA_EXPORT_TYPES.map((tp) => ({ value: tp, label: t(`dataExports.type.${tp}` as never) }))]}
            />
          </div>
          <div className="w-full max-w-xs">
            <Select
              aria-label={t('dataExports.filterOperation')}
              value={operation}
              onValueChange={(v) => setOperation(v as DataExportOperationType | '')}
              options={[{ value: '', label: t('dashboard.allValue') }, ...OPERATIONS.map((op) => ({ value: op, label: t(`dataExports.operation.${op}` as never) }))]}
            />
          </div>
        </div>

        <div data-f="F-12-075 F-12-078 F-12-079 F-12-080" className="contents">
          {q.isError ? (
            <ErrorState onRetry={() => q.refetch()} />
          ) : !q.isLoading && rows.length === 0 ? (
            <EmptyState variant="page" icon={<FileSpreadsheet />} title={t('dataExports.emptyTitle')} description={t('dataExports.emptyText')} />
          ) : (
            <Table columns={columns} rows={rows} rowKey={(r) => r.id} loading={q.isLoading} label={t('catalog.items.dataExports.title')} />
          )}
        </div>
      </div>
    </PermissionGate>
  );
}
