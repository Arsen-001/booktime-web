import { PlaceCardScreen } from '@/areas/client/places/PlaceCardScreen';

// /places/[businessId] — карточка места для клиента (F-14-028, F-14-030)
export default async function Page({ params }: PageProps<'/places/[businessId]'>) {
  const { businessId } = await params;
  return <PlaceCardScreen businessId={businessId} />;
}
