import { Suspense } from 'react';
import { ConnectScreen } from '@/areas/platform/connect/ConnectScreen';

// Экран читает ?draft= / ?open= из адреса — useSearchParams требует границу Suspense
export default function Page() {
  return (
    <Suspense>
      <ConnectScreen />
    </Suspense>
  );
}
