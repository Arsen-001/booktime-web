'use client';

import { ArrowLeft, Construction, Home } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useSyncExternalStore } from 'react';
import { AREAS, type AreaId } from '@/config/areas';
import { useT } from '@/i18n/useT';
import { useTDynamic } from '@/i18n/useTDynamic';
import { LinkButton } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { EmptyState } from '@/ui/EmptyState';
import { KeyValueList } from '@/ui/KeyValueList';
import { PageHeader } from '@/ui/PageHeader';

export interface AreaPlaceholderProps {
  area: AreaId;
  /** Полный ключ подписи страницы (пункт меню), например 'loyalty.nav.promotions' */
  labelKey?: string;
}

/** ?debug=1 в адресе — показать служебные сведения и на рабочих страницах */
function useDebugFlag(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => new URLSearchParams(window.location.search).get('debug') === '1',
    () => false,
  );
}

/** Родительская страница: /biz/clients/categories → /biz/clients; /biz/loyalty → /biz */
function parentOf(pathname: string): string {
  const parts = pathname.split('/').filter(Boolean);
  return parts.length > 1 ? `/${parts.slice(0, -1).join('/')}` : '/';
}

/**
 * Страница-заглушка «Скоро здесь будет …». Лежит в путях раздела — раздел заменяет её своим экраном.
 * Людям — дружелюбное пустое состояние с кнопкой назад (клиенту — «На главную»). Служебное (раздел, адрес, ТЗ) —
 * только на /dev/* или с ?debug=1.
 */
export function AreaPlaceholder({ area, labelKey }: AreaPlaceholderProps) {
  const t = useT('common');
  const tu = useT('ui');
  const tDyn = useTDynamic();
  const pathname = usePathname();
  const debug = useDebugFlag();
  const info = AREAS[area];
  const areaTitle = t(`areas.${area}`);
  const title = labelKey ? tDyn(labelKey) : areaTitle;
  const isWorkspace = pathname.startsWith('/biz') || pathname.startsWith('/platform');
  const showTeamInfo = debug || pathname.startsWith('/dev');

  return (
    <div data-area-placeholder={area} className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageHeader title={title} />
      <Card padding="none" className="overflow-hidden">
        <EmptyState
          icon={<Construction />}
          title={tu('soon.title', { title })}
          description={isWorkspace ? tu('soon.text') : tu('soon.clientText')}
          action={
            isWorkspace ? (
              <LinkButton href={parentOf(pathname)} variant="secondary" leftIcon={<ArrowLeft aria-hidden />}>
                {tu('soon.back')}
              </LinkButton>
            ) : (
              <LinkButton href="/" leftIcon={<Home aria-hidden />}>
                {tu('soon.home')}
              </LinkButton>
            )
          }
        />
        {showTeamInfo && (
          <div className="border-t border-border bg-surface-2/50 px-5 py-4 sm:px-6">
            <p className="mb-2 text-xs font-semibold text-muted">{tu('soon.team')}</p>
            <KeyValueList
              dense
              columns={2}
              className="text-sm"
              items={[
                { label: t('placeholder.area'), value: `${areaTitle} · ${area}` },
                { label: t('placeholder.route'), value: <code className="text-sm">{pathname}</code> },
                {
                  label: t('placeholder.spec'),
                  value: info.spec.length ? info.spec.join(', ') : t('placeholder.noSpec'),
                },
                { label: t('placeholder.ours'), value: info.ours },
              ]}
            />
          </div>
        )}
      </Card>
    </div>
  );
}
