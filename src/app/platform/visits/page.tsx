import { Suspense } from 'react';
import { VisitsScreen } from '@/areas/platform/visits/VisitsScreen';

// Экран читает ?draft= / ?open= из адреса — useSearchParams требует границу Suspense
export default function Page() {
  return (
    <Suspense>
      <VisitsScreen />
    </Suspense>
  );
}
