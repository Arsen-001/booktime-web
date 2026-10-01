'use client';

/**
 * F-12-033…039: отчёт «Записи» — все записи периода, любого источника и статуса, включая мягко удалённые
 * (F-01-119), с фильтрами, правкой, массовым удалением и выгрузкой/загрузкой Excel (здесь — CSV, F-12-037).
 * F-12-004: единая механика «фильтры → Показать → таблица с итогами», счётчик «Найдено N», выбор строк на
 * странице, пустое состояние. F-12-085/086: глубина истории и телефоны — из прав раздела (useReportsPermissions).
 */
import { FileDown, FileUp, ListChecks, Pencil, Trash2 } from 'lucide-react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense, useLayoutEffect, useMemo, useState } from 'react';
import { bulkDeleteAppointments, listAppointmentsReport, logAppointmentsExport } from '@/api/reports';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useCoreList } from '@/api/core';
import { ImportAppointmentsSheet } from '@/areas/reports/ImportAppointmentsSheet';
import { ReportHeader } from '@/areas/reports/components/ReportHeader';
import { useReportsPermissions } from '@/areas/reports/useReportsPermissions';
import { useCan, useCurrent } from '@/demo/hooks';
import type { AppointmentCancelledFilter, AppointmentPageSize, AppointmentRow, AppointmentServicesFilter, AppointmentSourceFilter, AppointmentsFilters } from '@/domain/reports';
import { EXPORT_ROW_LIMIT, formatClientNameForReports } from '@/domain/reports';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { downloadCsv, toCsv } from '@/lib/csv';
import { addDays, today } from '@/lib/date';
import type { DateRange } from '@/ui/Calendar';
import { BookingStatusBadge, useBookingStatusLabel } from '@/ui/BookingStatusBadge';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import { DateRangePicker } from '@/ui/DateRangePicker';
import { DropdownMenu } from '@/ui/DropdownMenu';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { IconButton } from '@/ui/IconButton';
import { PermissionGate } from '@/ui/PermissionGate';
import { Select } from '@/ui/Select';
import { DEFAULT_PAGE_SIZE } from '@/ui/Pagination';
import { SkeletonText } from '@/ui/Skeleton';
import { Table, type TableColumn } from '@/ui/Table';
import { Tooltip } from '@/ui/Tooltip';
import { useToast } from '@/ui/Toast';

const CANCELLED_VALUES: AppointmentCancelledFilter[] = ['all', 'cancelled', 'notCancelled'];
const SOURCE_VALUES: AppointmentSourceFilter[] = ['all', 'online', 'offline'];
const SERVICES_VALUES: AppointmentServicesFilter[] = ['all', 'with', 'without'];
const STATUS_VALUES = ['awaiting_confirmation', 'awaiting_prepayment', 'scheduled', 'client_confirmed', 'arrived', 'no_show', 'cancelled_by_client', 'cancelled_by_master'] as const;

/** Отч10: по умолчанию 30 дней, как у остальных отчётов (было — год по дате создания) */
function defaultFilters(): AppointmentsFilters {
  return { createdFrom: addDays(today(), -29), createdTo: today(), cancelled: 'all', source: 'all', hasServices: 'all', pageSize: 25 };
}

/** С начала времён по сегодня: переход с плитки ищет по дате ВИЗИТА, дата создания не должна резать список */
const CREATED_ANY_FROM = '2000-01-01';

/**
 * Отч9: переход «от цифры к списку» — плитки «Записи / Завершенные / Не пришёл / Отмененные» в «Основных
 * показателях» открывают этот отчёт с датой визита и статусом (?visitFrom&visitTo&status|cancelled&staff).
 * Применяем в фильтры и сразу в «Показать», потом убираем из адреса. Свой Suspense — useSearchParams.
 */
function AppointmentsUrlFilters({ onApply }: { onApply: (f: AppointmentsFilters) => void }) {
  const params = useSearchParams();
  const pathname = usePathname();
  const visitFrom = params.get('visitFrom');
  const visitTo = params.get('visitTo');
  const status = params.get('status');
  const cancelled = params.get('cancelled');
  const staff = params.get('staff');
  useLayoutEffect(() => {
    if (!visitFrom && !visitTo && !status && !cancelled && !staff) return;
    onApply({
      ...defaultFilters(),
      ...(visitFrom || visitTo ? { createdFrom: CREATED_ANY_FROM, visitFrom: visitFrom ?? undefined, visitTo: visitTo ?? undefined } : {}),
      ...(status && (STATUS_VALUES as readonly string[]).includes(status) ? { status } : {}),
      ...(cancelled && (CANCELLED_VALUES as readonly string[]).includes(cancelled) ? { cancelled: cancelled as AppointmentCancelledFilter } : {}),
      ...(staff ? { staffId: staff } : {}),
    });
    window.history.replaceState(window.history.state, '', pathname);
  }, [visitFrom, visitTo, status, cancelled, staff, pathname]);
  return null;
}

