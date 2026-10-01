import { Suspense } from 'react';
import { SlotsScreen } from '@/areas/schedule/slots/SlotsScreen';
import { Skeleton } from '@/ui/Skeleton';

export default function Page() {
  return (
    <Suspense fallback={<Skeleton variant="rect" className="h-96 w-full rounded-xl" />}>
      <SlotsScreen />
    </Suspense>
  );
}
