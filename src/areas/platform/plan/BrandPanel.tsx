'use client';

/** Имя и домен (F-00-208): выбранное имя выделено, статус домена — выбором, остальным — «Выбрать». */
import { Check, Tag } from 'lucide-react';
import { chooseBrand, saveNameCandidate } from '@/api/platform';
import { useApiMutation } from '@/api/request';
import { useBrand, useNameCandidates } from '@/areas/platform/hooks/usePlatformData';
import type { DomainStatus } from '@/domain/platform';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { Select } from '@/ui/Select';
import { SkeletonList } from '@/ui/Skeleton';
import { useToast } from '@/ui/Toast';

const DOMAIN_STATUSES: DomainStatus[] = ['unknown', 'free', 'taken', 'bought'];

export function BrandPanel() {
  const t = useT('platform');
  const toast = useToast();
  const q = useNameCandidates();
  const brandQ = useBrand();
  const choose = useApiMutation(chooseBrand);
  const saveDomain = useApiMutation((a: { id: string; domainStatus: DomainStatus }) => saveNameCandidate(a.id, { domainStatus: a.domainStatus }));

  if (q.isError) return <ErrorState onRetry={q.refetch} />;
  if (q.isLoading) return <SkeletonList rows={4} avatar={false} cards />;
  if (!q.data?.length) return <EmptyState framed icon={<Tag aria-hidden />} title={t('plan.brandEmpty')} />;
  const chosenId = brandQ.data?.chosenId;

  const doChoose = async (id: string) => {
    try {
      await choose.mutate(id);
      toast.success(t('plan.brandChosen'));
    } catch {
      toast.error(t('plan.saveFailed'));
    }
  };
  const doDomain = async (id: string, domainStatus: DomainStatus) => {
    try {
      await saveDomain.mutate({ id, domainStatus });
    } catch {
      toast.error(t('plan.saveFailed'));
    }
  };

  return (
    <div data-f="F-00-208" className="grid gap-3 sm:grid-cols-2">
      {q.data.map((c) => {
        const chosen = c.id === chosenId;
        return (
          <div key={c.id} className={cn('flex flex-col gap-3 rounded-2xl border bg-surface p-4', chosen ? 'border-primary ring-2 ring-primary/20' : 'border-border')}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xl font-semibold text-fg">{c.name}</p>
                <p className="text-sm text-muted">{c.spelling.ru} · {c.spelling.hy} · {c.spelling.en}</p>
              </div>
              {chosen && <Badge tone="primary" icon={<Check aria-hidden />}>{t('plan.chosen')}</Badge>}
            </div>
            {c.note && <p className="text-sm text-muted">{c.note}</p>}
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm text-fg">{c.domain}</span>
              <Select size="sm" aria-label={t('plan.domainAria', { domain: c.domain })} value={c.domainStatus} onValueChange={(v) => void doDomain(c.id, v as DomainStatus)} options={DOMAIN_STATUSES.map((s) => ({ value: s, label: t(`plan.domainStatus.${s}`) }))} className="w-40" />
            </div>
            {!chosen && (
              <Button size="sm" variant="ghost" className="self-start" onClick={() => doChoose(c.id)} loading={choose.isPending}>
                {t('plan.choose')}
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
