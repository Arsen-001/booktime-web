import { Suspense } from 'react';
import { SeriesScreen } from '@/areas/schedule/series/SeriesScreen';
import { Skeleton } from '@/ui/Skeleton';

export default function Page() {
  return (
    <Suspense fallback={<Skeleton variant="rect" className="h-96 w-full rounded-xl" />}>
      <SeriesScreen />
    </Suspense>
  );
}
