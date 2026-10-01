import { StockAccessGate } from '@/areas/stock/StockAccessGate';
import { WarehouseFormScreen } from '@/areas/stock/warehouses/WarehouseFormScreen';

// /biz/stock/warehouses/new — форма склада: создание (F-08-007).
export default function Page() {
  return (
    <StockAccessGate need="stock.edit">
      <WarehouseFormScreen />
    </StockAccessGate>
  );
}
