'use client';

/**
 * /biz/onboarding/spheres — «Сферы и их функции» (F-00-145…148): у каждой сферы свой набор функций, лишнее
 * скрыто в остальных разделах. Справочный экран: текущая сфера бизнеса отмечена, у каждой — список функций
 * человеческими словами, внизу — «Моей сферы нет» → /biz/onboarding/sphere-request.
 */
import Link from 'next/link';
import { Check, Clock } from 'lucide-react';
import { SPHERE_IDS, SPHERES, type SphereFeature } from '@/config/spheres';
import type { SphereId } from '@/domain/core';
import { listSphereRequests } from '@/api/settings';
import { useApiQuery } from '@/api/request';
import { useCurrent, useDemo } from '@/demo/hooks';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { LinkButton } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { PageHeader } from '@/ui/PageHeader';
import { SectionCard } from '@/ui/SectionCard';
import { SkeletonText } from '@/ui/Skeleton';
import { useSkeletonCount } from '@/ui/hooks/useSkeletonCount';
import { SPHERE_ICONS } from '@/shell/sphereIcons';

/**
 * ⭐ F-00-154 «стартовые сферы»: порядок волн ещё «наше решение — ждёт» (не решено, только предложенный
 * default из booking-research/functional-map/QUESTIONS.md В-36) — здесь только это предложение для
 * ориентира, не финальный список. Функции у всех сфер одинаковые уже сейчас (F-00-145).
 */
const SPHERE_WAVE: Partial<Record<SphereId, 1 | 2 | 3>> = {
  nails: 1,
  barber: 1,
  hair: 2,
  cosmetology: 2,
  massage: 2,
  dental: 3,
  fitness: 3,
};

const FEATURE_ORDER: SphereFeature[] = [
  'palette',
  'treatmentPlan',
  'medicalRecords',
  'groups',
  'onlineSessions',
  'homeVisit',
  'atHome',
  'sterilization',
  'stock',
  'resources',
  'vehicle',
  'dependents',
];

export function SpheresScreen() {
  const t = useT('settings');
  const tc = useT('common');
  const format = useFormat();
  const { sphere } = useDemo();
  const { businessId, ready } = useCurrent();

  // F-00-153: сферы, которые делаем сами по большому спросу (данные — наши заявки «Моей сферы нет», уже
  // взятые в работу) — карточка «Скоро» со ссылкой на статус; настоящий отчёт по спросу считает platform
  // (просьба — qa/requests/settings.md).
  const comingSoonQ = useApiQuery(
    ['settings', 'sphereRequests', businessId, 'comingSoon'],
    () => listSphereRequests(businessId ?? ''),
    { enabled: ready && Boolean(businessId) },
  );
  const comingSoon = (comingSoonQ.data ?? []).filter((r) => r.status === 'answered');
  const comingSoonLoading = !ready || comingSoonQ.isLoading;
  // Сколько «скоро» было в прошлый раз (в демо у салона владельца — ни одной: до ответа строка «пока нет»)
  const skeletonSoon = useSkeletonCount('coming-soon', { loading: comingSoonLoading, count: comingSoonQ.data ? comingSoon.length : undefined, fallback: 0 });

  return (
    <div data-f="F-00-145 F-00-146 F-15-031" className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
      <PageHeader
        title={t('spheres.title')}
        description={t('spheres.description')}
        back={{ href: '/biz/onboarding', label: t('quickStart.close') }}
        actions={
          <LinkButton href="/biz/onboarding/sphere-request" variant="secondary">
            {t('spheres.notFound')}
          </LinkButton>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {SPHERE_IDS.map((id) => {
          const config = SPHERES[id];
          const Icon = SPHERE_ICONS[id];
          const current = id === sphere;
          return (
            <SectionCard
              key={id}
              className={current ? 'border-primary' : undefined}
              title={
                <span className="flex items-center gap-2">
                  <Icon aria-hidden className="size-4 shrink-0 text-muted" />
                  {tc(`spheres.${id}` as never)}
                  {SPHERE_WAVE[id] && (
                    <Badge tone="neutral" size="sm" data-f="F-00-154">
                      {t('spheres.wave', { n: SPHERE_WAVE[id] })}
                    </Badge>
                  )}
                  {current && (
                    <span className="ml-auto flex items-center gap-1 text-xs font-medium text-primary-text">
                      <Check aria-hidden className="size-3.5" />
                      {t('spheres.current')}
                    </span>
                  )}
                </span>
              }
            >
              {config.features.length === 0 ? (
                <p className="text-sm text-muted">{t('spheres.noExtra')}</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {FEATURE_ORDER.filter((f) => config.features.includes(f)).map((f) => (
                    <Chip key={f}>{t(`spheres.feature.${f}` as never)}</Chip>
                  ))}
                </div>
              )}
            </SectionCard>
          );
        })}
      </div>

      <SectionCard title={t('spheres.comingSoonTitle')} description={t('spheres.comingSoonDescription')}>
        <div data-f="F-00-153">
          {comingSoonLoading && skeletonSoon > 0 ? (
            <ul className="flex flex-col gap-2">
              {Array.from({ length: skeletonSoon }, (_, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-fg">
                  <Clock aria-hidden className="size-4 shrink-0 text-muted" />
                  <SkeletonText width="10ch" />
                  <Badge tone="neutral" size="sm">
                    <SkeletonText width="14ch" />
                  </Badge>
                </li>
              ))}
            </ul>
          ) : comingSoonLoading ? (
            <p className="text-sm text-muted">
              <SkeletonText width="30ch" />
            </p>
          ) : comingSoon.length === 0 ? (
            <p className="text-sm text-muted">{t('spheres.comingSoonEmpty')}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {comingSoon.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/biz/onboarding/sphere-request/${r.id}`}
                    className="flex items-center gap-2 text-sm text-fg underline-offset-2 hover:underline"
                  >
                    <Clock aria-hidden className="size-4 shrink-0 text-muted" />
                    {r.name}
                    {r.etaDate && (
                      <Badge tone="neutral" size="sm">
                        {t('spheres.comingSoonEta', { date: format.date(r.etaDate, 'long') })}
                      </Badge>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
