'use client';

/** Новости подписчикам (F-00-114): до 3 бесплатных в неделю, сверх — за монеты; видно только подписчикам. */
import { useState } from 'react';
import { Rss } from 'lucide-react';
import { createNewsPost, getCoinBalance, getNewsWeekStatus, listNewsPosts, NEWS_EXTRA_PRICE } from '@/api/client';
import { ApiError, useApiMutation, useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import { useClientFormat } from '@/areas/client/useClientFormat';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { ImageUpload } from '@/ui/ImageUpload';
import { PageHeader } from '@/ui/PageHeader';
import { usePagedList } from '@/ui/Pagination';
import { SectionCard } from '@/ui/SectionCard';
import { SkeletonText } from '@/ui/Skeleton';
import { useSkeletonCount } from '@/ui/hooks/useSkeletonCount';
import { Textarea } from '@/ui/Textarea';
import { useToast } from '@/ui/Toast';

export function NewsScreen() {
  const t = useT('client');
  const fmt = useClientFormat();
  const toast = useToast();
  const { ready, businessId } = useCurrent();
  const [text, setText] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string[]>([]);

  const listQ = useApiQuery(['news', businessId], () => listNewsPosts(businessId!), { enabled: ready && Boolean(businessId) });
  const weekQ = useApiQuery(['news-week', businessId], () => getNewsWeekStatus(businessId!), { enabled: ready && Boolean(businessId) });
  const balanceQ = useApiQuery(['coins', businessId], () => getCoinBalance(businessId!), { enabled: ready && Boolean(businessId) });
  // Постранично, как во всех списках (DESIGN.md → Long lists)
  const { pageItems, pager } = usePagedList(listQ.data ?? []);
  const skeletonCount = useSkeletonCount('news-posts', { loading: listQ.isLoading || !ready, count: pageItems.length, fallback: 0, max: 10 });
  const create = useApiMutation((_: void) => createNewsPost({ businessId: businessId!, text, photoUrl: photoUrl[0] }));

  const overFree = (weekQ.data?.used ?? 0) >= (weekQ.data?.free ?? 3);
  const canAfford = !overFree || (balanceQ.data ?? 0) >= NEWS_EXTRA_PRICE;

  const handlePublish = async () => {
    try {
      await create.mutate();
      toast.success(t('apps.news.published'));
      setText('');
      setPhotoUrl([]);
      void listQ.refetch();
      void weekQ.refetch();
      void balanceQ.refetch();
    } catch (e) {
      toast.error(e instanceof ApiError && e.code === 'not_enough_coins' ? t('apps.news.notEnoughCoins') : t('apps.news.publishFailed'));
    }
  };

  return (
    <div data-f="F-00-114" className="flex flex-col gap-6">
      <PageHeader title={t('apps.news.title')} description={t('apps.news.subtitle')} />

      <SectionCard title={t('apps.news.newTitle')}>
        <div className="flex flex-col gap-3">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t('apps.news.placeholder')}
            maxLength={300}
            autoResize
          />
          <ImageUpload value={photoUrl} onValueChange={setPhotoUrl} max={1} aspect="4/3" label={t('apps.news.photoLabel')} />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted">
              {weekQ.isLoading ? (
                <SkeletonText width="40ch" />
              ) : weekQ.data
                ? overFree
                  ? t('apps.news.overFreeHint', { price: NEWS_EXTRA_PRICE })
                  : t('apps.news.weekStatus', { used: weekQ.data.used, free: weekQ.data.free })
                : null}
            </p>
            <Button onClick={() => void handlePublish()} loading={create.isPending} disabled={!text.trim() || !canAfford}>
              {t('apps.news.publish')}
            </Button>
          </div>
          {overFree && !canAfford && <p className="text-sm text-danger">{t('apps.news.notEnoughCoins')}</p>}
        </div>
      </SectionCard>

      <SectionCard title={t('apps.news.historyTitle')}>
        {(listQ.isLoading || !ready) && skeletonCount === 0 ? (
          // В прошлый раз (и в демо) новостей не было — та же пустая плашка, подпись полосой
          <EmptyState compact icon={<Rss aria-hidden className="size-8 text-muted" />} title={<SkeletonText width="18ch" />} />
        ) : listQ.isLoading || !ready ? (
          <ul className="flex flex-col gap-3" aria-busy="true">
            {Array.from({ length: skeletonCount }, (_, i) => (
              <li key={i} className="flex items-start gap-3 rounded-lg border border-border p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-fg">
                    <SkeletonText width="80%" />
                  </p>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted">
                    <SkeletonText width="8ch" />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : listQ.isError ? (
          <ErrorState compact onRetry={() => void listQ.refetch()} />
        ) : !listQ.data?.length ? (
          <EmptyState compact icon={<Rss aria-hidden className="size-8 text-muted" />} title={t('apps.news.historyEmpty')} />
        ) : (
          <>
            <ul className="flex flex-col gap-3">
              {pageItems.map((p) => (
                <li key={p.id} className="flex items-start gap-3 rounded-lg border border-border p-3">
                  {p.photoUrl && <img src={p.photoUrl} alt="" className="size-14 shrink-0 rounded-lg object-cover" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-fg">{p.text}</p>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted">
                      <span>{fmt.relativeDay(p.createdAt)}</span>
                      {p.paidWithCoins && (
                        <Badge tone="accent" variant="soft" size="sm">
                          {t('apps.news.paidBadge')}
                        </Badge>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            {pager}
          </>
        )}
      </SectionCard>
    </div>
  );
}
