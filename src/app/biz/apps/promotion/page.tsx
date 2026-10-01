import { AppGate } from '@/areas/client/apps/AppGate';
import { PromotionScreen } from '@/areas/client/apps/PromotionScreen';

// /biz/apps/promotion — раздел «client»: горящие окна, выше в поиске, место на главной (F-00-103, F-00-167).
export default function Page() {
  return (
    <AppGate permission="billing.manage">
      <PromotionScreen />
    </AppGate>
  );
}
