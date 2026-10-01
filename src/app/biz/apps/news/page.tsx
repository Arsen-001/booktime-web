import { AppGate } from '@/areas/client/apps/AppGate';
import { NewsScreen } from '@/areas/client/apps/NewsScreen';

// /biz/apps/news — раздел «client»: новости подписчикам (F-00-114).
export default function Page() {
  return (
    <AppGate permission="notify.mailings">
      <NewsScreen />
    </AppGate>
  );
}
