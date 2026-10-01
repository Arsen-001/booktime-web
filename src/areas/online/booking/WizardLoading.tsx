'use client';

import { useParams } from 'next/navigation';
import { WizardSkeleton } from '@/areas/online/booking/BookingWizard';

/** Скелетон мастера записи для перехода на /b/<slug>/book (loading.tsx) — тот же, что у самого мастера до данных */
export function WizardLoading() {
  const params = useParams<{ slug: string }>();
  return <WizardSkeleton slug={params?.slug ?? ''} />;
}
