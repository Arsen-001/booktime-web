import { NativePurchaseGate } from '@/areas/settings/NativePurchaseGate';
import { SettingsBillingAccessGate } from '@/areas/settings/SettingsBillingAccessGate';
import { SubscriptionBanner } from '@/areas/settings/SubscriptionBanner';

// F-15-069: «Монеты» несёт деньги бизнеса — закрыты по прямому URL без billing.manage.
// В приложениях iOS/Android монеты не продаются (App Store 3.1.1) — NativePurchaseGate.
export default function CoinsLayout({ children }: LayoutProps<'/biz/coins'>) {
  return (
    <SettingsBillingAccessGate>
      <NativePurchaseGate>
        <div className="flex flex-col gap-4">
          <SubscriptionBanner />
          {children}
        </div>
      </NativePurchaseGate>
    </SettingsBillingAccessGate>
  );
}
