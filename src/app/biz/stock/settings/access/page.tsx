import { StockAccessGate } from '@/areas/stock/StockAccessGate';
import { StockStaffPermissionsScreen } from '@/areas/stock/StockStaffPermissionsScreen';

// /biz/stock/settings/access — F-08-109…118: права сотрудников на склад.
export default function Page() {
  return (
    <StockAccessGate need="staff.manage">
      <StockStaffPermissionsScreen />
    </StockAccessGate>
  );
}
