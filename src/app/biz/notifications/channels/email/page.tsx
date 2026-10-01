import { EmailChannelScreen } from '@/areas/notify/channels/EmailChannelScreen';
import { NotifyAccessGate } from '@/areas/notify/NotifyAccessGate';

// /biz/notifications/channels/email — настройка Email-канала (F-05-066).
export default function Page() {
  return (
    <NotifyAccessGate>
      <EmailChannelScreen />
    </NotifyAccessGate>
  );
}
