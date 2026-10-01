'use client';

/**
 * /platform/visits — учёт визитов (F-00-177). Наверху — кому перезвонить (с именем и телефоном), вкладки статуса со
 * счётчиками вместо плиток, список в порядке работы: просроченные → сегодня → позже. «Новый визит» — у пальца.
 */
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { MapPin, Plus } from 'lucide-react';
import { TabCountSkeleton } from '@/areas/platform/components/TabCountSkeleton';
import { CallbackList } from '@/areas/platform/components/CallbackList';
import { useCallbacks, useVisitCounts, useVisits } from '@/areas/platform/hooks/usePlatformData';
import { VISIT_TONE } from '@/areas/platform/lib/tones';
import { VisitSheet } from '@/areas/platform/visits/VisitSheet';
import { DISTRICT_IDS } from '@/config/districts';
import type { DistrictId } from '@/domain/core';
import { callbackState, callbackOverdueDays, type Visit, type VisitStatus } from '@/domain/platform';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { today } from '@/lib/date';
import { cn } from '@/lib/cn';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { Fab } from '@/ui/Fab';
import { FilterBar } from '@/ui/FilterBar';
import { PageHeader } from '@/ui/PageHeader';
import { Select } from '@/ui/Select';
import { SkeletonText } from '@/ui/Skeleton';
import { Table, type TableColumn } from '@/ui/Table';
import { Tabs } from '@/ui/Tabs';
import { ExitHold } from '@/ui/ExitHold';

/** Счётчики вкладок в демо — по ним ширина скелетона счётчика */
const TYPICAL_COUNTS: Record<VisitStatus | 'all', number> = { all: 20, thinking: 7, connected: 7, refused: 6 };
const STATUS_TABS: (VisitStatus | 'all')[] = ['all', 'thinking', 'connected', 'refused'];

export function VisitsScreen() {
  const t = useT('platform');
  const tc = useT('common');
  const fmt = useFormat();
  const params = useSearchParams();
  const [status, setStatus] = useState<VisitStatus | 'all'>('all');
  const [district, setDistrict] = useState<DistrictId | 'all'>('all');
  // Открыть визит из «Перезвонить» на обзоре: /platform/visits?open=<id>
  const [openId, setOpenId] = useState<string | null>(() => params.get('open'));
  const [creating, setCreating] = useState(false);
  const q = useVisits(status, district);
  const countsQ = useVisitCounts();
  const callbacksQ = useCallbacks();
  const t0 = today();

  const openVisit = q.data?.find((v) => v.id === openId);

  const callbackCell = (v: Visit) => {
    const state = callbackState(v, t0);
    if (state === 'none' || !v.callbackDate) return null;
    const overdue = callbackOverdueDays(v.callbackDate, t0);
    return (
      <Badge size="sm" tone={state === 'overdue' ? 'danger' : state === 'today' ? 'warning' : 'neutral'}>
        {state === 'overdue' ? t('visits.overdueDays', { n: overdue }) : state === 'today' ? t('visits.callbackToday') : t('visits.callbackOn', { date: fmt.relativeDay(v.callbackDate) })}
      </Badge>
    );
  };

  const columns: TableColumn<Visit>[] = [
    {
      id: 'place',
      header: t('visits.placeName'),
      mobile: 'title',
      width: '14rem',
      skeletonWidth: '16ch',
      cell: (v) => <span className="block truncate font-medium text-fg">{v.placeName}</span>,
    },
    {
      id: 'contact',
      header: t('visits.contactName'),
      mobile: 'subtitle',
      width: '22rem',
      skeletonWidth: '30ch',
      cell: (v) => (
        <span className="block truncate text-muted">
          {[v.contactName, v.phone ? fmt.phone(v.phone) : undefined, tc(`districts.${v.district}`)].filter(Boolean).join(' · ')}
        </span>
      ),
    },
    { id: 'callback', header: t('visits.callbackDate'), mobile: 'aside', width: '12.5rem', skeletonWidth: '14ch', cell: (v) => callbackCell(v) },
    { id: 'visited', header: t('visits.visitedAt'), mobile: 'hidden', width: '8rem', skeletonWidth: '8ch', cell: (v) => <span className="whitespace-nowrap text-muted">{fmt.relativeDay(v.visitedAt)}</span> },
    {
      id: 'status',
      header: t('visits.statusLabel'),
      mobile: 'badge',
      align: 'right',
      width: '9rem',
      cell: (v) => <Badge tone={VISIT_TONE[v.status]}>{t(`visits.status.${v.status}`)}</Badge>,
      // Та же плашка статуса, внутри — полоса: высота строки не меняется, когда приезжают данные
      skeleton: (
        <Badge tone="neutral">
          <SkeletonText width="8ch" />
        </Badge>
      ),
    },
  ];

  const counts = countsQ.data;
  // На телефоне главное действие — плавающая кнопка у пальца, в шапке — только на десктопе
  const addButton = (className?: string) => (
    <Button className={className} leftIcon={<Plus aria-hidden />} onClick={() => setCreating(true)}>
      {t('visits.add')}
    </Button>
  );

  return (
    <div data-f="F-00-177" className="flex flex-col gap-6">
      <PageHeader title={t('visits.title')} description={t('visits.subtitle')} actions={addButton('max-md:hidden')} />

      {!callbacksQ.isError && <CallbackList items={callbacksQ.data ?? []} loading={callbacksQ.isLoading} onOpen={setOpenId} />}

      <Tabs
        value={status}
        onValueChange={(v) => setStatus(v as VisitStatus | 'all')}
        items={STATUS_TABS.map((s) => ({
          value: s,
          label: s === 'all' ? t('visits.allStatuses') : t(`visits.statusPlural.${s}`),
          badge: counts ? <Badge size="sm" tone="neutral">{counts[s]}</Badge> : <TabCountSkeleton typical={TYPICAL_COUNTS[s]} />,
        }))}
      />

      <FilterBar
        actions={
          <Select
            aria-label={t('visits.filterDistrict')}
            value={district}
            onValueChange={(v) => setDistrict(v as DistrictId | 'all')}
            options={[{ value: 'all', label: t('visits.allDistricts') }, ...DISTRICT_IDS.map((d) => ({ value: d, label: tc(`districts.${d}`) }))]}
          />
        }
      />

      {q.isError ? (
        <ErrorState onRetry={q.refetch} />
      ) : (
        <Table
          label={t('visits.title')}
          columns={columns}
          rows={q.data ?? []}
          rowKey={(v) => v.id}
          loading={q.isLoading}
          // Визитов в демо двадцать — первая страница (10)
          loadingRows={10}
          onRowClick={(v) => setOpenId(v.id)}
          className={cn(q.isPlaceholderData && 'opacity-60 transition-opacity')}
          empty={
            status !== 'all' || district !== 'all' ? (
              <EmptyState kind="search" title={t('visits.emptyFilter')} onReset={() => { setStatus('all'); setDistrict('all'); }} />
            ) : (
              <EmptyState icon={<MapPin aria-hidden />} title={t('visits.empty')} description={t('visits.emptyHint')} action={addButton()} />
            )
          }
        />
      )}

      <Fab icon={<Plus />} label={t('visits.add')} extended onClick={() => setCreating(true)} />
      <ExitHold value={creating}>{() => <VisitSheet onClose={() => setCreating(false)} />}</ExitHold>
      <ExitHold value={openVisit}>{(openVisit) => <VisitSheet key={openVisit.id} visit={openVisit} onClose={() => setOpenId(null)} />}</ExitHold>
    </div>
  );
}
