import { StockAccessGate } from '@/areas/stock/StockAccessGate';
import { EquipmentFormScreen } from '@/areas/stock/equipment/EquipmentFormScreen';

// /biz/stock/equipment/new — форма оборудования: создание (⭐ F-00-141).
export default function Page() {
  return (
    <StockAccessGate need="stock.edit">
      <EquipmentFormScreen />
    </StockAccessGate>
  );
}
