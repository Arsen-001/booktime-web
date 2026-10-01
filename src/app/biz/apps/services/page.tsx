import { AppGate } from '@/areas/client/apps/AppGate';
import { ServicesAppScreen } from '@/areas/client/apps/ServicesAppScreen';

// /biz/apps/services — раздел «client»: услуги, категории и пакеты в приложении (F-14-114, F-14-115).
export default function Page() {
  return (
    <AppGate permission="services.view">
      <ServicesAppScreen />
    </AppGate>
  );
}
