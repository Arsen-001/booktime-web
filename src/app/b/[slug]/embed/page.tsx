import { BookingWizard } from '@/areas/online/booking/BookingWizard';

// Версия виджета для встраивания в iframe на сайте (F-03-032). Тот же путь записи, что и /book —
// у формы уже есть мобильная и десктопная вёрстка, iframe задаёт размер параметрами width/height.
export default async function Page({ params }: PageProps<'/b/[slug]/embed'>) {
  const { slug } = await params;
  return (
    <div data-f="F-03-032">
      <BookingWizard slug={slug} />
    </div>
  );
}
