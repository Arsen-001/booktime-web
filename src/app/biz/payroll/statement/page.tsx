import { Suspense } from 'react';
import { StatementScreen } from '@/areas/payroll/StatementScreen';

// /biz/payroll/statement — «Расчётная ведомость» (F-09-067). Читает ?staffId=&from=&to= из адреса —
// useSearchParams требует границу Suspense.
export default function Page() {
  return (
    <Suspense>
      <StatementScreen />
    </Suspense>
  );
}
