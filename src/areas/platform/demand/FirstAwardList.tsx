'use client';

/** Награда первому (F-00-181): единственный в районе или во всём городе — 30 дней и 1 000 монет. */
import { useState } from 'react';
import { Award, Check } from 'lucide-react';
import { grantFirstAward } from '@/api/platform';
import { useApiMutation } from '@/api/request';
import { useFirstCandidates } from '@/areas/platform/hooks/usePlatformData';
import type { FirstCandidate } from '@/domain/platform';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Avatar } from '@/ui/Avatar';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { SectionCard } from '@/ui/SectionCard';
import { Skeleton, SkeletonText } from '@/ui/Skeleton';
import { useSkeletonCount } from '@/ui/hooks/useSkeletonCount';
import { useToast } from '@/ui/Toast';

const FIRST_DAYS = 30;
const FIRST_COINS = 1000;

export function FirstAwardList() {
  const t = useT('platform');
  const tc = useT('common');
  const fmt = useFormat();
  const toast = useToast();
  const q = useFirstCandidates();
  const [all, setAll] = useState(false);
  const grant = useApiMutation((c: FirstCandidate) => grantFirstAward(c.businessId, c.scope, c.sphereId, c.district, FIRST_DAYS, FIRST_COINS));
  const [granting, setGranting] = useState<string | null>(null);

  const doGrant = async (c: FirstCandidate) => {
    setGranting(c.key);
    try {
      await grant.mutate(c);
      toast.success(t('demand.firstAwardOk', { name: c.businessName }));
    } catch {
      toast.error(t('demand.firstAwardFailed'));
    } finally {
      setGranting(null);
    }
  };

  const rows = q.data ?? [];
  const visible = all ? rows : rows.slice(0, 6);
  const skeletonRows = useSkeletonCount('first-award', { loading: q.isLoading, count: q.data ? visible.length : undefined, fallback: 6, max: 6 });
  const skeletonMore = useSkeletonCount('first-award-more', { loading: q.isLoading, count: q.data ? Number(rows.length > 6) : undefined, fallback: 1 });
  return (
    <div data-f="F-00-181">
    <SectionCard title={t('demand.firstTitle')} description={t('demand.firstHint', { days: FIRST_DAYS, coins: fmt.number(FIRST_COINS) })} padding="none"
          classNames={{ body: 'mt-4 border-t border-border' }}>
      {q.isError ? (
        <ErrorState compact onRetry={q.refetch} />
      ) : q.isLoading ? (
        // Те же строки (аватар, имя, «где первый», кнопка) и та же кнопка «Показать все» под ними
        <>
          <ul className="flex flex-col divide-y divide-border">
            {Array.from({ length: skeletonRows }, (_, i) => (
              <li key={i} className="flex min-h-16 items-center gap-3 px-4 py-3">
                <Skeleton variant="circle" className="size-10 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-fg">
                    <SkeletonText width="18ch" />
                  </p>
                  <p className="text-sm text-muted">
                    <SkeletonText width="24ch" />
                  </p>
                </div>
                <Button size="sm" variant="outline" disabled>
                  {t('demand.firstAward')}
                </Button>
              </li>
            ))}
          </ul>
          {skeletonMore > 0 && (
            <div className="border-t border-border p-2">
              <Button variant="ghost" fullWidth disabled>
                <SkeletonText width="16ch" />
              </Button>
            </div>
          )}
        </>
      ) : !rows.length ? (
        <EmptyState variant="section" icon={<Award aria-hidden />} title={t('demand.firstEmpty')} />
      ) : (
        <>
          <ul className="flex flex-col divide-y divide-border">
            {visible.map((c) => (
              <li key={c.key} className="flex min-h-16 items-center gap-3 px-4 py-3">
                <Avatar name={c.businessName} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-fg">{c.businessName}</p>
                  <p className="text-sm text-muted">
                    {c.scope === 'sphere'
                      ? t('demand.firstInCity', { sphere: tc(`spheres.${c.sphereId}`) })
                      : t('demand.firstInDistrict', { sphere: tc(`spheres.${c.sphereId}`), district: c.district ? tc(`districts.${c.district}`) : '' })}
                  </p>
                </div>
                {c.awarded ? (
                  <Badge tone="success" icon={<Check aria-hidden />}>{t('demand.firstAwardedOn', { date: fmt.date(c.awarded.at, 'dayMonth') })}</Badge>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => doGrant(c)} loading={granting === c.key}>
                    {t('demand.firstAward')}
                  </Button>
                )}
              </li>
            ))}
          </ul>
          {rows.length > 6 && (
            <div className="border-t border-border p-2">
              <Button variant="ghost" fullWidth onClick={() => setAll((v) => !v)}>
                {all ? t('demand.showLess') : t('demand.showAllFirst', { n: rows.length })}
              </Button>
            </div>
          )}
        </>
      )}
    </SectionCard>
    </div>
  );
}
