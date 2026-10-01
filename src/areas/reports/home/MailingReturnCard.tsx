'use client';

/**
 * «Отдача от рассылок» на главной: сколько получателей записались в течение 7 дней после рассылки периода и на какую
 * сумму (по цене записи — это ещё не полученные деньги, поэтому подпись это говорит). Рассылок не было — блока нет.
 */
import { Megaphone } from 'lucide-react';
import type { MailingReturn } from '@/domain/reports';
import { useCan } from '@/demo/hooks';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { LinkButton } from '@/ui/Button';
import { SectionCard } from '@/ui/SectionCard';
import { SkeletonText } from '@/ui/Skeleton';

export function MailingReturnCard({ data, loading }: { data: MailingReturn | null; loading: boolean }) {
  const t = useT('reports');
  const f = useFormat();
  const canMail = useCan('notify.mailings');
  const share = data && data.recipients > 0 ? Math.round((data.bookedClients / data.recipients) * 100) : 0;

  return (
    <SectionCard
      title={
        <span className="flex items-center gap-2">
          <Megaphone aria-hidden className="size-4 text-primary-text" />
          {t('home.mailings.title')}
        </span>
      }
      description={t('home.mailings.description', {
        days: data?.windowDays ?? 7,
      })}
      actions={
        canMail ? (
          <LinkButton href="/biz/notifications/mailings" variant="secondary" size="sm">
            {t('home.mailings.action')}
          </LinkButton>
        ) : undefined
      }
    >
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Cell
          loading={loading}
          value={data ? t('home.mailings.sent', { n: data.mailings }) : ''}
          sub={data ? t('home.mailings.recipients', { n: data.recipients }) : ''}
        />
        <Cell
          loading={loading}
          value={data ? t('home.mailings.booked', { n: data.bookedClients }) : ''}
          sub={data ? t('home.mailings.bookedShare', { pct: share }) : ''}
        />
        <Cell
          loading={loading}
          value={
            data
              ? t('home.mailings.amount', {
                  amount: f.money(data.bookedAmount),
                })
              : ''
          }
          sub={data ? t('home.mailings.amountSub', { n: data.bookings }) : ''}
        />
      </dl>
    </SectionCard>
  );
}

function Cell({ value, sub, loading }: { value: string; sub: string; loading: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-lg font-semibold text-fg tabular-nums">{loading ? <SkeletonText width="12ch" /> : value}</dt>
      <dd className="text-[13px] text-muted">{loading ? <SkeletonText width="10ch" /> : sub}</dd>
    </div>
  );
}
