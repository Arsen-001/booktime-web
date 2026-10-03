'use client';

/**
 * /platform/prospects — «Места» (03.10.2026): все заведения Еревана, куда отдел продаж может предложить BookTime.
 * Сверху — счётчики по системам записи (они же главный фильтр, мультивыбор), строка фильтров, таблица по числу мастеров.
 * Строка открывает карточку места; из карточки — «Записать визит» (визит привязывается к месту, статус места — из визитов).
 */
import { useState } from 'react';
import { MapPinned } from 'lucide-react';
import { useProspects } from '@/areas/platform/hooks/usePlatformData';
import { BOOKING_SYSTEM_TONE, PROSPECT_TONE } from '@/areas/platform/lib/tones';
import { CheckListFilter } from '@/areas/platform/prospects/CheckListFilter';
import { ProspectsActions } from '@/areas/platform/prospects/ProspectsActions';
import { ProspectSheet } from '@/areas/platform/prospects/ProspectSheet';
import { SystemCounters } from '@/areas/platform/prospects/SystemCounters';
import { VisitSheet } from '@/areas/platform/visits/VisitSheet';
import {
  BOOKING_SYSTEMS,
  PROSPECT_CATEGORIES,
  PROSPECT_DISTRICTS,
  PROSPECT_STATUSES,
  type BookingSystem,
  type ProspectCategory,
  type ProspectDistrict,
  type ProspectListQuery,
  type ProspectRow,
  type ProspectSort,
  type ProspectStatus,
  type VisitInput,
} from '@/domain/platform';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { ExitHold } from '@/ui/ExitHold';
import { FilterBar } from '@/ui/FilterBar';
import { Input } from '@/ui/Input';
import { PageHeader } from '@/ui/PageHeader';
import { DEFAULT_PAGE_SIZE, Pagination } from '@/ui/Pagination';
import { Select } from '@/ui/Select';
import { SkeletonText } from '@/ui/Skeleton';
import { Table, type TableColumn, type TableSort } from '@/ui/Table';

const DEFAULT_SORT: TableSort = { columnId: 'staff', dir: 'desc' };

function toSort(s: TableSort | null): ProspectSort {
  if (!s) return 'staff_desc';
  return s.columnId === 'name' ? (s.dir === 'asc' ? 'name_asc' : 'name_desc') : s.dir === 'asc' ? 'staff_asc' : 'staff_desc';
}

