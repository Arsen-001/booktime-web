import { CardTypeFormScreen } from '@/areas/loyalty/card-types/CardTypeFormScreen';

// /biz/loyalty/card-types/[typeId] — правка и удаление типа карты (F-06-030).
export default async function Page({ params }: PageProps<'/biz/loyalty/card-types/[typeId]'>) {
  const { typeId } = await params;
  return <CardTypeFormScreen typeId={typeId} />;
}
