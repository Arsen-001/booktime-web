import { SettlementsScreen } from '@/areas/finance/SettlementsScreen';

// /biz/payroll/settlements — «Взаиморасчёты» внутри раздела «Зарплата» (зарплата-ревью З21): тот же экран
// раздела finance (F-07-159…162), но по своему адресу — боковое меню остаётся в контексте «Зарплаты».
export default function Page() {
  return <SettlementsScreen />;
}
