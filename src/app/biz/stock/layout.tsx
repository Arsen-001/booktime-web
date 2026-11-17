import { StockViewGate } from '@/areas/stock/StockViewGate';

// Ответ 17 (17.11.2026): без stock.edit — только товары и остатки, прямой адрес остального закрыт
export default function StockLayout({ children }: LayoutProps<'/biz/stock'>) {
  return <StockViewGate>{children}</StockViewGate>;
}
