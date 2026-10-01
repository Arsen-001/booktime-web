import { MailingsListScreen } from '@/areas/notify/MailingsListScreen';
import { NotifyAccessGate } from '@/areas/notify/NotifyAccessGate';

// /biz/notifications/mailings — список рассылок (F-05-092, F-05-095).
export default function Page() {
  return (
    <NotifyAccessGate extra="notify.mailings">
      <MailingsListScreen />
    </NotifyAccessGate>
  );
}
