import { PermissionGate } from '@/ui/PermissionGate';
import { PackageFormScreen } from '@/areas/resources/PackageFormScreen';

export default async function Page({ params }: PageProps<'/biz/resources/packages/[packageId]'>) {
  const { packageId } = await params;
  // Пакеты читает и правит только «resources.manage» (сервер — 403): без права — «Нет доступа», а не «Не удалось загрузить»
  return (
    <PermissionGate permission="resources.manage" fallback="message">
      <PackageFormScreen packageId={packageId} />
    </PermissionGate>
  );
}
