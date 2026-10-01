'use client';

/**
 * Сводка доставляемости над журналом (Ув11): сколько ушло за период, сколько дошло/прочитано, сколько не дошло и во
 * сколько обошлось. Считается по тем же отфильтрованным строкам, что и таблица.
 */
import { CheckCheck, CircleAlert, Send, Wallet } from 'lucide-react';
import type { LogMessage, LogStatus } from '@/domain/notify';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { StatCard } from '@/ui/StatCard';

const DELIVERED: readonly LogStatus[] = ['delivered', 'read'];
const FAILED: readonly LogStatus[] = ['notDelivered', 'rejected', 'rejectedByOperator', 'insufficientFunds', 'rejectedByRateLimiter'];

export interface LogSummaryProps {
  rows: LogMessage[];
  loading: boolean;
}

export function LogSummary({ rows, loading }: LogSummaryProps) {
  const t = useT('notify');
  const format = useFormat();
  const total = rows.length;
  const delivered = rows.filter((r) => DELIVERED.includes(r.status)).length;
  const failed = rows.filter((r) => FAILED.includes(r.status)).length;
  const cost = rows.reduce((sum, r) => sum + (r.costAmd ?? 0), 0);
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard loading={loading} icon={<Send aria-hidden />} label={t('log.summary.sent')} value={format.number(total)} />
      <StatCard
        loading={loading}
        icon={<CheckCheck aria-hidden />}
        label={t('log.summary.delivered')}
        value={format.number(delivered)}
        hint={t('log.summary.share', { pct: pct(delivered) })}
      />
      <StatCard
        loading={loading}
        icon={<CircleAlert aria-hidden />}
        label={t('log.summary.failed')}
        value={format.number(failed)}
        hint={t('log.summary.share', { pct: pct(failed) })}
      />
      <StatCard loading={loading} icon={<Wallet aria-hidden />} label={t('log.summary.cost')} value={format.money(cost)} />
    </div>
  );
}
