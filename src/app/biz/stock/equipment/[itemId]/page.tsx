import { EquipmentFormScreen } from '@/areas/stock/equipment/EquipmentFormScreen';

// /biz/stock/equipment/[itemId] — форма оборудования: правка, удаление (⭐ F-00-141).
export default async function Page({ params }: PageProps<'/biz/stock/equipment/[itemId]'>) {
  const { itemId } = await params;
  return <EquipmentFormScreen itemId={itemId} />;
}
