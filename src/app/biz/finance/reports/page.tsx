import { ReportsScreen } from '@/areas/finance/ReportsScreen';

// /biz/finance/reports (F-07-176) — своя короткая карточка вместо заглушки «раздел строится»;
// полные финансовые отчёты (F-12-*) строит раздел «reports», ссылка ведёт туда.
export default function Page() {
  return <ReportsScreen />;
}
