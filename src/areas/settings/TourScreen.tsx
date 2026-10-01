'use client';

/**
 * /biz/onboarding/tour — обучающий тур «Структура платформы» (F-15-021): 4 карточки, «Позже» / «Далее».
 * Показывается сам после быстрого старта (редирект из QuickStartScreen) и снова по кнопке с /biz/onboarding.
 * «Позже» просто уводит назад (можно открыть тур ещё раз); «Готово» на последней карточке помечает
 * markTourSeen — дальше OnboardingScreen может не звать тур сам.
 */
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { BookOpen, CalendarDays, Scissors, Users2 } from 'lucide-react';
import { markTourSeen } from '@/api/settings';
import { useApiMutation } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { PageHeader } from '@/ui/PageHeader';

const CARDS = [
  { id: 'journal', icon: BookOpen },
  { id: 'schedule', icon: CalendarDays },
  { id: 'services', icon: Scissors },
  { id: 'staff', icon: Users2 },
] as const;

export function TourScreen() {
  const t = useT('settings');
  const router = useRouter();
  const { businessId } = useCurrent();
  const [index, setIndex] = useState(0);
  const finish = useApiMutation((bId: string) => markTourSeen(bId));

  const card = CARDS[index];
  const isLast = index === CARDS.length - 1;
  const Icon = card.icon;

  const goNext = async () => {
    if (!isLast) {
      setIndex((i) => i + 1);
      return;
    }
    if (businessId) await finish.mutate(businessId).catch(() => undefined);
    router.push('/biz/journal');
  };

  return (
    <div data-f="F-15-021" className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
      <PageHeader title={t('tour.title')} description={t('tour.description')} back={{ href: '/biz/onboarding', label: t('quickStart.close') }} />

      <div className="flex flex-col items-center gap-5 rounded-xl border border-border bg-surface px-6 py-10 text-center shadow-xs">
        <div className="flex size-16 items-center justify-center rounded-full bg-primary-soft text-primary-text">
          <Icon aria-hidden className="size-8" />
        </div>
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-fg">{t(`tour.card.${card.id}.title` as never)}</h2>
          <p className="text-sm text-muted">{t(`tour.card.${card.id}.description` as never)}</p>
        </div>
        <div className="flex items-center gap-1.5">
          {CARDS.map((c, i) => (
            <span key={c.id} className={`h-1.5 rounded-full transition-all ${i === index ? 'w-6 bg-primary' : 'w-1.5 bg-border'}`} />
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => router.push('/biz/onboarding')}>
          {t('tour.later')}
        </Button>
        <Button onClick={() => void goNext()} loading={finish.isPending}>
          {isLast ? t('tour.finish') : t('tour.next')}
        </Button>
      </div>
    </div>
  );
}
