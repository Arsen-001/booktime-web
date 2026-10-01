import { StockAccessGate } from '@/areas/stock/StockAccessGate';
import { TechCardFormScreen } from '@/areas/stock/techcards/TechCardFormScreen';

// /biz/stock/tech-cards/new — создание техкарты (F-08-037).
export default function Page() {
  return (
    <StockAccessGate need="techCardEdit">
      <TechCardFormScreen />
    </StockAccessGate>
  );
}
