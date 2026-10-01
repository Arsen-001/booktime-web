import { SmsChannelScreen } from '@/areas/notify/channels/SmsChannelScreen';
import { NotifyAccessGate } from '@/areas/notify/NotifyAccessGate';

// /biz/notifications/channels/sms — подключение SMS-агрегатора (F-05-068).
export default function Page() {
  return (
    <NotifyAccessGate>
      <SmsChannelScreen />
    </NotifyAccessGate>
  );
}
