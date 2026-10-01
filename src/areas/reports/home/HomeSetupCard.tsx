'use client';

/**
 * Пустой салон на главной (CONVENTIONS §0.3): вместо пяти нулей — «первые шаги» с тем, что сделать дальше.
 * «Сделано» считается по данным (есть услуги, есть мастера, есть записи), а не по нажатиям.
 */
import { useT } from '@/i18n/useT';
import type { OwnerHomeData } from '@/domain/reports';
import { ChecklistCard } from '@/ui/onboarding/ChecklistCard';
import { checklistProgress } from '@/ui/onboarding/checklist';
import type { ChecklistItemData } from '@/ui/onboarding/ChecklistItem';

export function HomeSetupCard({ setup }: { setup: OwnerHomeData['setup'] }) {
  const t = useT('reports');
  const items: ChecklistItemData[] = [
    {
      id: 'services',
      title: t('home.setup.services'),
      description: t('home.setup.servicesText'),
      done: setup.services > 0,
      href: '/biz/services',
      actionLabel: t('home.setup.go'),
    },
    {
      id: 'masters',
      title: t('home.setup.masters'),
      description: t('home.setup.mastersText'),
      done: setup.masters > 0,
      href: '/biz/staff',
      actionLabel: t('home.setup.go'),
    },
    {
      id: 'booking',
      title: t('home.setup.booking'),
      description: t('home.setup.bookingText'),
      done: setup.bookings > 0,
      href: '/biz/journal',
      actionLabel: t('home.setup.go'),
    },
    {
      id: 'online',
      title: t('home.setup.online'),
      description: t('home.setup.onlineText'),
      done: false,
      href: '/biz/online',
      actionLabel: t('home.setup.go'),
      optional: true,
    },
  ];
  const p = checklistProgress(items);
  return (
    <ChecklistCard
      title={t('home.setup.title')}
      description={t('home.setup.description')}
      items={items}
      progressLabel={t('home.setup.progress', { done: p.done, total: p.total })}
    />
  );
}
