import { AppGate } from '@/areas/client/apps/AppGate';
import { EventsAppScreen } from '@/areas/client/apps/EventsAppScreen';

// /biz/apps/events — раздел «client»: групповые события в приложении (F-14-106…109).
export default function Page() {
  return (
    <AppGate permission="journal.view">
      <EventsAppScreen />
    </AppGate>
  );
}
