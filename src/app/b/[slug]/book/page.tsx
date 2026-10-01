import { BookingWizard } from '@/areas/online/booking/BookingWizard';

export default async function Page({ params }: PageProps<'/b/[slug]/book'>) {
  const { slug } = await params;
  return <BookingWizard slug={slug} />;
}
