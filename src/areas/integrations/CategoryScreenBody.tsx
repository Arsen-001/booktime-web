'use client';

/**
 * Список категории (F-13-004). «Скоро» для платёжных/фискальных в Армении (F-13-184, F-13-203, ⭐ F-00-028/F-00-025)
 * с подпиской «сообщить о запуске» (F-13-005) и справочными блоками (F-13-185, F-13-201, F-13-202).
 * Ревью 27.09: армянские карточки «Скоро» видны списком (И7), страна — те же сегменты, что на обзоре (И19),
 * список во всю ширину (И15), смена поиска/фильтра/страны без скелетона (М), значок статуса на плитке (И6).
 */
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Clock, Info } from 'lucide-react';
import { isSubscribedToCategory, listApps, subscribeToCategory } from '@/api/integrations';
import { useApiMutation, useApiQuery } from '@/api/request';
import { AiAssistantsExtras } from '@/areas/integrations/components/AiAssistantsExtras';
import { AppTile } from '@/areas/integrations/components/AppTile';
import { CountrySwitch } from '@/areas/integrations/components/CountrySwitch';
import { FiscalCategoryExtras } from '@/areas/integrations/components/FiscalCategoryExtras';
import { NotificationsFilters, type NotificationsFilterState } from '@/areas/integrations/components/NotificationsFilters';
import { PaymentsCategoryExtras } from '@/areas/integrations/components/PaymentsCategoryExtras';
import { appTileTone, CATEGORY_ICON, FROM_AREA_HREF } from '@/areas/integrations/catalog';
import { useCatalogCountry } from '@/areas/integrations/hooks/useCatalogCountry';
import { useInstallStatuses } from '@/areas/integrations/hooks/useInstallStatuses';
import { useCurrent } from '@/demo/hooks';
import type { IntegrationCategoryId } from '@/domain/integrations';
import { isCategoryComingSoon } from '@/domain/integrations';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { PageHeader } from '@/ui/PageHeader';
import { SearchInput } from '@/ui/SearchInput';
import { Skeleton } from '@/ui/Skeleton';
import { useToast } from '@/ui/Toast';

export function CategoryScreenBody({ categoryId }: { categoryId: IntegrationCategoryId }) {
  const t = useT('integrations');
  const toast = useToast();
  const { ready, businessId } = useCurrent();
  const [q, setQ] = useState('');
  const [filters, setFilters] = useState<NotificationsFilterState>({});
  const country = useCatalogCountry();
  const statuses = useInstallStatuses();
  const Icon = CATEGORY_ICON[categoryId];
  const tile = appTileTone(categoryId);
  const isNotifications = categoryId === 'notifications';
  const isAiAssistants = categoryId === 'aiAssistants';
  // «Скоро» у платёжных/фискальных — только пока смотрим Армению; «Все страны» показывает зарубежные карточки
  const comingSoon = isCategoryComingSoon(categoryId) && country === 'AM';

  const appsQ = useApiQuery(
    ['integrations', 'apps', 'category', categoryId, q, filters, country],
    () => listApps({ categoryId, q, country, ...filters }),
    { enabled: ready, keepPrevious: true },
  );
  const subQ = useApiQuery(['integrations', 'subscribed', businessId, categoryId], () => isSubscribedToCategory(businessId!, categoryId), {
    enabled: ready && Boolean(businessId) && isCategoryComingSoon(categoryId),
  });
  const subscribe = useApiMutation(() => subscribeToCategory(businessId!, categoryId));

  const handleSubscribe = async () => {
    try {
      await subscribe.mutate(undefined);
      toast.success(t('category.comingSoon.subscribed'));
    } catch {
      toast.error(t('errors.actionFailed'));
    }
  };

  const from = useSearchParams().get('from');
  const fromHref = from ? FROM_AREA_HREF[from] : undefined;
  const apps = appsQ.data;

  return (
    <div data-f="F-13-004" className="flex w-full flex-col gap-6">
      <PageHeader
        back={{ href: fromHref ?? '/biz/integrations' }}
        title={
          <span className="flex items-center gap-3" data-f="F-13-026">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: tile.fill, color: tile.ink }} aria-hidden>
              <Icon className="h-5 w-5" />
            </span>
            {t(`category.${categoryId}.title` as never)}
          </span>
        }
        description={t(`category.${categoryId}.text` as never)}
      />

      {categoryId === 'payments' && <PaymentsCategoryExtras />}
      {categoryId === 'fiscal' && <FiscalCategoryExtras />}
      {/* F-06-171: лояльность в чат-ботах и CRM-интеграциях — сами карточки категории ниже (AppTile), метка на корне (fids.mjs не разбирает JSX-условия глубже) */}
      {(categoryId === 'crm' || categoryId === 'chatbots') && <span hidden data-f="F-06-171" />}
      {isAiAssistants && <AiAssistantsExtras />}

      {isNotifications && (
        <>
          <Card data-f="F-13-139" className="text-sm text-muted">
            {t('category.notifications.pushExplainer')}
          </Card>
          <Card data-f="F-13-156" className="flex flex-col gap-2">
            <p className="text-sm font-semibold text-fg">{t('category.notifications.requiresChannel.title')}</p>
            <p className="text-sm text-muted">{t('category.notifications.requiresChannel.text')}</p>
            <ul className="flex flex-col gap-1.5 text-sm text-fg">
              {(t.raw('category.notifications.requiresChannel.items') as string[]).map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted">{t('category.notifications.requiresChannel.worksWithoutChannel')}</p>
          </Card>
        </>
      )}

      {comingSoon && (
        <Card data-f="F-13-005" className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1.5">
            <Badge tone="warning" icon={<Clock className="h-3.5 w-3.5" aria-hidden />} className="self-start">
              {t('category.comingSoon.badge')}
            </Badge>
            <p className="text-sm text-muted">{t('category.comingSoon.text')}</p>
          </div>
          {subQ.data ? (
            <Badge tone="success" className="shrink-0">
              {t('category.comingSoon.subscribedBadge')}
            </Badge>
          ) : (
            <Button variant="secondary" className="shrink-0" loading={subscribe.isPending} onClick={handleSubscribe}>
              {t('category.comingSoon.subscribeCta')}
            </Button>
          )}
        </Card>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SearchInput
            aria-label={t('search.label')}
            placeholder={t('search.placeholderIn', { category: t(`category.${categoryId}.title` as never) })}
            value={q}
            onValueChange={setQ}
            debounceMs={250}
            className="sm:max-w-sm"
          />
          {/* F-13-120 («ИИ-боты»: работает в Армении) и F-13-199 (платёжные/фискальные) — тот же переключатель */}
          <span className="contents" data-f="F-13-120 F-13-199">
            <CountrySwitch />
          </span>
        </div>
        {isNotifications && <NotificationsFilters value={filters} onChange={setFilters} />}
      </div>

      {appsQ.isError ? (
        <ErrorState onRetry={() => appsQ.refetch()} />
      ) : !apps ? (
        <Skeleton lines={6} />
      ) : apps.length === 0 ? (
        <EmptyState kind="search" title={t('search.emptyTitle')} description={t('search.emptyText')} onReset={q ? () => setQ('') : undefined} />
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" data-f="F-13-006 F-13-210">
          {apps.map((app) => (
            <AppTile key={app.id} app={app} status={statuses?.[app.id]} />
          ))}
        </ul>
      )}
    </div>
  );
}
