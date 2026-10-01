'use client';

/**
 * Ряд платных сторис вверху главной — видят ВСЕ (F-00-159), сначала подписки клиента, автопрокрутка раз в 3,5 с,
 * стоп при касании (F-00-161, предл.). В кружке — логотип или фото салона (demo-q1…q4: уменьшенная картинка сторис
 * с мелким текстом читалась как сломанная загрузка); картинка со свободным временем — внутри сторис.
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
import { Skeleton, SkeletonText } from '@/ui/Skeleton';
import { useSkeletonCount } from '@/ui/hooks/useSkeletonCount';

const AUTOSCROLL_INTERVAL_MS = 3500;
const ITEM_WIDTH_PX = 72 + 12;

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
    // Та же разметка, что у ряда: кружок 72 в кольце и подпись; столько, сколько было в прошлый раз (в демо — 2)
    return (
      <ul aria-busy="true" className="no-scrollbar -mx-4 flex h-[100px] list-none gap-3 overflow-x-hidden px-4">
        {Array.from({ length: skeletonCount }, (_, i) => (
          <li key={i} className="shrink-0">
            <span className="flex w-[72px] flex-col items-center gap-1.5 text-center">
              <span className="block size-[72px] rounded-full p-[3px] ring-2 ring-border">
                <Skeleton variant="circle" className="size-full" />
              </span>
              <span className="w-full truncate text-xs font-medium text-fg">
                <SkeletonText width="9ch" />
              </span>
            </span>
          </li>
        ))}
      </ul>
    );
  }
  // Нет сторис — ряда нет вовсе (ux-r1 №2): пустые кружки хуже, чем ничего
  if (q.isError || !q.data?.length) return null;

  return (
    <ul
      ref={trackRef}
      data-f="F-00-161"
      aria-label={t('home.storiesLabel')}
      className="no-scrollbar -mx-4 flex h-[100px] list-none gap-3 overflow-x-auto px-4"
      onPointerDown={() => setPaused(true)}
      onPointerUp={() => setPaused(false)}
      onPointerLeave={() => setPaused(false)}
    >
      {q.data.map((s) => {
        const cover = s.business.logoUrl ?? s.business.photos[0];
        return (
          <li key={s.id} className="shrink-0">
            <Link
              href={`/stories/${s.id}`}
              className="flex w-[72px] flex-col items-center gap-1.5 rounded-xl text-center focus-visible:outline-2 focus-visible:outline-focus"
            >
              <span className="block size-[72px] rounded-full p-[3px] ring-2 ring-primary">
                <span className="block size-full overflow-hidden rounded-full bg-surface-2">
                  {cover ? (
                    <Image src={cover} alt="" width={64} height={64} unoptimized className="size-full object-cover" />
                  ) : (
                    <Avatar name={s.business.name} size="xl" className="size-full" />
                  )}
                </span>
              </span>
              <span className="w-full truncate text-xs font-medium text-fg">{nameOf(s.business.name)}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
