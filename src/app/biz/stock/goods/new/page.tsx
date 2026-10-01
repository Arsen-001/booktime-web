import { StockAccessGate } from '@/areas/stock/StockAccessGate';
import { GoodFormScreen } from '@/areas/stock/goods/GoodFormScreen';

// /biz/stock/goods/new — карточка товара: создание (F-08-017).
export default function Page() {
  return (
    <StockAccessGate need="manageGoods">
      <GoodFormScreen />
    </StockAccessGate>
  );
}
