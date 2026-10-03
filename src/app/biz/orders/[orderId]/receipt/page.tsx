import { ReceiptScreen } from '@/areas/orders/receipt/ReceiptScreen';

export default async function Page({ params }: PageProps<'/biz/orders/[orderId]/receipt'>) {
  const { orderId } = await params;
  return <ReceiptScreen orderId={orderId} />;
}
