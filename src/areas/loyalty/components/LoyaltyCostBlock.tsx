'use client';

/**
 * Л16: «Сколько стоит лояльность» на хабе — скидки, начисленные/потраченные/сгоревшие бонусы за 30 дней и долг
 * бизнеса клиентам (бонусы на картах, непогашенные сертификаты). Свой запрос и свой скелет той же сетки —
 * плитки хаба над ним не ждут и не перерисовываются. Wallet — только пометка «в планах».
 */
import { Smartphone } from 'lucide-react';
import { getLoyaltyCostReport } from '@/api/loyalty';
import { useApiQuery } from '@/api/request';
import type { Id } from '@/domain/core';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { dayjs, toISODate, today } from '@/lib/date';
import { Badge } from '@/ui/Badge';
import { SectionCard } from '@/ui/SectionCard';
import { StatCard } from '@/ui/StatCard';

export function LoyaltyCostBlock({ businessId }: { businessId?: Id }) {
  const t = useT('loyalty');
  const format = useFormat();
  const dateFrom = toISODate(dayjs(today()).subtract(30, 'day'));
  const q = useApiQuery(['loyalty', 'costReport', businessId, dateFrom], () => getLoyaltyCostReport(businessId!, { dateFrom }), { enabled: Boolean(businessId) });
  const d = q.data;
  const loading = q.isLoading || !d;
  return (
    <SectionCard title={t('hub.cost.title')} description={t('hub.cost.description')}>
      <div data-f="F-06-172" className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <StatCard loading={loading} label={t('hub.cost.discounts')} value={format.money(d?.discounts ?? 0)} />
          <StatCard loading={loading} label={t('hub.cost.bonusesAccrued')} value={format.money(d?.bonusesAccrued ?? 0)} />
          <StatCard loading={loading} label={t('hub.cost.bonusesSpent')} value={format.money(d?.bonusesSpent ?? 0)} />
          <StatCard loading={loading} label={t('hub.cost.bonusesBurnt')} value={format.money(d?.bonusesBurnt ?? 0)} />
          <StatCard loading={loading} label={t('hub.cost.bonusesOutstanding')} value={format.money(d?.bonusesOutstanding ?? 0)} />
          <StatCard
            loading={loading}
            label={t('hub.cost.certificatesOutstanding')}
            value={format.money(d?.certificatesOutstanding ?? 0)}
            hint={t('hub.cost.certificatesCount', { count: d?.certificatesOutstandingCount ?? 0 })}
          />
        </div>
        <div className="flex items-start gap-3 rounded-xl border border-dashed border-border px-4 py-3">
          <Smartphone aria-hidden className="mt-0.5 size-5 shrink-0 text-muted" />
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-fg">
              {t('hub.cost.walletTitle')}
              <Badge tone="neutral" size="sm">
                {t('hub.cost.walletBadge')}
              </Badge>
            </p>
            <p className="text-sm text-muted">{t('hub.cost.walletText')}</p>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
