'use client';

import { useEffect } from 'react';
import { captureException } from '@sentry/nextjs';
import { ErrorState } from '@/ui/ErrorState';

// Страховка от падения экрана: вместо белого листа — «не получилось · повторить»
export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error('[app] экран упал', error);
    captureException(error);
  }, [error]);
  return (
    <div className="grid min-h-[60dvh] place-items-center px-4">
      <ErrorState onRetry={() => retry()} />
    </div>
  );
}
