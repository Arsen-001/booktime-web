import { NotificationsScreen } from '@/areas/notify/NotificationsScreen';
import { NotifyAccessGate } from '@/areas/notify/NotifyAccessGate';
import { TypesTab } from '@/areas/notify/TypesTab';

// /biz/notifications — вкладка «Типы уведомлений» (F-05-001, F-05-002, F-05-003).
export default function Page() {
  return (
    <NotifyAccessGate>
      <NotificationsScreen active="types">
        <TypesTab />
      </NotificationsScreen>
    </NotifyAccessGate>
  );
}
