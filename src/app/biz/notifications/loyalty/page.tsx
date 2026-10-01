import { LoyaltyNotifyScreen } from '@/areas/notify/loyalty/LoyaltyNotifyScreen';
import { NotifyAccessGate } from '@/areas/notify/NotifyAccessGate';

// /biz/notifications/loyalty — лояльность, абонементы, письма (F-05-081, F-05-100…106, F-05-127, F-05-128, F-05-136).
export default function Page() {
  return (
    <NotifyAccessGate>
      <LoyaltyNotifyScreen />
    </NotifyAccessGate>
  );
}