export function AppointmentsScreen() {
  const t = useT('reports');
  const f = useFormat();
  const toast = useToast();
  const { businessId, activeLocationIds, ready } = useCurrent();
  const perms = useReportsPermissions();
  const canDeleteBooking = useCan('journal.edit');
  const statusLabel = useBookingStatusLabel();
  const [filters, setFilters] = useState<AppointmentsFilters>(defaultFilters());
  const [applied, setApplied] = useState<AppointmentsFilters>(defaultFilters());
  const [selected, setSelected] = useState<string[]>([]);
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const staffQ = useCoreList('staff', { businessId: businessId ?? '' }, { enabled: Boolean(businessId) });

  const q = useApiQuery(
    ['reports', 'appointments', businessId, activeLocationIds, applied, perms.recordsDepth],
    () => listAppointmentsReport({ businessId: businessId!, locationIds: activeLocationIds, filters: applied, canSeePhones: perms.recordsPhones, historyDepth: perms.recordsDepth, page: 0 }),
    { enabled: ready && !!businessId && perms.recordsView, keepPrevious: true },
  );
  const deleteMutation = useApiMutation((ids: string[]) => bulkDeleteAppointments(ids));

  const rows = q.data?.rows ?? [];
  const total = q.data?.total ?? 0;

  const columns: TableColumn<AppointmentRow>[] = useMemo(
    () => [
      {
        id: 'staff',
        header: t('appointments.columns.staff'),
        cell: (r) => (
          <span className="flex flex-col">
            <span className="truncate font-medium text-fg">{r.staffName}</span>
            {r.staffFired && <span className="text-xs text-muted">{t('appointments.staffFired')}</span>}
          </span>
        ),
        mobile: 'title',
        width: '10rem',
        skeletonWidth: '13ch',
        // Ширина колонки не растёт под длинный текст — он обрезается (скелетон и данные одной ширины)
        className: 'max-w-0',
      },
      {
        id: 'services',
        header: t('appointments.columns.services'),
        cell: (r) => <span className="line-clamp-1">{r.servicesLabel}</span>,
        mobile: 'subtitle',
        width: '11.5rem',
        className: 'max-w-0',
        skeletonWidth: '15ch',
      },
      {
        id: 'client',
        header: t('appointments.columns.client'),
        cell: (r) => (
          <span className="flex flex-col">
            <span data-f="F-12-116" className="truncate text-fg">
              {formatClientNameForReports(r.clientName, perms.recordsPhones)}
            </span>
            <span className="text-xs text-muted">{r.clientPhone ?? '—'}</span>
          </span>
        ),
        // Две строки (имя и телефон) — скелетон тоже в две, строка таблицы той же высоты
        skeleton: (
          <span className="flex flex-col">
            <span className="text-fg">
              <SkeletonText width="12ch" />
            </span>
            <span className="text-xs text-muted">
              <SkeletonText width="13ch" />
            </span>
          </span>
        ),
        mobile: 'aside',
        width: '10rem',
        className: 'max-w-0',
      },
      {
        id: 'visit',
        header: t('appointments.columns.visit'),
        cell: (r) => <span className="whitespace-nowrap">{`${f.date(r.visitStart, 'short')} ${f.time(r.visitStart)}`}</span>,
        mobile: 'meta',
        width: '10rem',
        skeletonWidth: '12ch',
      },
      {
        id: 'created',
        header: t('appointments.columns.created'),
        cell: (r) => (
          <span className="flex flex-col">
            <span className="truncate text-fg">{r.createdByLabel === 'client' ? t('appointments.createdByClient') : r.createdByLabel}</span>
            <span className="text-xs text-muted">{`${f.date(r.createdAt, 'short')} ${f.time(r.createdAt)}`}</span>
          </span>
        ),
        skeleton: (
          <span className="flex flex-col">
            <span className="text-fg">
              <SkeletonText width="10ch" />
            </span>
            <span className="text-xs text-muted">
              <SkeletonText width="12ch" />
            </span>
          </span>
        ),
        mobile: 'hidden',
        width: '9rem',
        className: 'max-w-0',
      },
      {
        id: 'status',
        header: t('appointments.columns.status'),
        cell: (r) =>
          r.deleted ? (
            <Tooltip content={`${t('appointments.deletedBy')}${t('appointments.deletedAt', { at: `${f.date(r.deletedAt!, 'short')} ${f.time(r.deletedAt!)}` })}`}>
              <span data-f="F-12-034" className="text-sm font-medium text-danger">
                {t('appointments.statusDeleted')}
              </span>
            </Tooltip>
          ) : (
            <BookingStatusBadge status={r.status as never} />
          ),
        mobile: 'meta',
        // Самая длинная метка («Клиент подтвердил» со значком) — 180 px: колонка под неё
        width: '13.25rem',
        skeleton: (
          <Badge tone="neutral" size="md">
            <SkeletonText width="12ch" />
          </Badge>
        ),
      },
      {
        id: 'source',
        header: t('appointments.columns.source'),
        cell: (r) => <span className="block truncate">{t(`appointments.source.${r.sourceLabel}` as never)}</span>,
        mobile: 'hidden',
        width: '8rem',
        skeletonWidth: '9ch',
        className: 'max-w-0',
      },
      {
        id: 'edit',
        header: '',
        cell: (r) => (r.canEdit && canDeleteBooking ? <IconButton icon={<Pencil />} label={t('appointments.edit')} variant="ghost" /> : null),
        align: 'right',
        mobile: 'hidden',
        width: '4.5rem',
        skeleton: <span className="inline-block size-10 align-middle" />,
      },
    ],
    [t, f, canDeleteBooking, perms.recordsPhones],
  );

  const onShow = () => {
    setApplied(filters);
    setSelected([]);
  };

  const exportCsv = async () => {
    if (!businessId) return;
    const withLimit = rows.slice(0, EXPORT_ROW_LIMIT);
    const csv = toCsv(
      withLimit.map((r) => [r.staffName, r.servicesLabel, formatClientNameForReports(r.clientName, perms.recordsPhones) ?? '', r.clientPhone ?? '', `${f.date(r.visitStart, 'short')} ${f.time(r.visitStart)}`, r.createdByLabel, r.status, r.sourceLabel]),
      [t('appointments.columns.staff'), t('appointments.columns.services'), t('appointments.columns.client'), t('appointments.columns.phone'), t('appointments.columns.visit'), t('appointments.columns.created'), t('appointments.columns.status'), t('appointments.columns.source')],
    );
    downloadCsv('appointments.csv', csv);
    await logAppointmentsExport(businessId, withLimit.length, 'appointments.csv');
    toast.success(total > EXPORT_ROW_LIMIT ? t('export.exportedPartial', { limit: EXPORT_ROW_LIMIT }) : t('export.exported'));
  };

  const onBulkDelete = async () => {
    try {
      await deleteMutation.mutate(selected);
      toast.success(t('appointments.bulkDeleted', { n: selected.length }));
      setSelected([]);
      q.refetch();
    } catch {
      toast.error(t('appointments.bulkDeleteFailed'));
    }
  };

  if (!perms.recordsView) return <ErrorState title={t('appointments.noAccess')} />;

  return (
    <PermissionGate permission="reports.view" fallback="message">
      <Suspense fallback={null}>
        <AppointmentsUrlFilters
          onApply={(next) => {
            setFilters(next);
            setApplied(next);
            setSelected([]);
          }}
        />
      </Suspense>
      <div data-f="F-12-033 F-12-039 F-12-085" className="flex flex-col gap-6">
        <ReportHeader
          slug="appointments"
          helpBody={t('help.appointments')}
          actions={
            <div data-f="F-12-036" className="contents">
            <DropdownMenu
              trigger={(p) => (
                <Button {...p} variant="secondary" size="sm">
                  {t('appointments.excelOps')}
                </Button>
              )}
              items={[
                ...(perms.recordsExport ? [{ id: 'export', label: t('appointments.exportExcel'), icon: <FileDown aria-hidden />, onSelect: () => void exportCsv() }] : []),
                { id: 'import', label: t('appointments.importExcel'), icon: <FileUp aria-hidden />, onSelect: () => setImportOpen(true) },
              ]}
              label={t('appointments.excelOps')}
            />
            </div>
          }
        />

        <div data-f="F-12-004" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted">{t('appointments.filterCreated')}</span>
              <DateRangePicker value={{ from: filters.createdFrom, to: filters.createdTo }} onValueChange={(r: DateRange) => setFilters((s) => ({ ...s, createdFrom: r.from ?? s.createdFrom, createdTo: r.to ?? s.createdTo }))} presets />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted">{t('appointments.filterVisit')}</span>
              <DateRangePicker value={{ from: filters.visitFrom, to: filters.visitTo }} onValueChange={(r: DateRange) => setFilters((s) => ({ ...s, visitFrom: r.from, visitTo: r.to }))} presets />
            </div>
            <div className="w-full max-w-xs">
              <Select
                aria-label={t('appointments.filterStaff')}
                value={filters.staffId ?? ''}
                onValueChange={(v) => setFilters((s) => ({ ...s, staffId: v || undefined }))}
                options={[{ value: '', label: t('appointments.allStaff') }, ...(staffQ.data ?? []).map((s) => ({ value: s.id, label: s.name }))]}
              />
            </div>
            <div className="w-full max-w-xs">
              <Select
                aria-label={t('appointments.filterCancelled')}
                value={filters.cancelled}
                onValueChange={(v) => setFilters((s) => ({ ...s, cancelled: v as AppointmentCancelledFilter }))}
                options={CANCELLED_VALUES.map((v) => ({ value: v, label: t(`appointments.cancelled.${v}`) }))}
              />
            </div>
            <div className="w-full max-w-xs">
              <Select
                aria-label={t('appointments.filterStatus')}
                value={filters.status ?? ''}
                onValueChange={(v) => setFilters((s) => ({ ...s, status: v || undefined }))}
                options={[{ value: '', label: t('appointments.allStatuses') }, ...STATUS_VALUES.map((v) => ({ value: v, label: statusLabel(v) }))]}
              />
            </div>
            <div className="w-full max-w-xs">
              <Select
                aria-label={t('appointments.filterSource')}
                value={filters.source}
                onValueChange={(v) => setFilters((s) => ({ ...s, source: v as AppointmentSourceFilter }))}
                options={SOURCE_VALUES.map((v) => ({ value: v, label: t(`appointments.sourceFilter.${v}`) }))}
              />
            </div>
            <div className="w-full max-w-xs">
              <Select
                aria-label={t('appointments.filterServices')}
                value={filters.hasServices}
                onValueChange={(v) => setFilters((s) => ({ ...s, hasServices: v as AppointmentServicesFilter }))}
                options={SERVICES_VALUES.map((v) => ({ value: v, label: t(`appointments.servicesFilter.${v}`) }))}
              />
            </div>
            <div className="w-full max-w-40">
              <Select
                aria-label={t('appointments.filterPageSize')}
                value={String(filters.pageSize)}
                onValueChange={(v) => setFilters((s) => ({ ...s, pageSize: Number(v) as AppointmentPageSize }))}
                options={[25, 50, 100].map((n) => ({ value: String(n), label: t('appointments.pageSizeOption', { n }) }))}
              />
            </div>
            <Button onClick={onShow}>{t('appointments.show')}</Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">{q.isLoading ? <SkeletonText width="12ch" /> : t('appointments.found', { n: total })}</p>
          {selected.length > 0 && canDeleteBooking && (
            <Button variant="danger" size="sm" leftIcon={<Trash2 aria-hidden />} onClick={() => setConfirmBulk(true)} data-f="F-12-035">
              {t('appointments.deleteSelected', { n: selected.length })}
            </Button>
          )}
        </div>

        {q.isError ? (
          <ErrorState onRetry={() => q.refetch()} />
        ) : !q.isLoading && rows.length === 0 ? (
          <EmptyState variant="page" icon={<ListChecks />} title={t('appointments.emptyTitle')} description={t('appointments.emptyText')} />
        ) : (
          <>
            <Table
              columns={columns}
              rows={rows}
              rowKey={(r) => r.id}
              loading={q.isLoading}
              loadingRows={DEFAULT_PAGE_SIZE}
              label={t('catalog.items.appointments.title')}
              selectable={canDeleteBooking}
              selected={selected}
              onSelectedChange={setSelected}
            />
            <p className="text-xs text-muted">{q.isLoading ? <SkeletonText width="16ch" /> : t('appointments.shownRange', { from: rows.length > 0 ? 1 : 0, to: rows.length, total })}</p>
          </>
        )}
      </div>

      <ConfirmDialog
        open={confirmBulk}
        onOpenChange={setConfirmBulk}
        title={t('appointments.confirmBulkTitle', { n: selected.length })}
        description={t('appointments.confirmBulkText')}
        tone="danger"
        confirmLabel={t('appointments.deleteSelected', { n: selected.length })}
        onConfirm={onBulkDelete}
      />

      <ImportAppointmentsSheet open={importOpen} onOpenChange={setImportOpen} onImported={() => q.refetch()} />
    </PermissionGate>
  );
}
