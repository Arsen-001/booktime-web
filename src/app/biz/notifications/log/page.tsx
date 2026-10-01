import { LogScreen } from '@/areas/notify/LogScreen';
import { NotifyAccessGate } from '@/areas/notify/NotifyAccessGate';

// /biz/notifications/log — журнал отправок (F-05-107, F-05-108, F-05-130).
export default function Page() {
  return (
    <NotifyAccessGate extra="notify.log">
      <LogScreen />
    </NotifyAccessGate>
  );
}
