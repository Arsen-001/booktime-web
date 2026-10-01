import { StockAccessGate } from '@/areas/stock/StockAccessGate';
import { MoveFormScreen } from '@/areas/stock/operations/MoveFormScreen';

// /biz/stock/operations/new/move — перемещение между складами, в т.ч. выдача мастеру (F-08-059).
export default function Page() {
  return (
    <StockAccessGate need="canMoveOps">
      <MoveFormScreen />
    </StockAccessGate>
  );
}
