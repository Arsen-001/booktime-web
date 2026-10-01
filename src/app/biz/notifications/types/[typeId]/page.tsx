import { NotifyAccessGate } from '@/areas/notify/NotifyAccessGate';
import { TypeDetailScreen } from '@/areas/notify/types/TypeDetailScreen';

// /biz/notifications/types/[typeId] — «Основные настройки» типа (F-05-005, F-05-006, F-05-007, F-05-008).
export default function Page() {
  return (
    <NotifyAccessGate>
      <TypeDetailScreen tab="basic" />
    </NotifyAccessGate>
  );
}
