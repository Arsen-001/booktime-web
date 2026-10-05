'use client';

/** /biz/orders/settings — «Заказы» вкл/выкл, напоминание «заказ ждёт вас» (04.10.2026) и как это работает для клиента. */
import { BellRing, Clock3, FileCheck2, Link2, PackagePlus } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { OrdersToggleCard } from '@/areas/orders/settings/OrdersToggleCard';
import { PickupRemindersCard } from '@/areas/orders/settings/PickupRemindersCard';
import { useOrdersEnabled } from '@/areas/orders/lib/useOrdersData';
import { PageHeader } from '@/ui/PageHeader';
import { SectionCard } from '@/ui/SectionCard';

const STEPS = [
  { key: 'accept', icon: PackagePlus },
  { key: 'estimate', icon: FileCheck2 },
  { key: 'ready', icon: BellRing },
  { key: 'link', icon: Link2 },
  { key: 'remind', icon: Clock3 },
] as const;

export function OrdersSettingsScreen() {
  const t = useT('orders');
  const { enabled } = useOrdersEnabled();
  return (
    <div data-f="orders-settings" className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
      <PageHeader title={t('settings.title')} description={t('settings.subtitle')} back={{ href: '/biz/settings' }} />
      <OrdersToggleCard />
      {enabled && <PickupRemindersCard />}
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
