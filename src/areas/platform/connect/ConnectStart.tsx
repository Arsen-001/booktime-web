'use client';

/** Старт «Подключить салон»: что будет и сколько займёт; начатые подключения — карточками «Продолжить». */
import { useRouter } from 'next/navigation';
import { ChevronRight, Plus, Store } from 'lucide-react';
import { startConnectDraft } from '@/api/platform';
import { useApiMutation } from '@/api/request';
import { useConnectDrafts } from '@/areas/platform/hooks/usePlatformData';
import { CONNECT_STEPS } from '@/areas/platform/connect/connectForm';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { PageHeader } from '@/ui/PageHeader';
import { SkeletonText } from '@/ui/Skeleton';
import { useSkeletonCount } from '@/ui/hooks/useSkeletonCount';
import { StickyActionBar } from '@/ui/StickyActionBar';
import { useToast } from '@/ui/Toast';

export function ConnectStart({ visitId }: { visitId?: string }) {
  const t = useT('platform');
  const fmt = useFormat();
  const toast = useToast();
  const router = useRouter();
  const q = useConnectDrafts();
  const start = useApiMutation(startConnectDraft);

  const begin = async () => {
    try {
      const draft = await start.mutate({ visitId });
      router.push(`/platform/connect?draft=${draft.id}`);
    } catch {
      toast.error(t('connect.startFailed'));
    }
  };

  const startButton = (className?: string) => (
    <Button className={className} leftIcon={<Plus aria-hidden />} onClick={begin} loading={start.isPending}>
      {t('connect.start')}
    </Button>
  );
  const hasDrafts = Boolean(q.data?.length);
  // Обычно начатых нет (демо — ноль): до ответа — то же пустое состояние; были в прошлый раз — столько же карточек
  const skeletonDrafts = useSkeletonCount('drafts', { loading: q.isLoading, count: q.data?.length, fallback: 0 });
  const draftsLayout = hasDrafts || (q.isLoading && skeletonDrafts > 0);

  return (
    <div data-f="F-00-176 F-02-100" className="flex flex-col gap-6">
      <PageHeader title={t('connect.title')} description={t('connect.subtitle')} actions={draftsLayout ? startButton('max-md:hidden') : undefined} />

      {q.isError ? (
        <ErrorState onRetry={q.refetch} />
      ) : q.isLoading && skeletonDrafts > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-fg">{t('connect.draftsTitle')}</h2>
          <ul className="flex flex-col gap-3">
            {Array.from({ length: skeletonDrafts }, (_, i) => (
              <li key={i}>
                <Card className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-fg">
                      <SkeletonText width="18ch" />
                    </p>
                    <p className="text-sm text-muted">
                      <SkeletonText width="26ch" />
                    </p>
                  </div>
                  <span className="flex items-center gap-1 text-sm font-medium text-primary-text">
                    {t('connect.resume')}
                    <ChevronRight aria-hidden className="size-4" />
                  </span>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : !hasDrafts ? (
        <EmptyState
          variant="page"
          framed
          icon={<Store aria-hidden />}
          title={q.isLoading ? <SkeletonText width="22ch" /> : t('connect.emptyTitle')}
          description={t('connect.emptyText')}
          action={startButton()}
        />
      ) : (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-fg">{t('connect.draftsTitle')}</h2>
          <ul className="flex flex-col gap-3">
            {q.data?.map((d) => (
              <li key={d.id}>
                <Card interactive href={`/platform/connect?draft=${d.id}`} className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-fg">{d.name || t('connect.untitled')}</p>
                    <p className="text-sm text-muted">
                      {t('connect.stoppedAt', { step: t(`connect.step.${CONNECT_STEPS[Math.min(d.step, CONNECT_STEPS.length - 1)]}`) })} ·{' '}
                      {fmt.ago(d.startedAt)}
                    </p>
                  </div>
                  <span className="flex items-center gap-1 text-sm font-medium text-primary-text">
                    {t('connect.resume')}
                    <ChevronRight aria-hidden className="size-4" />
                  </span>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}

      {draftsLayout && <StickyActionBar desktop="hidden">{startButton()}</StickyActionBar>}
    </div>
  );
}
