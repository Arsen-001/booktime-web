'use client';

/**
 * F-12-070…071: отчёт «Сообщения» — журнал всех отправленных сообщений: тип, канал, статус, текст.
 * F-12-086: без права messagesPhones номер маскируется в колонке контакта.
 */
import { MessageSquareText } from 'lucide-react';
import { useMemo, useState } from 'react';
import { getMessagesReport, listMessageTypesInLog } from '@/api/reports';
import { useApiQuery } from '@/api/request';
import { ExportExcelButton } from '@/areas/reports/components/ExportExcelButton';
import { ReportHeader } from '@/areas/reports/components/ReportHeader';
import { useReportsPermissions } from '@/areas/reports/useReportsPermissions';
import { useCurrent } from '@/demo/hooks';
import { LOG_STATUSES, type LogChannel } from '@/domain/notify';
import type { MessagesReportRow } from '@/domain/reports';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { addDays, today } from '@/lib/date';
import type { DateRange } from '@/ui/Calendar';
import { DateRangePicker } from '@/ui/DateRangePicker';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { Input } from '@/ui/Input';
import { DEFAULT_PAGE_SIZE, Pagination } from '@/ui/Pagination';
import { PermissionGate } from '@/ui/PermissionGate';
import { Select } from '@/ui/Select';
import { Table, type TableColumn } from '@/ui/Table';

const CHANNELS: LogChannel[] = ['push', 'adminApp', 'email', 'sms', 'brandedApp', 'whatsapp', 'telegram'];

export function MessagesScreen() {
  const t = useT('reports');
  const f = useFormat();
  const { businessId, ready } = useCurrent();
  const perms = useReportsPermissions();

  const [range, setRange] = useState<Required<DateRange>>({ from: addDays(today(), -29), to: today() });
  const [typeCode, setTypeCode] = useState('');
  const [status, setStatus] = useState('');
  const [channel, setChannel] = useState('');
  const [phoneSearch, setPhoneSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const typesQ = useApiQuery(['reports', 'messageTypes', businessId], () => listMessageTypesInLog(businessId!), { enabled: ready && !!businessId, keepPrevious: true });

  const q = useApiQuery(
    ['reports', 'messages', businessId, range, typeCode, status, channel, phoneSearch, page],
    () => getMessagesReport({ businessId: businessId!, filters: { range, typeCode: typeCode || undefined, status: status || undefined, channel: channel || undefined, phoneSearch: phoneSearch || undefined, page, pageSize } }),
    { enabled: ready && !!businessId },
  );

  const items = q.data?.items ?? [];
  const total = q.data?.total ?? 0;

  const columns: TableColumn<MessagesReportRow>[] = useMemo(
    () => [
      { id: 'at', header: t('messages.columns.at'), cell: (r) => `${f.date(r.at, 'short')} ${f.time(r.at)}`, mobile: 'aside' },
      { id: 'type', header: t('messages.columns.type'), cell: (r) => r.typeLabel, mobile: 'title' },
      { id: 'channel', header: t('messages.columns.channel'), cell: (r) => t(`messages.channel.${r.channel}` as never), mobile: 'subtitle' },
      { id: 'status', header: t('messages.columns.status'), cell: (r) => t(`messages.status.${r.status}` as never), mobile: 'meta' },
      { id: 'contact', header: <span data-f="F-12-086">{t('messages.columns.contact')}</span>, cell: (r) => (perms.messagesPhones || !r.contact.match(/\d{5,}/) ? r.contact : f.maskedPhone(r.contact)) },
      { id: 'text', header: t('messages.columns.text'), cell: (r) => <span className="line-clamp-2 max-w-xs">{r.text}</span>, mobile: 'hidden' },
    ],
    [t, f, perms.messagesPhones],
  );

  return (
    <PermissionGate permission="reports.view" fallback="message">
      <div data-f="F-12-070 F-12-071 F-10-148" className="flex flex-col gap-6">
        <ReportHeader
          slug="messages"
          crumbGroup="marketing"
          helpBody={t('help.messages')}
          actions={
            perms.messagesExport ? (
              <span data-f="F-12-071 F-12-084">
                <ExportExcelButton
                  fileName="messages.csv"
                  type="reportBuilder"
                  rows={items.map((r) => [`${f.date(r.at, 'short')} ${f.time(r.at)}`, r.typeLabel, r.channel, r.status, perms.messagesPhones ? r.contact : f.maskedPhone(r.contact), r.text])}
                  headers={[t('messages.columns.at'), t('messages.columns.type'), t('messages.columns.channel'), t('messages.columns.status'), t('messages.columns.contact'), t('messages.columns.text')]}
                  disabled={items.length === 0}
                />
              </span>
            ) : undefined
          }
        />

        <div className="flex flex-wrap items-end gap-3">
          <DateRangePicker value={range} onValueChange={(r) => { setPage(1); setRange({ from: r.from ?? range.from, to: r.to ?? range.to }); }} presets />
          <div className="w-full max-w-xs">
            <Select
              aria-label={t('messages.filterType')}
              value={typeCode}
              onValueChange={(v) => { setPage(1); setTypeCode(v); }}
              options={[{ value: '', label: t('dashboard.allValue') }, ...(typesQ.data ?? []).map((tp) => ({ value: tp.code, label: tp.label }))]}
            />
          </div>
          <div className="w-full max-w-xs">
            <Select
              aria-label={t('messages.filterStatus')}
              value={status}
              onValueChange={(v) => { setPage(1); setStatus(v); }}
              options={[{ value: '', label: t('dashboard.allValue') }, ...LOG_STATUSES.map((s) => ({ value: s, label: t(`messages.status.${s}` as never) }))]}
            />
          </div>
          <div className="w-full max-w-xs">
            <Select
              aria-label={t('messages.filterChannel')}
              value={channel}
              onValueChange={(v) => { setPage(1); setChannel(v); }}
              options={[{ value: '', label: t('dashboard.allValue') }, ...CHANNELS.map((c) => ({ value: c, label: t(`messages.channel.${c}` as never) }))]}
            />
          </div>
          <Input value={phoneSearch} onChange={(e) => { setPage(1); setPhoneSearch(e.target.value); }} placeholder={t('messages.searchPhone')} className="max-w-xs" />
        </div>

        <p className="text-sm text-muted">{t('messages.found', { n: total })}</p>

        {q.isError ? (
          <ErrorState onRetry={() => q.refetch()} />
        ) : !q.isLoading && items.length === 0 ? (
          <EmptyState variant="page" icon={<MessageSquareText />} title={t('messages.emptyTitle')} description={t('messages.emptyText')} />
        ) : (
          <>
            {/* Страницы отдаёт сервер — встроенные у таблицы выключены */}
            <Table columns={columns} rows={items} rowKey={(r) => r.id} loading={q.isLoading} label={t('catalog.items.messages.title')} pagination={false} />
            {total > DEFAULT_PAGE_SIZE && (
              <Pagination
                page={page}
                pageSize={pageSize}
                total={total}
                onPageChange={setPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setPage(1);
                }}
              />
            )}
          </>
        )}
      </div>
    </PermissionGate>
  );
}
