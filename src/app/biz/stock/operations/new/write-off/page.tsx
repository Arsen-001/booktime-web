import { StockAccessGate } from '@/areas/stock/StockAccessGate';
import { OperationFormScreen } from '@/areas/stock/operations/OperationFormScreen';

// /biz/stock/operations/new/write-off — списание товара (F-08-058, F-00-140).
export default function Page() {
  return (
    <StockAccessGate need="canCreateOps">
      <OperationFormScreen mode="writeoff" />
    </StockAccessGate>
  );
}
