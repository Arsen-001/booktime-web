import { DeveloperScreen } from '@/areas/notify/channels/DeveloperScreen';
import { NotifyAccessGate } from '@/areas/notify/NotifyAccessGate';

// /biz/notifications/channels/developer — вебхуки, флаги внешнего агента, сводки партнёров (F-05-120, F-05-121, F-05-126).
export default function Page() {
  return (
    <NotifyAccessGate>
      <DeveloperScreen />
    </NotifyAccessGate>
  );
}
