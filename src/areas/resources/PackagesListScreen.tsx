'use client';

/**
 * /biz/resources/packages — список пакетов (F-16-107, F-16-108, F-16-133): что такое пакет, «+ Создать»,
 * карточки со значком, пусто-состояние объясняет функцию (у Altegio — «Комплекс», у нас — свои слова).
 */
import { useMemo } from 'react';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import { AlertTriangle, Boxes, Plus } from 'lucide-react';
import { coreList } from '@/api/core';
import { isPackageBroken, listPackages, packageDuration, packagePrice, toPackageServiceLite } from '@/api/resources';
import { useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { pickText } from '@/lib/text';
import { Badge } from '@/ui/Badge';
import { LinkButton } from '@/ui/Button';
import { Fab } from '@/ui/Fab';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { PageHeader } from '@/ui/PageHeader';
import { Skeleton, SkeletonText, SkeletonOver } from '@/ui/Skeleton';
import { useSkeletonCount } from '@/ui/hooks/useSkeletonCount';
import { useResourcesRights } from '@/areas/resources/lib/rights';

export function PackagesListScreen() {
  const t = useT('resources');
  const locale = useLocale();
  const format = useFormat();
  const { ready, businessId } = useCurrent();
  const canManage = useResourcesRights().editServiceResources;

  const servicesQ = useApiQuery(['resources', 'services-for-form', businessId], () => coreList('services', { businessId: businessId ?? '' }), {
    enabled: ready && Boolean(businessId),
  });
  const packagesQ = useApiQuery(['resources', 'packages', businessId], () => listPackages(businessId ?? ''), { enabled: ready && Boolean(businessId) });
  const servicesById = useMemo(() => toPackageServiceLite(servicesQ.data ?? []), [servicesQ.data]);
  const packages = packagesQ.data ?? [];
  const loading = !ready || packagesQ.isLoading || servicesQ.isLoading;
  const skeletonRows = useSkeletonCount('packages', { loading, count: loading ? undefined : packages.length, fallback: 0, max: 10 });

  if (packagesQ.isError) {
    return (
      <div className="flex w-full flex-col gap-6">
        <PageHeader title={t('packages.title')} description={t('packages.description')} />
        <ErrorState onRetry={packagesQ.refetch} />
      </div>
    );
  }

  return (
    <div data-f="F-16-107 F-16-133" className="flex w-full flex-col gap-6">
      <PageHeader
        title={t('packages.title')}
        description={t('packages.description')}
        actions={
          // Пустое состояние несёт свою кнопку; на телефоне главное действие — Fab у большого пальца
          // Кнопка на месте уже при загрузке — шапка не перестраивается, когда пакеты пришли
          canManage && (loading ? skeletonRows > 0 : packages.length > 0) ? (
            <span className="max-md:hidden">
              <LinkButton href="/biz/resources/packages/new" leftIcon={<Plus aria-hidden />}>
                {t('packages.create')}
              </LinkButton>
            </span>
          ) : undefined
        }
      />

      {loading && skeletonRows === 0 ? (
        // В прошлый раз пакетов не было (в демо — так): скелетон — то же пустое состояние, текст под серой плашкой
        <EmptyState
          icon={<Boxes aria-hidden />}
          title={<SkeletonOver>{t('packages.emptyTitle')}</SkeletonOver>}
          description={<SkeletonOver>{t('packages.emptyText')}</SkeletonOver>}
          action={
            canManage ? (
              <LinkButton href="/biz/resources/packages/new" leftIcon={<Plus aria-hidden />}>
                {t('packages.create')}
              </LinkButton>
            ) : undefined
          }
        />
      ) : loading ? (
        <ul className="flex flex-col gap-2" aria-busy>
          {Array.from({ length: skeletonRows }, (_, i) => (
            <li key={i}>
              <PackageRowSkeleton label={t('packages.badge')} />
            </li>
          ))}
        </ul>
      ) : packages.length === 0 ? (
        <EmptyState
          icon={<Boxes aria-hidden />}
          title={t('packages.emptyTitle')}
          description={t('packages.emptyText')}
          action={
            canManage ? (
              <LinkButton href="/biz/resources/packages/new" leftIcon={<Plus aria-hidden />}>
                {t('packages.create')}
              </LinkButton>
            ) : undefined
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {packages.map((p) => {
            const items = (p.servicePackage?.items ?? []).map((it) => ({ serviceId: it.serviceId, qty: 1 }));
            const mode = p.servicePackage?.mode ?? 'sequentialAny';
            const duration = packageDuration(items, servicesById, mode);
            const price = packagePrice(items, servicesById, p.extra.pricingMethod, p.extra.manualPrice, p.extra.discountPercent);
            const broken = isPackageBroken(items, servicesById);
            return (
              <li key={p.id}>
                <Link
                  href={`/biz/resources/packages/${p.id}`}
                  className="flex min-h-16 items-center gap-3 rounded-xl border border-border bg-surface p-4 shadow-xs transition-colors hover:bg-surface-2/60"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-soft text-primary-text">
                    <Boxes aria-hidden className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-medium text-fg">{pickText(p.name, locale)}</span>
                      <Badge tone="neutral">{t('packages.badge')}</Badge>
                      {broken && (
                        <Badge tone="danger">
                          <AlertTriangle aria-hidden className="mr-1 size-3" />
                          {t('packages.notConfigured')}
                        </Badge>
                      )}
                    </span>
                    <span className="mt-0.5 block text-sm text-muted">
                      {t('packages.itemsCount', { count: items.length })} · {format.durationRange(duration.min, duration.max)} ·{' '}
                      {format.moneyRange(price.min, price.max)}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {canManage && !loading && packages.length > 0 && <Fab icon={<Plus aria-hidden />} label={t('packages.create')} href="/biz/resources/packages/new" />}
    </div>
  );
}

/** Строка пакета до загрузки — та же разметка, что у ссылки-строки: кружок, имя с плашкой, строка состава */
function PackageRowSkeleton({ label }: { label: string }) {
  return (
    <div className="flex min-h-16 items-center gap-3 rounded-xl border border-border bg-surface p-4 shadow-xs">
      <Skeleton variant="circle" className="size-10 shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate font-medium text-fg">
            <SkeletonText width="16ch" />
          </span>
          <Badge tone="neutral">{label}</Badge>
        </span>
        <span className="mt-0.5 block text-sm text-muted">
          <SkeletonText width="26ch" />
        </span>
      </span>
    </div>
  );
}

