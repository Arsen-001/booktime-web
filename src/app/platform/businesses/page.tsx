import { Suspense } from 'react';
import { BusinessesScreen } from '@/areas/platform/businesses/BusinessesScreen';

// Экран читает ?b= (открытая карточка) — useSearchParams требует границу Suspense
export default function Page() {
  return (
    <Suspense>
      <BusinessesScreen />
    </Suspense>
  );
}
