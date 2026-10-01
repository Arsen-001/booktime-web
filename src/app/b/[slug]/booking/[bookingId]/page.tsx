import { BookingConfirmedScreen } from '@/areas/online/booking/BookingConfirmedScreen';

export default async function Page({
  params,
  searchParams,
}: PageProps<'/b/[slug]/booking/[bookingId]'>) {
  const { slug, bookingId } = await params;
  const sp = await searchParams;
  const hash = typeof sp.h === 'string' ? sp.h : undefined;
  return <BookingConfirmedScreen slug={slug} bookingId={bookingId} hash={hash} />;
}
