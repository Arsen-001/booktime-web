import { AppGate } from '@/areas/client/apps/AppGate';
import { PromotionScreen } from '@/areas/client/apps/PromotionScreen';
import { NativePurchaseGate } from '@/areas/settings/NativePurchaseGate';

// /biz/apps/promotion — раздел «client»: горящие окна, выше в поиске, место на главной (F-00-103, F-00-167).
// Продвижение покупается за монеты — в приложениях iOS/Android экрана нет (App Store 3.1.1).
export default function Page() {
  return (
    <AppGate permission="billing.manage">
      <NativePurchaseGate>
        <PromotionScreen />
      </NativePurchaseGate>
    </AppGate>
  );
}
