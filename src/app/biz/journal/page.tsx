import { Suspense } from 'react';
import { JournalScreen } from '@/areas/journal/JournalScreen';
import { Skeleton } from '@/ui/Skeleton';

// /biz/journal — журнал записей (F-01-001…035, F-01-078, F-01-186…188, F-01-214, F-01-215).
export default function Page() {
  return (
    <Suspense fallback={<Skeleton variant="rect" className="h-96 w-full rounded-xl" />}>
      <JournalScreen />
    </Suspense>
  );
}
