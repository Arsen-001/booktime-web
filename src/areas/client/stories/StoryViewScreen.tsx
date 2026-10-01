'use client';

/** Просмотр сторис (F-00-159…162, F-14-033, F-14-035): «Записаться» прямо в окно, пометка «Реклама» всегда видна. */
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getStory, recordStoryClick, recordStoryView } from '@/api/client';
import { useApiQuery } from '@/api/request';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { PageHeader } from '@/ui/PageHeader';
import { Skeleton } from '@/ui/Skeleton';

export function StoryViewScreen({ storyId }: { storyId: string }) {
  const t = useT('client');
  const router = useRouter();
  const q = useApiQuery(['story', storyId], () => getStory(storyId));
  const counted = useRef(false);

  useEffect(() => {
    if (q.data && !counted.current) {
      counted.current = true;
      void recordStoryView(storyId);
    }
  }, [q.data, storyId]);

  if (q.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-[70vh] w-full" />
      </div>
    );
  }
  if (q.isError) return <ErrorState onRetry={() => void q.refetch()} />;
  if (!q.data) {
    return <EmptyState title={t('story.notFound')} />;
  }

  const story = q.data;

  const handleBook = () => {
    void recordStoryClick(storyId);
    const params = new URLSearchParams();
    if (story.bookingTarget?.staffId) params.set('staff', story.bookingTarget.staffId);
    if (story.bookingTarget?.serviceId) params.set('service', story.bookingTarget.serviceId);
    if (!story.bookingTarget?.staffId) params.set('business', story.businessId);
    params.set('story', storyId);
    router.push(`/book?${params.toString()}`);
  };

  return (
    <div data-f="F-00-159 F-00-162 F-14-033 F-14-035" className="flex min-h-0 flex-1 flex-col gap-4">
      <PageHeader back={{ href: '/' }} title={story.business.name} />
      {/* Высота картинки ограничена — иначе вертикальная 1080×1920 картинка на 390×844 съедает весь
          экран и «Записаться» уходит за нижний край без прокрутки (F-00-159). */}
      <div className="relative mx-auto max-h-[55vh] w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-surface-2">
        <img src={story.imageUrl} alt="" className="max-h-[55vh] w-full object-cover" />
        <Badge tone="neutral" variant="solid" className="absolute top-3 right-3">
          {t('story.adBadge')}
        </Badge>
      </div>
      <div className="sticky bottom-0 -mx-4 mt-auto border-t border-border bg-surface px-4 py-3 pb-safe sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
        <div className="mx-auto w-full max-w-sm">
          <Button fullWidth onClick={handleBook}>
            {t('story.bookCta')}
          </Button>
        </div>
      </div>
    </div>
  );
}
