import { StockAccessGate } from '@/areas/stock/StockAccessGate';
import { OperationFormScreen } from '@/areas/stock/operations/OperationFormScreen';

// /biz/stock/operations/new/income — приход товара (F-08-054…057).
export default function Page() {
  return (
    <StockAccessGate need="canCreateOps">
      <OperationFormScreen mode="income" />
    </StockAccessGate>
  );
}
