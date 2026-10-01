'use client';

/**
 * /platform/ads — реклама и сторис: баннеры только из нашей панели (F-00-163), поставщики без аккаунта (F-00-164, F-00-165),
 * отчёт — показы и нажатия (F-00-166), места сторис и очередь (F-00-160). Главная кнопка — в шапке и у пальца, своя на вкладку.
 */
import { useMemo, useState } from 'react';
import { Megaphone, MousePointerClick, Plus, Settings2, Radio, Eye } from 'lucide-react';
import { AdCreateSheet } from '@/areas/platform/ads/AdCreateSheet';
import { AdDetailSheet } from '@/areas/platform/ads/AdDetailSheet';
import { AdThumb } from '@/areas/platform/ads/AdThumb';
import { StoriesTab } from '@/areas/platform/ads/StoriesTab';
import { StoryConfigSheet } from '@/areas/platform/ads/StoryConfigSheet';
import { useAdText } from '@/areas/platform/ads/adText';
import { useAds, useStoryBoard } from '@/areas/platform/hooks/usePlatformData';
import { AD_TONE } from '@/areas/platform/lib/tones';
import type { AdKind, AdView } from '@/domain/platform';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { Fab } from '@/ui/Fab';
import { PageHeader } from '@/ui/PageHeader';
import { Skeleton, SkeletonText } from '@/ui/Skeleton';
import { StatCard } from '@/ui/StatCard';
import { Table, type TableColumn } from '@/ui/Table';
import { Tabs } from '@/ui/Tabs';
import { ExitHold } from '@/ui/ExitHold';

type AdsTab = 'banners' | 'suppliers' | 'stories';

