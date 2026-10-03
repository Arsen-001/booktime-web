'use client';

/**
 * Ряд платных сторис на главной вошедшего клиента (F-00-159), сначала подписки клиента, автопрокрутка раз в 3,5 с,
 * стоп при касании (F-00-161, предл.). Вертикальные карточки 9:16 с самой картинкой сторис (владелец 03.10.2026:
 * «вертикальные прямоугольники» вместо кружков), внизу логотип и имя салона, сверху «Реклама» (F-00-162).
 * Свой скролл-контейнер, а не ScrollRow: автопрокрутке нужен scrollLeft (просьба про вариант с автопрокруткой — qa/requests/client.md).
 */
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { listHomeStories } from '@/api/client';
import { useApiQuery } from '@/api/request';
import { clientKeys } from '@/areas/client/ui/clientKeys';
import { useCurrent } from '@/demo/hooks';
import { useDisplayName } from '@/areas/client/useDisplayName';
import { useT } from '@/i18n/useT';
import { Avatar } from '@/ui/Avatar';
import { Skeleton } from '@/ui/Skeleton';
import { useSkeletonCount } from '@/ui/hooks/useSkeletonCount';

const AUTOSCROLL_INTERVAL_MS = 3500;
const ITEM_WIDTH_PX = 112 + 12;

export function StoriesRow() {
  const t = useT('client');
  const nameOf = useDisplayName();
  const { ready, appUserId } = useCurrent();
  const q = useApiQuery(clientKeys.homeStories(appUserId), () => listHomeStories(appUserId), { enabled: ready });
  const trackRef = useRef<HTMLUListElement>(null);
  const [paused, setPaused] = useState(false);
  const skeletonCount = useSkeletonCount('home-stories', { loading: q.isLoading, count: q.data?.length, fallback: 2, max: 8 });

  useEffect(() => {
    if (paused || !q.data || q.data.length < 4) return;
    const track = trackRef.current;
    if (!track) return;
    const timer = setInterval(() => {
      const atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
      track.scrollTo({ left: atEnd ? 0 : track.scrollLeft + ITEM_WIDTH_PX, behavior: 'smooth' });
    }, AUTOSCROLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [paused, q.data]);

  if (q.isLoading) {
    // Та же разметка, что у ряда: вертикальная карточка 9:16; столько, сколько было в прошлый раз (в демо — 2)
    return (
      <ul aria-busy="true" className="no-scrollbar -mx-4 flex list-none gap-3 overflow-x-hidden px-4 py-1">
        {Array.from({ length: skeletonCount }, (_, i) => (
          <li key={i} className="shrink-0">
            <Skeleton className="block aspect-[9/16] w-[6.5rem] rounded-2xl sm:w-28" />
          </li>
        ))}
      </ul>
    );
  }
  // Нет сторис — ряда нет вовсе (ux-r1 №2): пустые карточки хуже, чем ничего
  if (q.isError || !q.data?.length) return null;

  return (
    <ul
      ref={trackRef}
      data-f="F-00-161"
      aria-label={t('home.storiesLabel')}
      className="no-scrollbar -mx-4 flex list-none gap-3 overflow-x-auto px-4 py-1"
      onPointerDown={() => setPaused(true)}
      onPointerUp={() => setPaused(false)}
      onPointerLeave={() => setPaused(false)}
    >
      {q.data.map((s) => {
        const logo = s.business.logoUrl ?? s.business.photos[0];
        return (
          <li key={s.id} className="shrink-0">
            <Link
              href={`/stories/${s.id}`}
              className="group relative block aspect-[9/16] w-[6.5rem] overflow-hidden rounded-2xl bg-surface-2 ring-2 ring-primary ring-offset-2 ring-offset-bg transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus sm:w-28"
            >
              <Image src={s.imageUrl} alt="" fill sizes="112px" unoptimized className="object-cover transition-transform duration-500 group-hover:scale-105" />
              <span className="absolute top-1.5 right-1.5 rounded-md bg-overlay px-1.5 py-0.5 text-[10px] font-semibold text-primary-contrast">
                {t('home.adBadge')}
              </span>
              <span className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-linear-to-t from-overlay to-transparent px-2 pt-6 pb-2">
                <span className="block size-6 shrink-0 overflow-hidden rounded-full bg-surface ring-1 ring-primary-contrast">
                  {logo ? (
                    <Image src={logo} alt="" width={24} height={24} unoptimized className="size-full object-cover" />
                  ) : (
                    <Avatar name={s.business.name} size="xs" className="size-full" />
                  )}
                </span>
                <span className="min-w-0 truncate text-xs font-semibold text-primary-contrast">{nameOf(s.business.name)}</span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
