import { BalanceScreen } from '@/areas/notify/channels/BalanceScreen';
import { NotifyAccessGate } from '@/areas/notify/NotifyAccessGate';

// /biz/notifications/channels/balance — баланс уведомлений и пополнение (F-05-115).
export default function Page() {
  return (
    <NotifyAccessGate>
      <BalanceScreen />
    </NotifyAccessGate>
  );
}
