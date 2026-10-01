'use client';

/** /platform/businesses — все салоны и мастера на платформе: как пришли, бесплатный период, копии и выгрузка (F-00-183). */
import { useState } from 'react';
import { Store } from 'lucide-react';
import { TabCountSkeleton } from '@/areas/platform/components/TabCountSkeleton';
import { BusinessSheet } from '@/areas/platform/businesses/BusinessSheet';
import { useFreeUntilText } from '@/areas/platform/businesses/useFreeUntilText';
import { useBusinessesOverview } from '@/areas/platform/hooks/usePlatformData';
import type { BusinessOverviewRow } from '@/domain/platform';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { normalizeSearch } from '@/lib/text';
import { today } from '@/lib/date';
import { Badge } from '@/ui/Badge';
import { LinkButton } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { FilterBar } from '@/ui/FilterBar';
import { PageHeader } from '@/ui/PageHeader';
import { SkeletonText } from '@/ui/Skeleton';
import { Table, type TableColumn } from '@/ui/Table';
import { Tabs } from '@/ui/Tabs';
import { ExitHold } from '@/ui/ExitHold';

type StatusTab = 'all' | BusinessOverviewRow['status'];
/** Счётчики вкладок в демо — по ним ширина скелетона счётчика */
const TYPICAL_COUNTS: Record<StatusTab, number> = { all: 15, active: 14, frozen: 0, left: 1 };
const STATUS_TABS: StatusTab[] = ['all', 'active', 'frozen', 'left'];
/** Бизнесов будут сотни: в таблице — страница, поиск и статус — по всему списку (CONVENTIONS §16.10) */

export function BusinessesScreen() {
  const t = useT('platform');
  const tc = useT('common');
  const freeText = useFreeUntilText();
  const q = useBusinessesOverview();
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusTab>('all');
  const needle = normalizeSearch(search);
  const found = (q.data ?? []).filter((r) => !needle || normalizeSearch(r.name).includes(needle));
  const countOf = (s: StatusTab) => (s === 'all' ? found.length : found.filter((r) => r.status === s).length);
  const filtered = status === 'all' ? found : found.filter((r) => r.status === status);
  const open = q.data?.find((r) => r.id === openId);
  const t0 = today();

  const columns: TableColumn<BusinessOverviewRow>[] = [
    {
      id: 'name',
      header: t('businesses.columnBusiness'),
      mobile: 'title',
      width: '24rem',
      // Те же две строки: имя и «сфера · район · мастеров»
      skeleton: (
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-medium text-fg">
            <SkeletonText width="18ch" />
          </span>
          <span className="truncate text-sm font-normal text-muted">
            <SkeletonText width="28ch" />
          </span>
        </span>
      ),
      cell: (r) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-medium text-fg">{r.name}</span>
          <span className="truncate text-sm font-normal text-muted">
            {[r.sphereIds.map((s) => tc(`spheres.${s}`)).join(', '), r.district ? tc(`districts.${r.district}`) : undefined, t('businesses.staffCount', { n: r.staffCount })].filter(Boolean).join(' · ')}
          </span>
        </span>
      ),
    },
    { id: 'source', header: t('businesses.sourceLabel'), mobile: 'meta', width: '12rem', skeletonWidth: '12ch', cell: (r) => t(`businesses.source.${r.meta?.source ?? 'self'}`) },
    {
      id: 'free',
      header: t('businesses.freeUntil'),
      mobile: 'meta',
      sortable: true,
      sortValue: (r) => r.meta?.freeUntil ?? '',
      width: '17rem',
      skeletonWidth: '22ch',
      // Одной строкой (многоточием, если не влезет): высота строки не зависит от длины срока
      cell: (r) => (r.meta?.freeUntil ? <span className={cn('block truncate', r.meta.freeUntil < t0 ? 'text-muted' : 'text-fg')}>{freeText(r.meta.freeUntil)}</span> : <span className="text-muted">—</span>),
    },
    {
      id: 'status',
      header: <span className="sr-only">{t('businesses.statusLabel')}</span>,
      mobile: 'badge',
      align: 'right',
      width: '8rem',
      // Обычно бизнес работает — плашки нет; в скелетоне её тоже нет (иначе она «исчезнет» при загрузке)
      skeleton: <></>,
      cell: (r) => (r.status === 'active' ? null : <Badge tone={r.status === 'left' ? 'danger' : 'warning'}>{t(`businesses.status.${r.status}`)}</Badge>),
    },
  ];

  return (
    <div data-f="F-00-183" className="flex flex-col gap-6">
      <PageHeader title={t('businesses.title')} description={t('businesses.subtitle')} />
      <FilterBar
        search={{
          value: search,
          onValueChange: (v) => {
            setSearch(v);
          },
          placeholder: t('businesses.search'),
        }}
      />
      <Tabs
        value={status}
        onValueChange={(v) => {
          setStatus(v as StatusTab);
        }}
        items={STATUS_TABS.map((s) => ({
          value: s,
          label: t(`businesses.statusTab.${s}`),
          badge: q.data ? <Badge size="sm" tone={s === 'frozen' && countOf(s) > 0 ? 'warning' : 'neutral'}>{countOf(s)}</Badge> : <TabCountSkeleton typical={TYPICAL_COUNTS[s]} />,
        }))}
      />
      {q.isError ? (
        <ErrorState onRetry={q.refetch} />
      ) : (
        <Table
          label={t('businesses.title')}
          columns={columns}
          // Постранично — встроенный вывод Table (10 на странице, выбор 10/20/50/100)
          rows={filtered}
          rowKey={(r) => r.id}
          loading={q.isLoading}
          // Бизнесов больше страницы — первая страница (10)
          loadingRows={10}
          onRowClick={(r) => setOpenId(r.id)}
          empty={
            needle ? (
              <EmptyState kind="search" title={t('businesses.emptySearch')} onReset={() => setSearch('')} />
            ) : status !== 'all' ? (
              <EmptyState kind="search" title={t('businesses.emptyStatus')} onReset={() => setStatus('all')} />
            ) : (
              <EmptyState icon={<Store aria-hidden />} title={t('businesses.empty')} description={t('businesses.emptyHint')} action={<LinkButton href="/platform/connect">{t('businesses.connect')}</LinkButton>} />
            )
          }
        />
      )}
      <ExitHold value={open}>{(open) => <BusinessSheet key={open.id} row={open} onClose={() => setOpenId(null)} />}</ExitHold>
    </div>
  );
}
