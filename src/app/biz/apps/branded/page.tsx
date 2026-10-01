import { AppGate } from '@/areas/client/apps/AppGate';
import { BrandedAppScreen } from '@/areas/client/apps/BrandedAppScreen';

// /biz/apps/branded — раздел «client»: своё (брендированное) приложение салона (F-14-142…170).
export default function Page() {
  return (
    <AppGate permission="billing.manage">
      <BrandedAppScreen />
    </AppGate>
  );
}
