import { PromotionEditScreen } from '@/areas/loyalty/promotions/PromotionEditScreen';

// /biz/loyalty/promotions/[promotionId] — правка и удаление акции (F-06-050).
export default async function Page({ params }: PageProps<'/biz/loyalty/promotions/[promotionId]'>) {
  const { promotionId } = await params;
  return <PromotionEditScreen promotionId={promotionId} />;
}
