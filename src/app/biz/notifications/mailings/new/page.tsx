import { NewMailingScreen } from '@/areas/notify/NewMailingScreen';
import { NotifyAccessGate } from '@/areas/notify/NotifyAccessGate';

// /biz/notifications/mailings/new — новая рассылка (F-05-093…F-05-099).
export default function Page() {
  return (
    <NotifyAccessGate extra="notify.mailings">
      <NewMailingScreen />
    </NotifyAccessGate>
  );
}
