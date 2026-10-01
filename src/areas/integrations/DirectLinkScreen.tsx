'use client';

/** /biz/integrations/e/[code] — прямая ссылка mp_<номер>_<имя> (F-13-013) → карточка приложения */
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SearchX } from 'lucide-react';
import { getAppByCode, getDevAppByCode } from '@/api/integrations';
import { useApiQuery } from '@/api/request';
import { useT } from '@/i18n/useT';
import { EmptyState } from '@/ui/EmptyState';
import { LinkButton } from '@/ui/Button';
import { Skeleton } from '@/ui/Skeleton';

/**
 * Код бывает у опубликованного приложения витрины (каталог) ИЛИ у приложения разработчика, которое ещё
 * не прошло модерацию или непубличное (F-13-033, F-13-046, F-13-031) — такое знает только владелец.
 * Пробуем каталог, не нашли — пробуем свои приложения-черновики.
 */
async function resolveDirectLink(code: string): Promise<string> {
  try {
    const app = await getAppByCode(code);
    return `/biz/integrations/apps/${app.id}`;
  } catch {
    const devApp = await getDevAppByCode(code);
    return `/biz/integrations/developers/apps/${devApp.id}`;
  }
}

export function DirectLinkScreen({ code }: { code: string }) {
  const t = useT('integrations');
  const router = useRouter();
  const q = useApiQuery(['integrations', 'directLink', code], () => resolveDirectLink(code));

  useEffect(() => {
    if (q.data) router.replace(q.data);
  }, [q.data, router]);

  if (q.isLoading || q.data) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <Skeleton lines={6} />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <EmptyState
        icon={<SearchX aria-hidden />}
        title={t('directLink.notFoundTitle')}
        description={t('directLink.notFoundText')}
        action={<LinkButton href="/biz/integrations">{t('nav.catalog')}</LinkButton>}
      />
    </div>
  );
}
