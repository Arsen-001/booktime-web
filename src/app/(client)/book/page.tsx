import { BookScreen } from '@/areas/client/book/BookScreen';

// /book?staff=&slot=&service= — запись на выбранное свободное окно (F-00-031, F-00-108)
// /book?business=&service= (без staff) — запись «на любую услугу» этого места (F-14-029): сперва выбор
// мастера/услуги, дальше тот же поток
export default async function Page({ searchParams }: PageProps<'/book'>) {
  const sp = await searchParams;
  const staff = typeof sp.staff === 'string' ? sp.staff : undefined;
  const slot = typeof sp.slot === 'string' ? sp.slot : undefined;
  const service = typeof sp.service === 'string' ? sp.service : undefined;
  const business = typeof sp.business === 'string' ? sp.business : undefined;
  const story = typeof sp.story === 'string' ? sp.story : undefined;

  return <BookScreen staffId={staff} slot={slot} serviceId={service} businessId={business} storyId={story} />;
}
