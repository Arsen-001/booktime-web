'use client';

/**
 * /biz/clients/log — «Журнал изменений» (⭐ F-00-040 → F-04-137): весь бизнес-журнал, не только одного
 * клиента. Существует специально ради «Готово, когда» F-04-137 — удаление клиента должно быть видно
 * ГДЕ-ТО в интерфейсе, а карточка удалённого клиента больше не открывается.
 */
import Link from 'next/link';
import { History } from 'lucide-react';
import { listClientChangeLog } from '@/api/clients';
import { useApiQuery } from '@/api/request';
import { describeClientChange } from '@/areas/clients/lib/changeLog';
import { useCurrent } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { useFormat } from '@/i18n/useFormat';
import { Card } from '@/ui/Card';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { PageHeader } from '@/ui/PageHeader';
import { SkeletonText } from '@/ui/Skeleton';
import { DEFAULT_PAGE_SIZE, usePagedList } from '@/ui/Pagination';
import { useSkeletonCount } from '@/ui/hooks/useSkeletonCount';

export function ChangeLogScreen() {
  const t = useT('clients');
  const fmt = useFormat();
  const { ready, businessId } = useCurrent();

  const query = useApiQuery(['clients', 'changeLog', businessId, 'all'], () => listClientChangeLog(businessId ?? ''), {
    enabled: ready && Boolean(businessId),
  });
  // Постранично, как во всех списках (DESIGN.md → Long lists)
  const { pageItems, pager } = usePagedList(query.data ?? []);
  // Скелетон — столько строк, сколько будет на первой странице (страница — 10)
  const skeletonRows = useSkeletonCount('changeLog', {
    loading: query.isLoading,
    count: query.data ? pageItems.length : undefined,
    fallback: 3,
    max: DEFAULT_PAGE_SIZE,
  });

  if (query.isError) return <ErrorState onRetry={query.refetch} />;

  return (
    <div data-f="F-04-137 F-04-207" className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
      <PageHeader title={t('changeLogPage.title')} description={t('changeLogPage.subtitle')} />

      {query.isLoading ? (
        // Та же карточка и те же строки, что со списком: имя, время, что изменилось, кто
        <Card padding="md" aria-busy>
          <ul className="flex flex-col divide-y divide-border">
            {Array.from({ length: skeletonRows }, (_, i) => (
              <li key={i} className="py-3 first:pt-0 last:pb-0">
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-sm font-semibold text-fg">
                    <SkeletonText width={i % 2 ? '14ch' : '18ch'} />
                  </span>
                  <span className="text-xs whitespace-nowrap text-muted">
                    <SkeletonText width="18ch" />
                  </span>
                </div>
                <p className="text-sm text-fg">
                  <SkeletonText width={i % 3 ? '26ch' : '34ch'} />
                </p>
                <p className="text-xs text-muted">
                  <SkeletonText width="16ch" />
                </p>
              </li>
            ))}
          </ul>
        </Card>
      ) : (query.data ?? []).length === 0 ? (
        <EmptyState icon={<History aria-hidden />} title={t('changeLog.emptyTitle')} description={t('changeLog.emptyText')} />
      ) : (
        <Card padding="md">
          <ul className="flex flex-col divide-y divide-border">
            {pageItems.map((e) => (
              <li key={e.id} className="py-3 first:pt-0 last:pb-0">
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <Link href={`/biz/clients/${e.clientId}`} className="-my-2.5 min-w-0 truncate py-2.5 text-sm font-semibold text-fg hover:underline">
                    {e.clientName}
                  </Link>
                  <span className="text-xs whitespace-nowrap text-muted">{fmt.dateTime(e.at)}</span>
                </div>
                <p className="text-sm text-fg">{describeClientChange(t, e)}</p>
                <p className="text-xs text-muted">{t('changeLogPage.by', { name: e.authorName })}</p>
              </li>
            ))}
          </ul>
          {pager}
        </Card>
      )}
    </div>
  );
}
