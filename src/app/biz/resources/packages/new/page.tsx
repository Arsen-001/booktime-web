import { PermissionGate } from '@/ui/PermissionGate';
import { PackageCreateScreen } from '@/areas/resources/PackageCreateScreen';

export default function Page() {
  // Пакеты читает и правит только «resources.manage» (сервер — 403): без права — «Нет доступа», а не «Не удалось загрузить»
  return (
    <PermissionGate permission="resources.manage" fallback="message">
      <PackageCreateScreen />
    </PermissionGate>
  );
}
