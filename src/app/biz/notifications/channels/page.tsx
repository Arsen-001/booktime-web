import { ChannelsTab } from '@/areas/notify/ChannelsTab';
import { NotificationsScreen } from '@/areas/notify/NotificationsScreen';
import { NotifyAccessGate } from '@/areas/notify/NotifyAccessGate';

// /biz/notifications/channels — вкладка «Каналы отправки» (F-05-065).
export default function Page() {
  return (
    <NotifyAccessGate>
      <NotificationsScreen active="channels">
        <ChannelsTab />
      </NotificationsScreen>
    </NotifyAccessGate>
  );
}
