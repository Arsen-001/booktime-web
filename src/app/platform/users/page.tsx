import { Suspense } from 'react';
import { UsersScreen } from '@/areas/platform/users/UsersScreen';

// Экран читает ?u= (открытая карточка) — useSearchParams требует границу Suspense
export default function Page() {
  return (
    <Suspense>
      <UsersScreen />
    </Suspense>
  );
}
