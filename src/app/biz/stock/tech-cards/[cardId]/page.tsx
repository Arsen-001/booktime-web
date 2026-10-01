import { TechCardFormScreen } from '@/areas/stock/techcards/TechCardFormScreen';

// /biz/stock/tech-cards/[cardId] — просмотр и правка техкарты (F-08-037…039).
export default async function Page({ params }: PageProps<'/biz/stock/tech-cards/[cardId]'>) {
  const { cardId } = await params;
  return <TechCardFormScreen cardId={cardId} />;
}
