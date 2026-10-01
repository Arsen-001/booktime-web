import { WarehouseFormScreen } from '@/areas/stock/warehouses/WarehouseFormScreen';

// /biz/stock/warehouses/[warehouseId] — форма склада: правка, удаление (F-08-007, F-08-008).
export default async function Page({ params }: PageProps<'/biz/stock/warehouses/[warehouseId]'>) {
  const { warehouseId } = await params;
  return <WarehouseFormScreen warehouseId={warehouseId} />;
}
