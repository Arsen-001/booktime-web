import { WhatsAppScreen } from '@/areas/notify/channels/WhatsAppScreen';
import { NotifyAccessGate } from '@/areas/notify/NotifyAccessGate';

// /biz/notifications/channels/whatsapp — WhatsApp через Altegio: Notification Sender, Embedded Signup, Coexistence (F-05-071…074).
export default function Page() {
  return (
    <NotifyAccessGate>
      <WhatsAppScreen />
    </NotifyAccessGate>
  );
}
