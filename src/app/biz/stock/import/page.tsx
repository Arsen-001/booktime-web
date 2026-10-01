import { StockAccessGate } from '@/areas/stock/StockAccessGate';
import { ImportScreen } from '@/areas/stock/ImportScreen';

// /biz/stock/import — загрузка/обновление товаров из Excel (F-08-033, F-08-034, F-08-035).
export default function Page() {
  return (
    <StockAccessGate need="manageGoods">
      <ImportScreen />
    </StockAccessGate>
  );
}
