'use client';

/** Окупаемость (F-00-206): грузит сохранённые вводные и отдаёт форму с живым пересчётом. */
import { PaybackForm } from '@/areas/platform/plan/PaybackForm';
import { usePaybackInputs } from '@/areas/platform/hooks/usePlatformData';
import { ErrorState } from '@/ui/ErrorState';
import { Skeleton } from '@/ui/Skeleton';

export function PaybackPanel() {
  const q = usePaybackInputs();
  if (q.isError) return <ErrorState onRetry={q.refetch} />;
  if (q.isLoading || !q.data) return <Skeleton variant="rect" className="h-96" />;
  return <PaybackForm initial={q.data} />;
}
