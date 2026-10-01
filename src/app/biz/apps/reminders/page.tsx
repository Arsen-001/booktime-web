import { AppGate } from '@/areas/client/apps/AppGate';
import { RemindersScreen } from '@/areas/client/apps/RemindersScreen';

// /biz/apps/reminders — раздел «client»: клиенты без приложения — «Напомнить» (F-00-121).
export default function Page() {
  return (
    <AppGate permission="clients.phones">
      <RemindersScreen />
    </AppGate>
  );
}
