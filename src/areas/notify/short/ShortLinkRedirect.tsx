'use client';

import { Link2Off } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useApiQuery } from '@/api/request';
import { useT } from '@/i18n/useT';
import { buttonClasses } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { Skeleton } from '@/ui/Skeleton';

/**
 * Короткая ссылка из SMS `booktime.am/s/<code>` (28.09), режим mock: база в браузере — читаем код здесь и сразу
 * уводим на полный адрес (страница записи, отзыв, онлайн-запись). replace, а не push: «Назад» не возвращает на
 * пустую промежуточную страницу. В режиме api /s/<code> отвечает 302 с сервера (src/app/s/[code]/route.ts).
 */
export function ShortLinkRedirect({ code }: { code: string }) {
  const t = useT('notify');
  const router = useRouter();
  // Фасад раздела подгружается только здесь (в режиме api сюда попадают лишь «не найдено»: 302 отдаёт route.ts)
  const q = useApiQuery(['notify', 'short-link', code], () => import('@/api/notify').then((m) => m.resolveShortLink(code)));
  const target = q.data?.target;

  useEffect(() => {
    if (target) router.replace(target);
  }, [target, router]);

  if (q.isError) {
    const notFound = (q.error as { code?: string } | undefined)?.code === 'not_found';
    if (!notFound) return <ErrorState onRetry={q.refetch} />;
    return (
      <EmptyState
        icon={<Link2Off size={20} aria-hidden />}
        title={t('shortLink.notFound')}
        description={t('shortLink.notFoundHint')}
        action={
          <Link href="/" className={buttonClasses({ variant: 'secondary' })}>
            {t('shortLink.toHome')}
          </Link>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label={t('shortLink.opening')}>
      <Skeleton variant="rect" className="h-40 rounded-2xl" />
      <Skeleton variant="rect" className="h-11 rounded-lg" />
    </div>
  );
}
