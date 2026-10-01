import { Suspense } from 'react';
import { CalendarScreen } from '@/areas/schedule/CalendarScreen';
import { Skeleton } from '@/ui/Skeleton';

export default function Page() {
  return (
    <Suspense fallback={<Skeleton variant="rect" className="h-96 w-full rounded-xl" />}>
      <CalendarScreen />
    </Suspense>
  );
}
