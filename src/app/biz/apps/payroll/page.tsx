import { PayrollAppScreen } from '@/areas/client/apps/PayrollAppScreen';

// /biz/apps/payroll — раздел «client»: зарплата в приложении, «Расчёт» и «Выплаты» (F-14-127, F-14-128).
export default function Page() {
  // Свой расчёт — любому сотруднику (как «Моя зарплата» в вебе), выбор сотрудника — с payroll.manage (в экране и api)
  return <PayrollAppScreen />;
}
