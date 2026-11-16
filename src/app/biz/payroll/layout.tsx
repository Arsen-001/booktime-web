import { PayrollAccessGate } from '@/areas/payroll/PayrollAccessGate';

// Раздел «Зарплата» закрыт по прямому адресу без payroll.view / payroll.manage (кроме «Моей зарплаты»), а не только
// скрыт в меню — по образцу src/app/biz/finance/layout.tsx (проход 17.11)
export default function PayrollLayout({ children }: LayoutProps<'/biz/payroll'>) {
  return <PayrollAccessGate>{children}</PayrollAccessGate>;
}
