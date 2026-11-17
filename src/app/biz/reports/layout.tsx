import { ReportsAccessGate } from '@/areas/reports/ReportsAccessGate';

// Отчёты — данные о деньгах и работе всего салона: без reports.view закрыты по прямому адресу, а не только скрыты в
// меню (по образцу src/app/biz/finance/layout.tsx); запросы экранов не уходят на сервер.
export default function ReportsLayout({ children }: LayoutProps<'/biz/reports'>) {
  return <ReportsAccessGate>{children}</ReportsAccessGate>;
}
