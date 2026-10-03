'use client';

/** /biz/orders/settings — «Заказы» вкл/выкл и как это работает для клиента (03.10.2026). */
import { BellRing, Link2, PackagePlus } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { OrdersToggleCard } from '@/areas/orders/settings/OrdersToggleCard';
import { PageHeader } from '@/ui/PageHeader';
import { SectionCard } from '@/ui/SectionCard';

const STEPS = [
  { key: 'accept', icon: PackagePlus },
  { key: 'ready', icon: BellRing },
  { key: 'link', icon: Link2 },
] as const;

export function OrdersSettingsScreen() {
  const t = useT('orders');
  return (
    <div data-f="orders-settings" className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
      <PageHeader title={t('settings.title')} description={t('settings.subtitle')} back={{ href: '/biz/settings' }} />
      <OrdersToggleCard />
      <SectionCard title={t('settings.howTitle')}>
        <ol className="flex flex-col gap-4">
          {STEPS.map(({ key, icon: Icon }) => (
            <li key={key} className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-soft text-primary-text">
                <Icon aria-hidden className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="block font-medium text-fg">{t(`settings.how.${key}.title`)}</span>
                <span className="block text-sm text-muted">{t(`settings.how.${key}.text`)}</span>
              </span>
            </li>
          ))}
        </ol>
      </SectionCard>
    </div>
  );
}
