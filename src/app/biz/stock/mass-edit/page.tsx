import { StockAccessGate } from '@/areas/stock/StockAccessGate';
import { MassEditScreen } from '@/areas/stock/MassEditScreen';

// /biz/stock/mass-edit — «Быстрое управление» (F-08-031).
export default function Page() {
  return (
    <StockAccessGate need="manageGoods">
      <MassEditScreen />
    </StockAccessGate>
  );
}
