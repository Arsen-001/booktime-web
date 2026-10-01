import { MasterCardScreen } from '@/areas/client/masters/MasterCardScreen';

// /masters/[staffId]?service=… — карточка мастера для клиента (F-00-123); service — из поиска: окна под найденную услугу
export default async function Page({ params, searchParams }: PageProps<'/masters/[staffId]'>) {
  const { staffId } = await params;
  const { service } = await searchParams;
  return <MasterCardScreen staffId={staffId} serviceId={typeof service === 'string' ? service : undefined} />;
}
