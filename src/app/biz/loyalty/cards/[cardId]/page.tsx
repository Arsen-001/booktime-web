import { CardDetailScreen } from '@/areas/loyalty/cards/CardDetailScreen';

// /biz/loyalty/cards/[cardId] — страница карты (F-06-059).
export default async function Page({ params }: PageProps<'/biz/loyalty/cards/[cardId]'>) {
  const { cardId } = await params;
  return <CardDetailScreen cardId={cardId} />;
}
