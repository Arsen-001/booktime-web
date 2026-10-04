import { NativePurchaseGate } from '@/areas/settings/NativePurchaseGate';
import { SettingsBillingAccessGate } from '@/areas/settings/SettingsBillingAccessGate';

// F-15-069: «Подписка» несёт деньги бизнеса — закрыта по прямому URL без billing.manage (по образцу finance).
// Полоса предупреждений (F-15-064) здесь не дублируется — она уже часть SubscriptionScreen (карточка «Срок
// действия»); подключена отдельно на /biz/coins и в хабе настроек, где такой карточки нет.
// В приложениях iOS/Android оплаты нет (App Store 3.1.1) — NativePurchaseGate.
export default function BillingLayout({ children }: LayoutProps<'/biz/billing'>) {
  return (
    <SettingsBillingAccessGate>
      <NativePurchaseGate>{children}</NativePurchaseGate>
    </SettingsBillingAccessGate>
  );
}
