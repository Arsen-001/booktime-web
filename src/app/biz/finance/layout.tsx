import { FinanceAccessGate } from '@/areas/finance/FinanceAccessGate';

// F-07-166: раздел «Финансы» несёт данные о деньгах бизнеса — закрыт по прямому URL без finance.view,
// а не только скрыт в меню (по образцу src/app/biz/loyalty/layout.tsx).
export default function FinanceLayout({ children }: LayoutProps<'/biz/finance'>) {
  return <FinanceAccessGate>{children}</FinanceAccessGate>;
}
