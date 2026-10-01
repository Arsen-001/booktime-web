import { GoodFormScreen } from '@/areas/stock/goods/GoodFormScreen';

// /biz/stock/goods/[goodId] — карточка товара: правка, архив, удаление (F-08-026, F-08-027).
export default async function Page({ params }: PageProps<'/biz/stock/goods/[goodId]'>) {
  const { goodId } = await params;
  return <GoodFormScreen goodId={goodId} />;
}
