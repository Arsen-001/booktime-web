'use client';

/**
 * /biz/integrations/installed — подключённые в текущем филиале (F-13-007). Статус, окно активации (F-13-018),
 * отключение подписки партнёра (F-13-021), Altegio.me-аналог без «Отключить» (F-13-173).
 */
import { useMemo } from 'react';
import { Puzzle } from 'lucide-react';
import { listInstalled } from '@/api/integrations';
import { useApiQuery } from '@/api/request';
import { InstalledRowCard, InstalledRowCardSkeleton } from '@/areas/integrations/components/InstalledRowCard';
import { useCan, useCurrent } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { LinkButton } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { PageHeader } from '@/ui/PageHeader';
import { useSkeletonCount } from '@/ui/hooks/useSkeletonCount';

export function InstalledScreen() {
  const t = useT('integrations');
  const { ready, activeLocationIds } = useCurrent();
  const can = useCan('integrations.manage');

  const q = useApiQuery(['integrations', 'installed', activeLocationIds.join(',')], () => listInstalled(activeLocationIds), {
    enabled: ready && activeLocationIds.length > 0,
  });

  // Подстраховка от двух подключений с одним id (сид ими грешил до v6 среза, см. src/mock/slices/integrations.ts):
  // список рендерится по install.id, дубль дал бы React-варнинг «два ребёнка с одним key».
  const rows = useMemo(() => {
    const seen = new Set<string>();
    return (q.data ?? []).filter((row) => (seen.has(row.install.id) ? false : (seen.add(row.install.id), true)));
  }, [q.data]);

  const skeletonRows = useSkeletonCount('installed', { loading: q.isLoading, count: rows.length, fallback: 6 });

  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;

  return (
    <div data-f="F-13-007 F-13-025" className="flex w-full flex-col gap-6">
      <PageHeader
        title={t('installed.title')}
        description={t('installed.subtitle')}
        actions={
          <LinkButton href="/biz/integrations" variant="secondary" leftIcon={<Puzzle aria-hidden />}>
            {t('nav.catalog')}
          </LinkButton>
        }
      />

      {q.isLoading ? (
        // Скелетон — те же карточки в той же сетке, столько, сколько было в прошлый раз
        <ul className="grid grid-cols-1 gap-3 xl:grid-cols-2" aria-hidden>
          {Array.from({ length: skeletonRows }, (_, i) => (
            <InstalledRowCardSkeleton key={i} can={can} variant={i < 2 ? 'builtin' : i === 2 ? 'pending' : 'connected'} />
          ))}
        </ul>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Puzzle aria-hidden />}
          title={t('installed.emptyTitle')}
          description={t('installed.emptyText')}
          action={<LinkButton href="/biz/integrations">{t('installed.emptyCta')}</LinkButton>}
        />
      ) : (
        <ul className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {rows.map((row) => (
            <InstalledRowCard key={row.install.id} row={row} can={can} />
          ))}
        </ul>
      )}
    </div>
  );
}
