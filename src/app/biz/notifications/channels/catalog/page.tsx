import { CatalogScreen } from '@/areas/notify/channels/CatalogScreen';
import { NotifyAccessGate } from '@/areas/notify/NotifyAccessGate';

// /biz/notifications/channels/catalog — каталог SMS-агрегаторов и ботов-партнёров (F-05-069, F-05-070, F-05-075).
export default function Page() {
  return (
    <NotifyAccessGate>
      <CatalogScreen />
    </NotifyAccessGate>
  );
}
