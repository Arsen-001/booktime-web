import { AppGate } from '@/areas/client/apps/AppGate';
import { VisitAppScreen } from '@/areas/client/apps/VisitAppScreen';

// /biz/apps/visit — раздел «client»: визит и оплата в приложении (F-14-092, F-14-094…098, F-14-102, F-14-074).
export default function Page() {
  return (
    <AppGate permission="journal.view">
      <VisitAppScreen />
    </AppGate>
  );
}
