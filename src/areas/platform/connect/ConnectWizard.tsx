'use client';

/** Мастер подключения: грузит черновик, дальше — ConnectWizardBody со своим состоянием формы. */
import { ConnectWizardBody } from '@/areas/platform/connect/ConnectWizardBody';
import { useConnectDraft } from '@/areas/platform/hooks/usePlatformData';
import { useT } from '@/i18n/useT';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { LinkButton } from '@/ui/Button';
import { Skeleton } from '@/ui/Skeleton';
import { Store } from 'lucide-react';

export function ConnectWizard({ draftId }: { draftId: string }) {
  const t = useT('platform');
  const q = useConnectDraft(draftId);

  if (q.isError) return <ErrorState onRetry={q.refetch} />;
  if (q.isLoading || !q.data) {
    return (
      <div className="flex flex-col gap-6" aria-busy>
        <Skeleton className="h-9 w-2/3" />
        <Skeleton className="h-2 w-full" />
        <Skeleton variant="rect" className="h-80" />
      </div>
    );
  }
  if (q.data.status === 'done') {
    return (
      <EmptyState
        variant="page"
        icon={<Store aria-hidden />}
        title={t('connect.alreadyDone')}
        action={<LinkButton href={q.data.businessId ? `/platform/connect?done=${q.data.businessId}` : '/platform/connect'}>{t('connect.openResult')}</LinkButton>}
      />
    );
  }
  return <ConnectWizardBody draft={q.data} />;
}
