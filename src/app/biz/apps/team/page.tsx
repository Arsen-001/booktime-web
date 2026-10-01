import { AppGate } from '@/areas/client/apps/AppGate';
import { TeamAppScreen } from '@/areas/client/apps/TeamAppScreen';

// /biz/apps/team — раздел «client»: сотрудники в приложении (F-14-116…120, F-14-125).
export default function Page() {
  return (
    <AppGate permission="staff.view">
      <TeamAppScreen />
    </AppGate>
  );
}
