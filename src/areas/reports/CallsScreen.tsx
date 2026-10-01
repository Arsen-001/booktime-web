'use client';

/**
 * F-12-072: отчёт «Звонки» — история звонков с записью разговора; без подключённой IP-телефонии сети —
 * честное сообщение вместо пустой таблицы (F-12-072 готово-когда).
 * F-12-073: в отчёте локации видны только звонки, разрешённые ей маршрутом сети (listNetworkCalls уже
 * фильтрует по businessId на стороне network — F-12-073 готово-когда).
 */
import { Phone, PhoneIncoming, PhoneMissed, PhoneOutgoing } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';
import { getCallsReport } from '@/api/reports';
import { useApiQuery } from '@/api/request';
import { ExportExcelButton } from '@/areas/reports/components/ExportExcelButton';
import { ReportHeader } from '@/areas/reports/components/ReportHeader';
import { useReportsPermissions } from '@/areas/reports/useReportsPermissions';
import { useCurrent } from '@/demo/hooks';
import type { CallsReportRow } from '@/domain/reports';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { PermissionGate } from '@/ui/PermissionGate';
import { Table, type TableColumn } from '@/ui/Table';

export function CallsScreen() {
  const t = useT('reports');
  const f = useFormat();
  const { businessId, networkId, ready } = useCurrent();
  const perms = useReportsPermissions();

  const q = useApiQuery(['reports', 'calls', businessId, networkId], () => getCallsReport({ businessId: businessId!, networkId }), { enabled: ready && !!businessId, keepPrevious: true });

  const rows = q.data?.rows ?? [];
  const connected = q.data?.connected ?? false;

  const columns: TableColumn<CallsReportRow>[] = useMemo(
    () => [
      { id: 'at', header: t('calls.columns.at'), cell: (r) => `${f.date(r.at, 'short')} ${f.time(r.at)}`, mobile: 'aside' },
      {
        id: 'direction',
        header: t('calls.columns.direction'),
        cell: (r) => (
          <span className="inline-flex items-center gap-1.5">
            {r.status === 'missed' ? <PhoneMissed className="size-4 text-error" aria-hidden /> : r.direction === 'in' ? <PhoneIncoming className="size-4 text-success" aria-hidden /> : <PhoneOutgoing className="size-4" aria-hidden />}
            {t(`calls.status.${r.status}` as never)}
          </span>
        ),
        mobile: 'title',
      },
      { id: 'phone', header: <span data-f="F-12-086 F-13-097">{t('calls.columns.phone')}</span>, cell: (r) => (perms.callsPhones ? r.phone : f.maskedPhone(r.phone)), mobile: 'subtitle' },
      { id: 'duration', header: t('calls.columns.duration'), cell: (r) => f.duration(Math.round(r.durationSec / 60)), align: 'right', mobile: 'meta' },
      { id: 'recording', header: t('calls.columns.recording'), cell: (r) => (r.hasRecording ? t('calls.hasRecording') : '—') },
    ],
    [t, f, perms.callsPhones],
  );

  const exportRows = rows.map((r) => [f.date(r.at, 'short'), f.time(r.at), r.direction, r.status, perms.callsPhones ? r.phone : f.maskedPhone(r.phone), r.durationSec]);

  return (
    <PermissionGate permission="reports.view" fallback="message">
      <div data-f="F-12-072 F-12-073 F-13-095" className="flex flex-col gap-6">
        <ReportHeader
          slug="calls"
          crumbGroup="marketing"
          helpBody={t('help.calls')}
          actions={
            connected && perms.callsExport ? (
              <ExportExcelButton fileName="calls.csv" type="reportBuilder" rows={exportRows} headers={[t('calls.columns.at'), 'time', t('calls.columns.direction'), 'status', t('calls.columns.phone'), t('calls.columns.duration')]} disabled={rows.length === 0} />
            ) : undefined
          }
        />

        {q.isError ? (
          <ErrorState onRetry={() => q.refetch()} />
        ) : !q.isLoading && !connected ? (
          <EmptyState
            variant="page"
            icon={<Phone />}
            title={t('calls.notConnectedTitle')}
            description={t('calls.notConnectedText')}
            action={<Link href="/biz/network/telephony" className="text-sm font-medium text-primary-text underline">{t('calls.setupLink')}</Link>}
          />
        ) : !q.isLoading && rows.length === 0 ? (
          <EmptyState variant="page" icon={<Phone />} title={t('calls.emptyTitle')} description={t('calls.emptyText')} />
        ) : (
          <Table columns={columns} rows={rows} rowKey={(r) => r.id} loading={q.isLoading} label={t('catalog.items.calls.title')} />
        )}
      </div>
    </PermissionGate>
  );
}
