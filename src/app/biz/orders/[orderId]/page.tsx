import { OrderDetailScreen } from '@/areas/orders/detail/OrderDetailScreen';

export default async function Page({ params }: PageProps<'/biz/orders/[orderId]'>) {
  const { orderId } = await params;
  return <OrderDetailScreen orderId={orderId} />;
}
