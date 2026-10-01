import { SettingsBillingAccessGate } from '@/areas/settings/SettingsBillingAccessGate';
import { SubscriptionBanner } from '@/areas/settings/SubscriptionBanner';

// F-15-069: «Монеты» несёт деньги бизнеса — закрыты по прямому URL без billing.manage.
export default function CoinsLayout({ children }: LayoutProps<'/biz/coins'>) {
  return (
    <SettingsBillingAccessGate>
      <div className="flex flex-col gap-4">
        <SubscriptionBanner />
        {children}
      </div>
    </SettingsBillingAccessGate>
  );
}
