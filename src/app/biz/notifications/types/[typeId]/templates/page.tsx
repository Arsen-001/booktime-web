import { NotifyAccessGate } from '@/areas/notify/NotifyAccessGate';
import { TypeDetailScreen } from '@/areas/notify/types/TypeDetailScreen';

// /biz/notifications/types/[typeId]/templates — «Шаблоны уведомлений» типа (F-05-013).
export default function Page() {
  return (
    <NotifyAccessGate>
      <TypeDetailScreen tab="templates" />
    </NotifyAccessGate>
  );
}
