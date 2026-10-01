import { InventoryDetailScreen } from '@/areas/stock/InventoryDetailScreen';

// /biz/stock/inventory/[inventoryId] — таблица инвентаризации (F-08-082…089).
export default async function Page({ params }: PageProps<'/biz/stock/inventory/[inventoryId]'>) {
  const { inventoryId } = await params;
  return <InventoryDetailScreen inventoryId={inventoryId} />;
}