export function ProspectsScreen() {
  const t = useT('platform');
  const tc = useT('common');
  const fmt = useFormat();
  const [systems, setSystems] = useState<BookingSystem[]>([]);
  const [category, setCategory] = useState<ProspectCategory | ''>('');
  const [district, setDistrict] = useState<ProspectDistrict | ''>('');
  const [staffMin, setStaffMin] = useState('');
  const [status, setStatus] = useState<ProspectStatus | ''>('');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<TableSort>(DEFAULT_SORT);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [openId, setOpenId] = useState<string | null>(null);
  const [visitPrefill, setVisitPrefill] = useState<Partial<VisitInput> | null>(null);

  const staffMinNum = staffMin.trim() && Number.isFinite(Number(staffMin)) ? Math.max(0, Math.round(Number(staffMin))) : undefined;
  const filter = {
    systems: systems.length ? systems : undefined,
    category: category || undefined,
    district: district || undefined,
    staffMin: staffMinNum,
    status: status || undefined,
    q: q.trim() || undefined,
  };
  const query: ProspectListQuery = { ...filter, sort: toSort(sort), page, pageSize };
  const listQ = useProspects(query);
  const data = listQ.data;
  // Любой фильтр возвращает на первую страницу
  const withReset =
    <A,>(fn: (a: A) => void) =>
    (a: A) => {
      fn(a);
      setPage(1);
    };
  const resetAll = () => {
    setSystems([]);
    setCategory('');
    setDistrict('');
    setStaffMin('');
    setStatus('');
    setQ('');
    setPage(1);
  };
  const anyFilter = Boolean(filter.systems || filter.category || filter.district || filter.staffMin !== undefined || filter.status || filter.q);

  const districtLabel = (d: ProspectDistrict) => (d === 'unknown' ? t('prospects.districtUnknown') : tc(`districts.${d}`));
  const systemLabel = (s: BookingSystem) => t(`prospects.system.${s}`);

  const columns: TableColumn<ProspectRow>[] = [
    {
      id: 'name',
      header: t('prospects.col.name'),
      mobile: 'title',
      sortable: true,
      width: '14rem',
      skeletonWidth: '16ch',
      cell: (p) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-medium text-fg">{p.name}</span>
          {p.address && <span className="truncate text-sm text-muted max-md:hidden">{p.address}</span>}
        </span>
      ),
    },
    {
      id: 'where',
      header: t('prospects.col.where'),
      mobile: 'subtitle',
      width: '12rem',
      skeletonWidth: '20ch',
      cell: (p) => <span className="block truncate text-muted">{[t(`prospects.category.${p.category}`), districtLabel(p.district)].join(' · ')}</span>,
    },
    {
      id: 'staff',
      header: t('prospects.col.staff'),
      mobile: 'meta',
      sortable: true,
      align: 'right',
      width: '6.5rem',
      skeletonWidth: '3ch',
      cell: (p) => (p.staffEstimate !== undefined ? <span className="font-medium text-fg">{p.staffEstimate}</span> : <span className="text-muted">—</span>),
    },
    {
      id: 'system',
      header: t('prospects.col.system'),
      mobile: 'meta',
      width: '11.5rem',
      cell: (p) => (
        <Badge size="sm" tone={BOOKING_SYSTEM_TONE[p.bookingSystem]}>
          {systemLabel(p.bookingSystem)}
        </Badge>
      ),
      skeleton: (
        <Badge size="sm" tone="neutral">
          <SkeletonText width="8ch" />
        </Badge>
      ),
    },
    {
      id: 'lastVisit',
      header: t('prospects.col.lastVisit'),
      mobile: 'meta',
      width: '8.5rem',
      skeletonWidth: '8ch',
      cell: (p) => <span className="whitespace-nowrap text-muted">{p.lastVisit ? fmt.relativeDay(p.lastVisit.visitedAt) : '—'}</span>,
    },
    {
      id: 'status',
      header: t('prospects.col.status'),
      mobile: 'badge',
      align: 'right',
      width: '10.5rem',
      cell: (p) => <Badge tone={PROSPECT_TONE[p.status]}>{t(`prospects.status.${p.status}`)}</Badge>,
      skeleton: (
        <Badge tone="neutral">
          <SkeletonText width="8ch" />
        </Badge>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('prospects.title')} description={t('prospects.subtitle')} actions={<ProspectsActions filter={{ ...filter, sort: toSort(sort) }} />} />

      <SystemCounters counts={data?.systemCounts} value={systems} onValueChange={withReset(setSystems)} />

      <FilterBar
        search={{ value: q, onValueChange: withReset(setQ), placeholder: t('prospects.search') }}
        onReset={resetAll}
        filters={[
          {
            id: 'system',
            label: t('prospects.filter.system'),
            node: (
              <CheckListFilter
                options={BOOKING_SYSTEMS.map((s) => ({ value: s, label: systemLabel(s) }))}
                value={systems}
                onValueChange={(v) => withReset(setSystems)(v as BookingSystem[])}
              />
            ),
          },
          {
            id: 'category',
            label: t('prospects.filter.category'),
            node: (
              <Select
                value={category}
                onValueChange={(v) => withReset(setCategory)(v as ProspectCategory | '')}
                options={[{ value: '', label: t('prospects.filter.allCategories') }, ...PROSPECT_CATEGORIES.map((c) => ({ value: c, label: t(`prospects.category.${c}`) }))]}
              />
            ),
          },
          {
            id: 'district',
            label: t('prospects.filter.district'),
            node: (
              <Select
                value={district}
                onValueChange={(v) => withReset(setDistrict)(v as ProspectDistrict | '')}
                options={[{ value: '', label: t('prospects.filter.allDistricts') }, ...PROSPECT_DISTRICTS.map((d) => ({ value: d, label: districtLabel(d) }))]}
              />
            ),
          },
          {
            id: 'staffMin',
            label: t('prospects.filter.staffMin'),
            node: (
              <Input
                inputMode="numeric"
                value={staffMin}
                onChange={(e) => withReset(setStaffMin)(e.target.value.replace(/\D/g, ''))}
                placeholder={t('prospects.filter.staffMinPlaceholder')}
              />
            ),
          },
          {
            id: 'status',
            label: t('prospects.filter.status'),
            node: (
              <Select
                value={status}
                onValueChange={(v) => withReset(setStatus)(v as ProspectStatus | '')}
                options={[{ value: '', label: t('prospects.filter.allStatuses') }, ...PROSPECT_STATUSES.map((s) => ({ value: s, label: t(`prospects.status.${s}`) }))]}
              />
            ),
          },
        ]}
      />

      {listQ.isError ? (
        <ErrorState onRetry={listQ.refetch} />
      ) : (
        <div className="flex flex-col gap-3">
          <Table
            label={t('prospects.title')}
            columns={columns}
            rows={data?.items ?? []}
            rowKey={(p) => p.id}
            loading={listQ.isLoading}
            loadingRows={8}
            sort={sort}
            onSortChange={(next) => {
              setSort(next ?? DEFAULT_SORT);
              setPage(1);
            }}
            manualSort
            onRowClick={(p) => setOpenId(p.id)}
            empty={
              anyFilter ? (
                <EmptyState kind="search" title={t('prospects.emptyFilter')} onReset={resetAll} />
              ) : (
                <EmptyState icon={<MapPinned aria-hidden />} title={t('prospects.empty')} description={t('prospects.emptyHint')} action={<ProspectsActions filter={{}} importOnly />} />
              )
            }
          />
          {(listQ.isLoading || (data?.total ?? 0) > pageSize) && (
            <Pagination
              page={page}
              pageSize={pageSize}
              total={data?.total ?? 0}
              loading={listQ.isLoading}
              onPageChange={setPage}
              onPageSizeChange={(n) => {
                setPageSize(n);
                setPage(1);
              }}
            />
          )}
        </div>
      )}

      <ExitHold value={openId}>
        {(id) => (
          <ProspectSheet
            key={id}
            id={id}
            onClose={() => setOpenId(null)}
            onRecordVisit={(prefill) => {
              setOpenId(null);
              setVisitPrefill(prefill);
            }}
          />
        )}
      </ExitHold>
      <ExitHold value={visitPrefill}>{(prefill) => <VisitSheet prefill={prefill} onClose={() => setVisitPrefill(null)} />}</ExitHold>
    </div>
  );
}
