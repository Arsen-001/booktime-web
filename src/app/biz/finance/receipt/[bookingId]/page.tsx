import { ReceiptScreen } from '@/areas/finance/ReceiptScreen';

// /biz/finance/receipt/[bookingId] — нефискальный чек визита (F-07-148).
export default async function Page({ params }: PageProps<'/biz/finance/receipt/[bookingId]'>) {
  const { bookingId } = await params;
  return <ReceiptScreen bookingId={bookingId} />;
}
