import { BookingDetailScreen } from '@/areas/client/bookings/BookingDetailScreen';

// /bookings/[bookingId] — детали записи клиента (F-14-011…F-14-057, F-00-097…102, 107, 118, 125)
export default async function Page({ params }: PageProps<'/bookings/[bookingId]'>) {
  const { bookingId } = await params;
  return <BookingDetailScreen bookingId={bookingId} />;
}
