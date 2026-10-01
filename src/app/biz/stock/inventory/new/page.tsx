import { StockAccessGate } from '@/areas/stock/StockAccessGate';
import { InventoryNewScreen } from '@/areas/stock/InventoryNewScreen';

// /biz/stock/inventory/new — новая инвентаризация (F-08-080/081).
export default function Page() {
  return (
    <StockAccessGate need="inventoryCreate">
      <InventoryNewScreen />
    </StockAccessGate>
  );
}
