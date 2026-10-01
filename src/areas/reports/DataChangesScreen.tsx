'use client';

/**
 * F-12-076: «Изменения данных» — кто создал, изменил или удалил запись, финансовую или складскую операцию.
 * F-12-077: «Показать» открывает всю ленту правок объекта (⭐ «У нас» — полная история, не только
 * последнее действие как у Altegio).
 */
import { ChevronRight, History } from 'lucide-react';
import { useMemo, useState } from 'react';
import { listDataChanges } from '@/api/reports';
import { useApiQuery } from '@/api/request';
import { ReportHeader } from '@/areas/reports/components/ReportHeader';
import { useCurrent } from '@/demo/hooks';
import type { DataChangeAction, DataChangeEntity, DataChangeEntry } from '@/domain/reports';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { addDays, today } from '@/lib/date';
import type { DateRange } from '@/ui/Calendar';
import { DateRangePicker } from '@/ui/DateRangePicker';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { IconButton } from '@/ui/IconButton';
import { PermissionGate } from '@/ui/PermissionGate';
import { Select } from '@/ui/Select';
import { Sheet } from '@/ui/Sheet';
import { Table, type TableColumn } from '@/ui/Table';

const ENTITIES: DataChangeEntity[] = ['booking', 'financeOperation', 'stockOperation', 'network'];
const ACTIONS: DataChangeAction[] = ['create', 'update', 'delete', 'restore'];

export function DataChangesScreen() {
  const t = useT('reports');
  const f = useFormat();
  const { businessId, ready } = useCurrent();

  // F-12-076 (проверка 2): по умолчанию месяц назад → месяц вперёд, 25 строк на странице
  const [range, setRange] = useState<Required<DateRange>>({ from: addDays(today(), -30), to: addDays(today(), 30) });
  const [entity, setEntity] = useState('');
  const [action, setAction] = useState('');
  const [detail, setDetail] = useState<DataChangeEntry | null>(null);

  const q = useApiQuery(
    ['reports', 'dataChanges', businessId, range, entity, action],
    () => listDataChanges({ businessId: businessId!, filters: { from: range.from, to: range.to, entity: (entity || undefined) as DataChangeEntity | undefined, action: (action || undefined) as DataChangeAction | undefined } }),
    { enabled: ready && !!businessId, keepPrevious: true },
  );

  const all = q.data ?? [];

  const columns: TableColumn<DataChangeEntry>[] = useMemo(
    () => [
      { id: 'at', header: t('dataChanges.columns.at'), cell: (r) => `${f.date(r.at, 'short')} ${f.time(r.at)}`, mobile: 'aside' },
      {
        id: 'entity',
        header: t('dataChanges.columns.entity'),
        cell: (r) => (
          <span className="flex flex-col">
            <span className={r.deleted ? 'text-fg' : 'font-medium text-primary-text'}>
              {t(`dataChanges.entity.${r.entity}` as never)} {r.entityLabel ? `· ${r.entityLabel}` : ''}
            </span>
          </span>
        ),
        mobile: 'title',
      },
      { id: 'author', header: t('dataChanges.columns.author'), cell: (r) => r.authorName || t(`dataChanges.by.${r.authorName === 'client' ? 'client' : 'system'}` as never), mobile: 'subtitle' },
      { id: 'action', header: t('dataChanges.columns.action'), cell: (r) => t(`dataChanges.action.${r.action}` as never), mobile: 'meta' },
      {
        id: 'details',
        header: '',
        cell: (r) => <IconButton icon={<ChevronRight />} label={t('dataChanges.show')} variant="ghost" onClick={() => setDetail(r)} />,
        align: 'right',
        mobile: 'hidden',
      },
    ],
    [t, f],
  );

  return (
    <PermissionGate permission="reports.view" fallback="message">
      <div data-f="F-12-076 F-07-173" className="flex flex-col gap-6">
        <ReportHeader slug="dataChanges" crumbGroup="security" helpBody={t('help.dataChanges')} />

        <div className="flex flex-wrap items-end gap-3">
          <DateRangePicker value={range} onValueChange={(r) => setRange({ from: r.from ?? range.from, to: r.to ?? range.to })} presets />
          <div className="w-full max-w-xs">
            <Select aria-label={t('dataChanges.filterEntity')} value={entity} onValueChange={setEntity} options={[{ value: '', label: t('dashboard.allValue') }, ...ENTITIES.map((e) => ({ value: e, label: t(`dataChanges.entity.${e}` as never) }))]} />
          </div>
          <div className="w-full max-w-xs">
            <Select aria-label={t('dataChanges.filterAction')} value={action} onValueChange={setAction} options={[{ value: '', label: t('dashboard.allValue') }, ...ACTIONS.map((a) => ({ value: a, label: t(`dataChanges.action.${a}` as never) }))]} />
          </div>
        </div>

        <p className="text-sm text-muted">{t('dataChanges.found', { n: all.length })}</p>

        {/* Постранично — встроенный вывод Table (10 на странице, выбор 10/20/50/100 внизу); раньше «25/100» наверху
            обрезал список и прятал остальное */}
        {q.isError ? (
          <ErrorState onRetry={() => q.refetch()} />
        ) : !q.isLoading && all.length === 0 ? (
          <EmptyState variant="page" icon={<History />} title={t('dataChanges.emptyTitle')} description={t('dataChanges.emptyText')} />
        ) : (
          <Table columns={columns} rows={all} rowKey={(r) => r.id} loading={q.isLoading} label={t('catalog.items.dataChanges.title')} />
        )}
      </div>

      <Sheet open={!!detail} onOpenChange={(v) => !v && setDetail(null)} title={detail ? t(`dataChanges.entity.${detail.entity}` as never) : ''} side="right" size="md">
        <div data-f="F-12-077" className="flex flex-col gap-3">
          {detail?.history.map((h, i) => (
            <div key={i} className="flex flex-col gap-0.5 border-b border-border pb-3 last:border-0">
              <span className="text-xs text-muted">{`${f.date(h.at, 'short')} ${f.time(h.at)}`}</span>
              <span className="text-sm text-fg">{h.authorName || '—'}</span>
              <span className="text-sm text-muted">{h.summary}</span>
            </div>
          ))}
        </div>
      </Sheet>
    </PermissionGate>
  );
}
