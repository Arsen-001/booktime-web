import { StockAccessGate } from '@/areas/stock/StockAccessGate';
import { SaleFormScreen } from '@/areas/stock/operations/SaleFormScreen';

// /biz/stock/operations/new/sale — панель «Продажа товара» (F-08-062…077, F-00-138).
export default function Page() {
  return (
    <StockAccessGate need="canCreateOps">
      <SaleFormScreen />
    </StockAccessGate>
  );
}
