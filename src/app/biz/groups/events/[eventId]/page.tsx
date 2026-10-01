import { EventWindowScreen } from '@/areas/resources/EventWindowScreen';

export default async function Page({ params }: PageProps<'/biz/groups/events/[eventId]'>) {
  const { eventId } = await params;
  return <EventWindowScreen eventId={eventId} />;
}
