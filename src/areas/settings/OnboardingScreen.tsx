'use client';

/**
 * /biz/onboarding — «Быстрый старт» (F-15-022/023): чек-лист первых шагов по данным ядра + «Профиль заполнен на N%».
 * Отметки «сделано» никогда не выставляются вручную — getOnboardingChecklist читает ядро.
 */
import { useEffect } from 'react';
import { Check, ChevronRight, Compass, HandHeart, PartyPopper, Sparkles } from 'lucide-react';
import { getCompanyProfile, getOnboardingChecklist, getSubscription, type OnboardingStepId } from '@/api/settings';
import { useApiQuery } from '@/api/request';
import { SubscriptionBanner } from '@/areas/settings/SubscriptionBanner';
import { useCurrent } from '@/demo/hooks';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Button, LinkButton } from '@/ui/Button';
import { ErrorState } from '@/ui/ErrorState';
import { PageHeader } from '@/ui/PageHeader';
import { ProgressRing } from '@/ui/onboarding/ProgressRing';
import { ChecklistCard } from '@/ui/onboarding/ChecklistCard';
import type { ChecklistItemData } from '@/ui/onboarding/ChecklistItem';
import { SectionCard } from '@/ui/SectionCard';
import { Skeleton, SkeletonText } from '@/ui/Skeleton';
import { useRememberedLayout } from '@/ui/hooks/useSkeletonCount';
import { cn } from '@/lib/cn';

type SettingsKey = Parameters<ReturnType<typeof useT<'settings'>>>[0];

const STEP_ACTION: Record<OnboardingStepId, SettingsKey> = {
  services: 'onboarding.step.services.action',
  staff: 'onboarding.step.staff.action',
  staffServices: 'onboarding.step.staffServices.action',
  schedule: 'onboarding.step.schedule.action',
  online: 'onboarding.step.online.action',
  profile: 'onboarding.step.profile.action',
};

/** Шаги чек-листа — всегда эти шесть, в этом порядке (getOnboardingChecklist) */
const STEP_IDS = Object.keys(STEP_ACTION) as OnboardingStepId[];
/** Поля профиля — всегда эти шесть (getCompanyProfile) */
const PROFILE_FIELD_IDS = ['name', 'description', 'logo', 'contacts', 'photos', 'legal'] as const;

/** Что было на экране в прошлый раз: какие шаги сделаны и была ли плашка «подключили на визите» */
interface OnboardingLayout {
  done: boolean[];
  visitBanner: boolean;
}
/** Как у демо-бизнеса, пока памяти нет */
const TYPICAL_LAYOUT: OnboardingLayout = { done: [true, true, true, true, true, false], visitBanner: false };

