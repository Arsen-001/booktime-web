import { PublicOrderPage } from '@/areas/orders/public/PublicOrderPage';
import { fetchPublicOrder } from '@/areas/orders/public/publicOrder.server';

// Режим api: статус приходит с сервера уже в HTML (без скелетона), экран дочитывает его в браузере.
export default async function Page({ params }: PageProps<'/o/[code]'>) {
  const { code } = await params;
  const initial = await fetchPublicOrder(code);
  return <PublicOrderPage code={code} initialData={initial} />;
}
