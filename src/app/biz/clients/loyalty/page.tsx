import { LoyaltyProgramScreen } from '@/areas/clients/LoyaltyProgramScreen';
import { PermissionGate } from '@/ui/PermissionGate';

// Правила скидок по тратам — право «loyalty.rules» (как на сервере): без него — «Нет доступа», а не ошибка загрузки
// с 403 в консоли (проход 17.11, администратор по умолчанию)
export default function Page() {
  return (
    <PermissionGate permission="loyalty.rules" fallback="message" className="mx-auto w-full max-w-[760px]">
      <LoyaltyProgramScreen />
    </PermissionGate>
  );
}
