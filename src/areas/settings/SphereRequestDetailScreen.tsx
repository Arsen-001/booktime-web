'use client';

/**
 * /biz/onboarding/sphere-request/[requestId] — деталь заявки «Моей сферы нет» (F-00-152): чек-лист «что
 * нужно», срок готовности и правило «годовая подписка на новую сферу начинается со дня готовности» (видно
 * в /biz/billing как «ждёт готовности сферы» — связь с движком подписки/BillingScreen — просьба фундаменту).
 */
import { useParams } from 'next/navigation';
import { CalendarClock, Check, Circle, PartyPopper } from 'lucide-react';
import { getSphereRequestDetail } from '@/api/settings';
import { useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { useHideDigitalPurchases } from '@/lib/native/useNativeApp';
import { Badge, type BadgeTone } from '@/ui/Badge';
import { LinkButton } from '@/ui/Button';
import { ErrorState } from '@/ui/ErrorState';
import { PageHeader } from '@/ui/PageHeader';
import { SectionCard } from '@/ui/SectionCard';
import { Skeleton, SkeletonText } from '@/ui/Skeleton';
import { useSkeletonCount } from '@/ui/hooks/useSkeletonCount';

const STATUS_TONE: Record<string, BadgeTone> = { open: 'warning', answered: 'success', closed: 'neutral' };

export function SphereRequestDetailScreen() {
  const t = useT('settings');
  const hidePurchases = useHideDigitalPurchases();
  const format = useFormat();
  const { businessId, ready } = useCurrent();
  const params = useParams<{ requestId: string }>();
  const requestId = params.requestId;

  const q = useApiQuery(
    ['settings', 'sphereRequestDetail', businessId, requestId],
    () => getSphereRequestDetail(businessId ?? '', requestId),
    { enabled: ready && Boolean(businessId) },
  );

  const loading = q.isLoading || !ready;
  const item = q.data;
  // Сколько шагов чек-листа было в прошлый раз (иначе как у демо-заявки «в работе» — четыре)
  const skeletonSteps = useSkeletonCount('sphere-request-steps', { loading, count: item ? (item.checklist?.length ?? 0) : undefined, fallback: 4 });

  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;

  return (
    <div data-f="F-00-152" className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
      <PageHeader
        title={loading ? <SkeletonText width="12ch" /> : (item?.name ?? t('sphereRequest.title'))}
        description={t('sphereRequestDetail.description')}
        back={{ href: '/biz/onboarding/sphere-request', label: t('sphereRequestDetail.back') }}
      />

      {loading ? (
        // Те же карточки: статус (плашка, дата, текст заявки) и чек-лист с шагами, сроком и правилом подписки
        <>
          <SectionCard title={t('sphereRequestDetail.statusTitle')}>
            <div className="flex flex-wrap items-center gap-3">
              <Badge tone="neutral">
                <SkeletonText width="8ch" />
              </Badge>
              <span className="text-sm text-muted">
                <SkeletonText width="16ch" />
              </span>
            </div>
            {/* Текст заявки: на телефоне обычно в две строки, шире — в одну */}
            <p className="mt-3 text-sm text-fg">
              <span className="block sm:hidden">
                <Skeleton lines={2} />
              </span>
              <span className="hidden sm:block">
                <SkeletonText width="60ch" />
              </span>
            </p>
          </SectionCard>
          {skeletonSteps > 0 ? (
            <SectionCard title={t('sphereRequestDetail.checklistTitle')} description={t('sphereRequestDetail.checklistDescription')}>
              <ul className="flex flex-col gap-3">
                {Array.from({ length: skeletonSteps }, (_, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm">
                    <Circle aria-hidden className="size-4 shrink-0 text-muted" />
                    <span className="text-muted">
                      <SkeletonText width="22ch" />
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 flex items-center gap-2 text-sm text-muted">
                <CalendarClock aria-hidden className="size-4 shrink-0" />
                <SkeletonText width="26ch" />
              </p>
              <p className="mt-2 text-sm text-muted">{t('sphereRequestDetail.yearlyRule')}</p>
            </SectionCard>
          ) : (
            <SectionCard title={t('sphereRequestDetail.checklistTitle')}>
              <p className="text-sm text-muted">
                <SkeletonText width="40ch" />
              </p>
            </SectionCard>
          )}
        </>
      ) : !item ? (
        <ErrorState compact onRetry={() => q.refetch()} />
      ) : (
        <>
          <SectionCard title={t('sphereRequestDetail.statusTitle')}>
            <div className="flex flex-wrap items-center gap-3">
              <Badge tone={STATUS_TONE[item.status]}>{t(`sphereRequest.status.${item.status}` as never)}</Badge>
              <span className="text-sm text-muted">{format.dateTime(item.createdAt)}</span>
            </div>
            {item.message && <p className="mt-3 text-sm text-fg">{item.message}</p>}
          </SectionCard>

          {item.checklist && item.checklist.length > 0 ? (
            <SectionCard title={t('sphereRequestDetail.checklistTitle')} description={t('sphereRequestDetail.checklistDescription')}>
              <ul className="flex flex-col gap-3">
                {item.checklist.map((step) => (
                  <li key={step.id} className="flex items-center gap-3 text-sm">
                    {step.done ? (
                      <Check aria-hidden className="size-4 shrink-0 text-success" />
                    ) : (
                      <Circle aria-hidden className="size-4 shrink-0 text-muted" />
                    )}
                    <span className={step.done ? 'text-fg' : 'text-muted'}>
                      {t(`sphereRequest.checklistStep.${step.labelKey}` as never)}
                    </span>
                  </li>
                ))}
              </ul>
              {item.etaDate && (
                <p className="mt-4 flex items-center gap-2 text-sm text-muted">
                  <CalendarClock aria-hidden className="size-4 shrink-0" />
                  {t('sphereRequestDetail.eta', { date: format.date(item.etaDate, 'long') })}
                </p>
              )}
              <p className="mt-2 text-sm text-muted">{t('sphereRequestDetail.yearlyRule')}</p>
            </SectionCard>
          ) : (
            <SectionCard title={t('sphereRequestDetail.checklistTitle')}>
              <p className="text-sm text-muted">{t('sphereRequestDetail.checklistEmpty')}</p>
            </SectionCard>
          )}

          {item.readyAt && (
            <SectionCard title={t('sphereRequestDetail.readyTitle')}>
              <div className="flex items-center gap-2 text-sm text-success">
                <PartyPopper aria-hidden className="size-4 shrink-0" />
                {t('sphereRequestDetail.readyHint', { date: format.date(item.readyAt) })}
              </div>
              {!hidePurchases && (
                <LinkButton href="/biz/billing" variant="secondary" size="sm" className="mt-3">
                  {t('sphereRequestDetail.goToBilling')}
                </LinkButton>
              )}
            </SectionCard>
          )}
        </>
      )}
    </div>
  );
}
