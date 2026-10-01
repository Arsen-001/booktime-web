import { Suspense } from 'react';
import { SlotsScreen } from '@/areas/schedule/slots/SlotsScreen';
import { Skeleton } from '@/ui/Skeleton';

export default async function Page({ params }: PageProps<'/biz/schedule/slots/[staffId]'>) {
  const { staffId } = await params;
  return (
    <Suspense fallback={<Skeleton variant="rect" className="h-96 w-full rounded-xl" />}>
      <SlotsScreen staffId={staffId} />
    </Suspense>
  );
}
