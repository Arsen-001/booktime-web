import { StockAccessGate } from '@/areas/stock/StockAccessGate';
import { StockSettingsScreen } from '@/areas/stock/StockSettingsScreen';

// /biz/stock/settings — настройки склада: себестоимость, срок предупреждения (F-08-096…098).
export default function Page() {
  return (
    <StockAccessGate need="settings.manage">
      <StockSettingsScreen />
    </StockAccessGate>
  );
}
