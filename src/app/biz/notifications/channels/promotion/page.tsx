import { PromotionScreen } from '@/areas/notify/channels/PromotionScreen';
import { NotifyAccessGate } from '@/areas/notify/NotifyAccessGate';

// /biz/notifications/channels/promotion — Open Slots, «Кого позвать», витрина подарков (F-05-124, F-05-125, F-05-127).
export default function Page() {
  return (
    <NotifyAccessGate>
      <PromotionScreen />
    </NotifyAccessGate>
  );
}
