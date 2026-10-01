import { WizardLoading } from '@/areas/online/booking/WizardLoading';

// Мгновенный отклик на переход из публичной страницы (F-03-012): пока данные визарда грузятся, клиент сразу видит
// скелетон — тот же, что у мастера записи до данных (DESIGN.md «The skeleton IS the page»). Файл раздела online.
export default function BookLoading() {
  return <WizardLoading />;
}
