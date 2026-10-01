import { GoodPriceTagScreen } from '@/areas/stock/goods/GoodPriceTagScreen';

// /biz/stock/goods/[goodId]/price-tag — «Ценник в PDF» из карточки товара (F-08-095).
export default async function Page({ params }: PageProps<'/biz/stock/goods/[goodId]/price-tag'>) {
  const { goodId } = await params;
  return <GoodPriceTagScreen goodId={goodId} />;
}