export function AdsScreen() {
  const t = useT('platform');
  const fmt = useFormat();
  const text = useAdText();
  const [tab, setTab] = useState<AdsTab>('banners');
  const [creating, setCreating] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const kind: AdKind = tab === 'suppliers' ? 'supplier' : 'banner';
  const q = useAds(kind);
  const boardQ = useStoryBoard('all');
  const open = q.data?.find((a) => a.id === openId);

  // Метрики над списком (F-00-166) — крупным числом, а не только колонками в таблице
  const summary = useMemo(() => {
    const rows = q.data ?? [];
    return {
      active: rows.filter((a) => a.state === 'running').length,
      views: rows.reduce((sum, a) => sum + a.views, 0),
      clicks: rows.reduce((sum, a) => sum + a.clicks, 0),
    };
  }, [q.data]);

  const columns: TableColumn<AdView>[] = [
    { id: 'media', header: '', mobile: 'media', width: '80px', cell: (a) => <AdThumb imageUrl={a.imageUrl} />, skeleton: <Skeleton variant="rect" className="h-10 w-16 rounded-lg" /> },
    {
      id: 'title',
      header: t('ads.adTitle'),
      mobile: 'title',
      width: '26rem',
      cell: (a) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-medium text-fg">{a.title}</span>
          <span className="truncate text-sm font-normal text-muted">{text.where(a)} · {text.period(a)}</span>
        </span>
      ),
      skeleton: (
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-medium text-fg">
            <SkeletonText width="26ch" />
          </span>
          <span className="truncate text-sm font-normal text-muted">
            <SkeletonText width="22ch" />
          </span>
        </span>
      ),
    },
    { id: 'advertiser', header: t('ads.advertiserName'), mobile: 'hidden', width: '12rem', skeletonWidth: '12ch', cell: (a) => <span className="block truncate">{a.advertiser.name}</span> },
    { id: 'views', header: t('ads.views'), align: 'right', mobile: 'hidden', width: '7rem', skeletonWidth: '5ch', cell: (a) => (a.views ? fmt.number(a.views) : <span className="text-muted">—</span>) },
    { id: 'clicks', header: t('ads.clicks'), align: 'right', mobile: 'hidden', width: '7rem', skeletonWidth: '4ch', cell: (a) => (a.views ? fmt.number(a.clicks) : <span className="text-muted">—</span>) },
    {
      id: 'state',
      header: t('ads.stateLabel'),
      align: 'right',
      mobile: 'badge',
      width: '9rem',
      cell: (a) => <Badge tone={AD_TONE[a.state]}>{t(`ads.state.${a.state}`)}</Badge>,
      skeleton: (
        <Badge tone="neutral">
          <SkeletonText width="7ch" />
        </Badge>
      ),
    },
  ];

  // Баннер и поставщик на телефоне — плавающей кнопкой у пальца; «Настроить места» — в шапке везде
  const primary = (className?: string) =>
    tab === 'stories' ? (
      <Button variant="outline" leftIcon={<Settings2 aria-hidden />} onClick={() => setConfigOpen(true)} disabled={!boardQ.data}>
        {t('ads.configurePlaces')}
      </Button>
    ) : (
      <Button className={className} leftIcon={<Plus aria-hidden />} onClick={() => setCreating(true)}>
        {tab === 'banners' ? t('ads.addBanner') : t('ads.addSupplier')}
      </Button>
    );

  return (
    <div data-f="F-00-166 F-00-163 F-00-164" className="flex flex-col gap-6">
      <PageHeader title={t('ads.title')} description={t('ads.subtitle')} actions={primary('max-md:hidden')} />

      <div className="flex flex-col gap-2">
        <Tabs
          value={tab}
          onValueChange={(v) => {
            setTab(v as AdsTab);
            setOpenId(null);
          }}
          items={[
            { value: 'banners', label: t('ads.tabBanners') },
            { value: 'suppliers', label: t('ads.tabSuppliers') },
            { value: 'stories', label: t('ads.tabStories') },
          ]}
        />
        <p data-f={tab === 'suppliers' ? 'F-00-164 F-00-165' : tab === 'stories' ? 'F-00-159' : 'F-00-163'} className="text-sm text-muted">
          {t(`ads.tabHint.${tab}`)}
        </p>
      </div>

      {tab !== 'stories' && !q.isError && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard label={t(`ads.statActive.${tab}`)} value={summary.active} icon={<Radio aria-hidden />} loading={q.isLoading} />
          <StatCard label={t('ads.statViewsTotal')} value={fmt.number(summary.views)} icon={<Eye aria-hidden />} loading={q.isLoading} />
          <StatCard label={t('ads.statClicksTotal')} value={fmt.number(summary.clicks)} icon={<MousePointerClick aria-hidden />} loading={q.isLoading} className="col-span-2 sm:col-span-1" />
        </div>
      )}

      {tab === 'stories' ? (
        <StoriesTab />
      ) : q.isError ? (
        <ErrorState onRetry={q.refetch} />
      ) : (
        <Table
          label={t('ads.title')}
          columns={columns}
          rows={q.data ?? []}
          rowKey={(a) => a.id}
          loading={q.isLoading}
          mobileCard={(a) => <AdMobileCard ad={a} />}
          mobileCardSkeleton={<AdMobileCard />}
          // В демо — два баннера и три поставщика
          loadingRows={tab === 'banners' ? 2 : 3}
          onRowClick={(a) => setOpenId(a.id)}
          empty={
            <EmptyState
              icon={<Megaphone aria-hidden />}
              title={tab === 'banners' ? t('ads.emptyBanners') : t('ads.emptySuppliers')}
              description={t(`ads.tabHint.${tab}`)}
              action={primary()}
            />
          }
        />
      )}

      {tab !== 'stories' && <Fab icon={<Plus />} label={tab === 'banners' ? t('ads.addBanner') : t('ads.addSupplier')} extended onClick={() => setCreating(true)} />}
      <ExitHold value={creating}>{() => <AdCreateSheet kind={kind} onClose={() => setCreating(false)} />}</ExitHold>
      <ExitHold value={configOpen && boardQ.data}>{(board) => <StoryConfigSheet config={board.config} onClose={() => setConfigOpen(false)} />}</ExitHold>
      <ExitHold value={open}>{(open) => <AdDetailSheet key={open.id} ad={open} onClose={() => setOpenId(null)} />}</ExitHold>
    </div>
  );
}

/**
 * Карточка объявления на телефоне: миниатюра, название, где · когда, внизу — цифры (если показы уже были) и статус.
 * Статус в своей строке, а не рядом с названием: длинное «Запланировано» не переносится и не делает карточку выше.
 * Без `ad` — скелетон той же разметки.
 */
function AdMobileCard({ ad }: { ad?: AdView }) {
  const t = useT('platform');
  const text = useAdText();
  return (
    <div className="flex min-w-0 gap-3">
      {ad ? <AdThumb imageUrl={ad.imageUrl} /> : <Skeleton variant="rect" className="h-10 w-16 shrink-0 rounded-lg" />}
      <div className="min-w-0 flex-1">
        <p className="truncate text-base leading-snug font-semibold text-fg">{ad ? ad.title : <SkeletonText width="22ch" />}</p>
        <p className="truncate text-sm text-muted">{ad ? `${text.where(ad)} · ${text.period(ad)}` : <SkeletonText width="20ch" />}</p>
        <div className="mt-1.5 flex items-center justify-between gap-2">
          {/* Цифры — только когда показы уже были (ноль — не результат) */}
          <span className="min-w-0 truncate text-sm text-muted">
            {!ad ? <SkeletonText width="16ch" /> : ad.views > 0 ? t('ads.statsLine', { views: ad.views, clicks: ad.clicks }) : null}
          </span>
          {ad ? (
            <Badge tone={AD_TONE[ad.state]}>{t(`ads.state.${ad.state}`)}</Badge>
          ) : (
            <Badge tone="neutral">
              <SkeletonText width="7ch" />
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}
