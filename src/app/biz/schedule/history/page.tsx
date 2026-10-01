import { Suspense } from 'react';
import { HistoryScreen } from '@/areas/schedule/history/HistoryScreen';
import { Skeleton } from '@/ui/Skeleton';

export default function Page() {
  return (
    <Suspense fallback={<Skeleton variant="rect" className="h-96 w-full rounded-xl" />}>
      <HistoryScreen />
    </Suspense>
  );
}