export function OnboardingScreen() {
  const t = useT('settings');
  const format = useFormat();
  const { businessId, ready } = useCurrent();

  const stepsQ = useApiQuery(['settings', 'onboardingChecklist', businessId], () => getOnboardingChecklist(businessId ?? ''), { enabled: ready && Boolean(businessId) });
  const profileQ = useApiQuery(['settings', 'companyProfile', businessId], () => getCompanyProfile(businessId ?? ''), { enabled: ready && Boolean(businessId) });
  const subQ = useApiQuery(['settings', 'subscription', businessId], () => getSubscription(businessId ?? ''), { enabled: ready && Boolean(businessId) });

  const stepsLoading = stepsQ.isLoading || !ready;
  const subLoading = subQ.isLoading || !ready;
  const [remembered, saveLayout] = useRememberedLayout<OnboardingLayout>('onboarding');
  useEffect(() => {
    if (!stepsLoading && !subLoading && stepsQ.data) saveLayout({ done: stepsQ.data.map((st) => st.done), visitBanner: Boolean(subQ.data?.freeMonthUntil) });
  });
  const layout = remembered ?? TYPICAL_LAYOUT;

  if (stepsQ.isError) return <ErrorState onRetry={() => stepsQ.refetch()} />;

  const items: ChecklistItemData[] = (stepsQ.data ?? []).map((step) => ({
    id: step.id,
    title: t(`onboarding.step.${step.id}.title`),
    description: t(`onboarding.step.${step.id}.description`),
    done: step.done,
    href: step.href,
    actionLabel: t(STEP_ACTION[step.id]),
  }));

  return (
    <div data-f="F-15-022" className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
      <PageHeader
        title={t('onboarding.title')}
        description={t('onboarding.description')}
        back={{ href: '/biz/settings' }}
        actions={
          <div className="flex flex-wrap gap-2">
            <LinkButton href="/biz/onboarding/quick-start" variant="secondary" size="sm">
              {t('onboarding.quickStartCta')}
            </LinkButton>
            <LinkButton href="/biz/onboarding/tour" variant="ghost" size="sm" leftIcon={<Compass />}>
              {t('onboarding.tourCta')}
            </LinkButton>
            <LinkButton href="/biz/onboarding/spheres" variant="ghost" size="sm" leftIcon={<Sparkles />}>
              {t('onboarding.spheresCta')}
            </LinkButton>
          </div>
        }
      />

      <SubscriptionBanner />

      {/* F-15-027: этапы/сроки/условия старта — «подключили на визите» видно по бесплатному месяцу от подключения
          (F-00-019); ответственный сотрудник платформы пока не отдаётся API — просьба, qa/requests/settings.md */}
      {subLoading && layout.visitBanner && (
        <div className="flex items-center gap-2 rounded-lg bg-primary-soft px-4 py-3 text-sm text-primary-text">
          <HandHeart aria-hidden className="size-4 shrink-0" />
          <SkeletonText width="36ch" />
        </div>
      )}
      {!subLoading && subQ.data?.freeMonthUntil && (
        <div data-f="F-15-027" className="flex items-center gap-2 rounded-lg bg-primary-soft px-4 py-3 text-sm text-primary-text">
          <HandHeart aria-hidden className="size-4 shrink-0" />
          {t('onboarding.connectedOnVisit', { date: format.date(subQ.data.freeMonthUntil, 'long') })}
        </div>
      )}

      {stepsLoading ? (
        <ChecklistSkeleton done={layout.done} title={t('onboarding.checklistTitle')} description={t('onboarding.checklistDescription')} />
      ) : (
        <ChecklistCard
          title={t('onboarding.checklistTitle')}
          description={t('onboarding.checklistDescription')}
          items={items}
          variant="full"
          completeTitle={t('onboarding.completeTitle')}
          completeDescription={t('onboarding.completeDescription')}
          completeAction={
            <LinkButton href="/biz/journal">{t('onboarding.goToJournal')}</LinkButton>
          }
          progressLabel={t('onboarding.progressLabel', { done: items.filter((i) => i.done).length, total: items.length })}
        />
      )}

      <SectionCard
        title={t('onboarding.profileTitle')}
        description={t('onboarding.profileDescription')}
        actions={<LinkButton href="/biz/settings/brand" variant="ghost" size="sm">{t('onboarding.profileLink')}</LinkButton>}
      >
        <div data-f="F-15-023" className="flex items-center gap-4">
          {profileQ.isLoading || !ready ? (
            <Skeleton variant="circle" className="size-20 shrink-0" />
          ) : (
            <ProgressRing done={profileQ.data?.fields.filter((f) => f.done).length ?? 0} total={profileQ.data?.fields.length ?? 6} size="lg" />
          )}
          <div className="flex flex-col gap-1">
            {/* Поля профиля известны заранее — до данных те же строки, без отметки «заполнено» */}
            {(profileQ.data?.fields ?? PROFILE_FIELD_IDS.map((id) => ({ id, done: false }))).map((f) => (
              <span key={f.id} className={f.done ? 'text-sm text-muted line-through' : 'text-sm text-fg'}>
                {t(`onboarding.profileField.${f.id}`)}
              </span>
            ))}
          </div>
        </div>
      </SectionCard>

      {!stepsLoading && items.length > 0 && items.every((i) => i.done) && (
        <div className="flex items-center gap-2 rounded-lg bg-success-soft px-4 py-3 text-sm text-success">
          <PartyPopper aria-hidden className="size-4 shrink-0" />
          {t('onboarding.allDone')}
        </div>
      )}
    </div>
  );
}

/**
 * Чек-лист до данных — разметка ChecklistCard (variant="full"): кольцо, заголовок и пояснение, шесть строк шагов.
 * Сделанные шаги (как в прошлый раз) — в одну строку, несделанные — с пояснением; первый несделанный — «следующий»
 * с кнопкой (выключенной).
 */
function ChecklistSkeleton({ done, title, description }: { done: boolean[]; title: string; description: string }) {
  const t = useT('settings');
  const next = done.indexOf(false);
  return (
    <section aria-busy className="rounded-2xl border border-border bg-surface shadow-sm">
      <header className="flex items-start gap-4 px-4 pt-4 pb-2 sm:px-5 sm:pt-5">
        <Skeleton variant="circle" className="size-14 shrink-0" />
        <div className="min-w-0 flex-1 pt-1">
          <h2 className="text-lg leading-snug font-semibold tracking-tight text-fg">{title}</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted sm:text-base">{description}</p>
        </div>
      </header>
      <ol className="flex flex-col gap-1 px-2 pb-2 sm:px-3">
        {STEP_IDS.map((id, i) => {
          const isDone = done[i] ?? false;
          const isNext = i === next;
          return (
            <li key={id}>
              <div className={cn('flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left', isNext && 'bg-primary-soft/50')}>
                <span
                  aria-hidden
                  className={cn(
                    'mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
                    isDone && 'bg-success text-primary-contrast',
                    !isDone && isNext && 'bg-primary text-primary-contrast shadow-sm',
                    !isDone && !isNext && 'border-2 border-border bg-surface text-muted',
                  )}
                >
                  {isDone ? <Check className="size-4" strokeWidth={3} /> : i + 1}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5 pt-1">
                  <span className={cn('text-base leading-snug font-medium', isDone ? 'text-muted' : 'text-fg')}>{t(`onboarding.step.${id}.title`)}</span>
                  {!isDone && <span className="text-sm leading-relaxed text-muted">{t(`onboarding.step.${id}.description`)}</span>}
                  {isNext && (
                    <span className="mt-2 self-start sm:hidden">
                      <Button size="sm" disabled>
                        {t(STEP_ACTION[id])}
                      </Button>
                    </span>
                  )}
                </span>
                {isNext ? (
                  <span className="hidden shrink-0 self-center sm:inline-flex">
                    <Button size="sm" disabled>
                      {t(STEP_ACTION[id])}
                    </Button>
                  </span>
                ) : !isDone ? (
                  <ChevronRight aria-hidden className="size-5 shrink-0 self-center text-muted" />
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
