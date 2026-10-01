'use client';

/**
 * F-12-040: «События» — групповые записи с наполняемостью и оплатами; отменённое (у нас — cancelled)
 * событие остаётся розовой строкой в отчёте, а не пропадает (F-16-104: «Удалить выбранные» = та же
 * отмена по нескольким id, строки остаются в отчёте отмеченными, не пропадают).
 * F-16-105: право «События» — отдельная галочка группы «Отчёты» (`ReportsStaffPermissions.events`,
 * см. `useReportsPermissions`); без неё отчёт не открывается. Период истории — общий с «Записями»
 * (`recordsDepth`, по решению ТЗ «действует одинаково на «Записи» и «События»»).
 */
import { CalendarDays, Lock, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { updateGroupEvent } from '@/api/core';
import { getEventsReport } from '@/api/reports';
import { useApiMutation, useApiQuery } from '@/api/request';
import { ExportExcelButton } from '@/areas/reports/components/ExportExcelButton';
import { ReportHeader } from '@/areas/reports/components/ReportHeader';
import { ReportPeriodPicker } from '@/areas/reports/components/ReportPeriodPicker';
import { useReportRange } from '@/areas/reports/reportPeriod';
import { useReportsPermissions } from '@/areas/reports/useReportsPermissions';
import { useCan, useCurrent } from '@/demo/hooks';
import type { EventRow } from '@/domain/reports';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { addDays, today } from '@/lib/date';
import { cn } from '@/lib/cn';
import { useRouter } from 'next/navigation';
import type { DateRange } from '@/ui/Calendar';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { PermissionGate } from '@/ui/PermissionGate';
import { Select } from '@/ui/Select';
import { Skeleton, SkeletonText } from '@/ui/Skeleton';
import { StatCard } from '@/ui/StatCard';
import { Table, type TableColumn } from '@/ui/Table';
import { useConfirm, useToast } from '@/ui/Toast';

export function EventsScreen() {
  const t = useT('reports');
  const tUi = useT('ui');
  const f = useFormat();
  const toast = useToast();
  const confirm = useConfirm();
  const canManage = useCan('resources.manage');
  const { businessId, activeLocationIds, ready } = useCurrent();
  const perms = useReportsPermissions();
  const router = useRouter();
  const range = useReportRange();
  const [selected, setSelected] = useState<string[]>([]);
  // F-16-103: фильтры по сотруднику и услуге — по значениям, уже пришедшим в отчёт (без похода за
  // отдельным справочником, которого у этого отчёта не было); «Показать» тут не нужна — список короткий,
  // фильтруется сразу.
  const [staffFilter, setStaffFilter] = useState('all');
  const [serviceFilter, setServiceFilter] = useState('all');

  // F-16-105: ограничение периода истории («1 день … 6 месяцев, без ограничений») — общее с отчётом
  // «Записи» (`recordsDepth`); дальше в прошлое выбранной даты запрос не уходит.
  const minAllowedFrom = perms.recordsDepth === 'all' || perms.recordsDepth === 'none' ? undefined : addDays(today(), -perms.recordsDepth);
  const effectiveRange: Required<DateRange> = minAllowedFrom && range.from < minAllowedFrom ? { from: minAllowedFrom, to: range.to } : range;
  const clampedByHistory = Boolean(minAllowedFrom) && range.from < (minAllowedFrom as string);

  const q = useApiQuery(
    ['reports', 'events', businessId, activeLocationIds, effectiveRange],
    () => getEventsReport({ businessId: businessId!, locationIds: activeLocationIds, range: effectiveRange }),
    { enabled: ready && !!businessId && perms.events && perms.recordsDepth !== 'none', keepPrevious: true },
  );

  const allRows = q.data?.rows ?? [];
  const staffNames = Array.from(new Set(allRows.map((r) => r.staffName))).sort();
  const serviceNames = Array.from(new Set(allRows.map((r) => r.serviceName))).sort();
  const rows = allRows.filter(
    (r) => (staffFilter === 'all' || r.staffName === staffFilter) && (serviceFilter === 'all' || r.serviceName === serviceFilter),
  );

  // F-01-200: «несколько событий удаляются галочками одной кнопкой» — та же отмена, что в окне
  // события (updateGroupEvent → status: 'cancelled'), просто по нескольким id сразу.
  const bulkDelete = useApiMutation(async (ids: string[]) => {
    for (const id of ids) await updateGroupEvent(id, { status: 'cancelled' });
  });
  const runBulkDelete = async () => {
    const ok = await confirm({
      title: t('events.bulkDeleteConfirmTitle', { count: selected.length }),
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await bulkDelete.mutate(selected);
      toast.success(t('events.bulkDeleted', { count: selected.length }));
      setSelected([]);
      q.refetch();
    } catch {
      toast.error(t('events.bulkDeleteFailed'));
    }
  };

  const columns: TableColumn<EventRow>[] = useMemo(
    () => [
      {
        id: 'staff',
        header: t('events.columns.staff'),
        cell: (r) => (
          <button
            type="button"
            data-f="F-16-103"
            className={cn('text-left underline-offset-2 hover:underline', r.cancelled && 'text-error')}
            onClick={() => router.push(`/biz/groups?event=${r.groupEventId}`)}
          >
            {r.staffName} · {r.serviceName}
          </button>
        ),
        mobile: 'title',
        width: '20rem',
        skeletonWidth: '24ch',
      },
      { id: 'date', header: t('events.columns.date'), cell: (r) => `${f.date(r.date)} ${r.time}`, mobile: 'subtitle', width: '10rem', skeletonWidth: '13ch' },
      { id: 'capacity', header: t('events.columns.capacity'), cell: (r) => r.capacity, align: 'right', width: '7rem', skeletonWidth: '2ch' },
      { id: 'bookings', header: t('events.columns.bookings'), cell: (r) => r.bookingsCount, align: 'right', width: '7rem', skeletonWidth: '2ch' },
      { id: 'arrived', header: t('events.columns.arrived'), cell: (r) => r.arrivedCount, align: 'right', width: '7rem', skeletonWidth: '2ch' },
      { id: 'paid', header: t('events.columns.paid'), cell: (r) => `${r.paidCount} · ${f.money(r.paidAmount)}`, align: 'right', width: '9rem', skeletonWidth: '10ch' },
    ],
    [t, f, router],
  );

  const exportRows = rows.map((r) => [r.staffName, r.serviceName, r.date, r.time, r.capacity, r.bookingsCount, r.arrivedCount, r.paidCount, r.paidAmount, r.cancelled ? t('events.cancelled') : '']);

  if (ready && !perms.events) {
    return (
      <div data-f="F-16-105" role="note" className="flex items-start gap-3 rounded-lg border border-border bg-surface-2 p-4 text-sm text-muted">
        <Lock aria-hidden className="mt-0.5 size-4 shrink-0" />
        <div>
          <p className="font-medium text-fg">{tUi('permission.denied')}</p>
          <p>{tUi('permission.deniedHint')}</p>
        </div>
      </div>
    );
  }

  return (
    <PermissionGate permission="reports.view" fallback="message">
      <div data-f="F-12-040 F-01-200 F-16-102 F-16-105" className="flex flex-col gap-6">
        <ReportHeader
          slug="events"
          crumbGroup="attendance"
          helpBody={t('help.events')}
          actions={
            <ExportExcelButton
              fileName="events.csv"
              type="reportBuilder"
              rows={exportRows}
              headers={[
                t('events.columns.staff'),
                t('events.columns.service'),
                t('events.columns.date'),
                t('events.time'),
                t('events.columns.capacity'),
                t('events.columns.bookings'),
                t('events.columns.arrived'),
                t('events.columns.paid'),
                t('events.paidAmount'),
                t('events.status'),
              ]}
              disabled={rows.length === 0}
            />
          }
        />

        <ReportPeriodPicker />

        <div data-f="F-16-103" className="flex flex-wrap gap-2">
          <Select
            aria-label={t('events.filters.staffLabel')}
            size="sm"
            className="w-auto min-w-40"
            value={staffFilter}
            onValueChange={setStaffFilter}
            options={[{ value: 'all', label: t('events.filters.staffAll') }, ...staffNames.map((n) => ({ value: n, label: n }))]}
          />
          <Select
            aria-label={t('events.filters.serviceLabel')}
            size="sm"
            className="w-auto min-w-40"
            value={serviceFilter}
            onValueChange={setServiceFilter}
            options={[{ value: 'all', label: t('events.filters.serviceAll') }, ...serviceNames.map((n) => ({ value: n, label: n }))]}
          />
        </div>

        {q.isError ? (
          <ErrorState onRetry={() => q.refetch()} />
        ) : q.isLoading ? (
          // В демо групповых событий обычно нет — скелетон в форме пустого состояния (значок, заголовок, текст в две строки),
          // без «подъёма» при появлении: приехали данные — на том же месте встаёт настоящее пустое состояние
          <EmptyState
            variant="page"
            icon={<CalendarDays />}
            title={<SkeletonText width="24ch" />}
            description={<Skeleton lines={2} />}
            className="animate-none!"
          />
        ) : rows.length === 0 ? (
          <EmptyState variant="page" icon={<CalendarDays />} title={t('events.emptyTitle')} description={t('events.emptyText')} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label={t('events.bookedPct')} value={`${q.data?.totals.bookedPct ?? 0}%`} loading={q.isLoading} />
              <StatCard label={t('events.arrivedPct')} value={`${q.data?.totals.arrivedPct ?? 0}%`} loading={q.isLoading} />
              <StatCard label={t('events.paidPct')} value={`${q.data?.totals.paidPct ?? 0}%`} loading={q.isLoading} />
              <StatCard label={t('events.avgFillPct')} value={`${q.data?.totals.avgFillPct ?? 0}%`} loading={q.isLoading} />
            </div>
            {canManage && selected.length > 0 && (
              <div data-f="F-16-104" className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2">
                <span className="text-sm text-muted">{t('events.selectedCount', { count: selected.length })}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-danger"
                  leftIcon={<Trash2 aria-hidden className="size-4" />}
                  loading={bulkDelete.isPending}
                  onClick={runBulkDelete}
                >
                  {t('events.bulkDeleteAction')}
                </Button>
              </div>
            )}
            <Table
              columns={columns}
              rows={rows}
              rowKey={(r) => r.groupEventId}
              loading={q.isLoading}
              label={t('catalog.items.events.title')}
              selectable={canManage}
              selected={selected}
              onSelectedChange={setSelected}
            />
            <p className="text-xs text-muted">{t('events.cancelledHint')}</p>
          </>
        )}
      </div>
    </PermissionGate>
  );
}
