import { RescheduleScreen } from '@/areas/client/bookings/RescheduleScreen';

// /bookings/[bookingId]/reschedule — перенос записи клиентом (F-00-099, F-14-016)
export default async function Page({ params }: PageProps<'/bookings/[bookingId]/reschedule'>) {
  const { bookingId } = await params;
  return <RescheduleScreen bookingId={bookingId} />;
}
