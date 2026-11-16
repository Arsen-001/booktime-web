import { PermissionGate } from '@/ui/PermissionGate';
import { PackagesListScreen } from '@/areas/resources/PackagesListScreen';

export default function Page() {
  // Пакеты читает и правит только «resources.manage» (сервер — 403): без права — «Нет доступа», а не «Не удалось загрузить»
  return (
    <PermissionGate permission="resources.manage" fallback="message">
      <PackagesListScreen />
    </PermissionGate>
  );
}
