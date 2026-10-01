'use client';

/**
 * /biz/finance/online/prepayment — «Предоплата» (F-07-088…095). Решение владельца 01.10.2026: предоплату
 * настраивает ОДНО место — правило мастера в настройках онлайн-записи (⭐ F-00-097: процент или сумма, куда
 * переводить, сколько ждать). Здесь — только просмотр: правило каждого мастера и ссылка «Изменить» туда; второго
 * редактора нет (раньше общий режим и списки услуг/сотрудников здесь онлайн-запись не читала).
 */
import Link from 'next/link';
import { ExternalLink, Percent } from 'lucide-react';
import { useCoreList } from '@/api/core';
import { useCurrent } from '@/demo/hooks';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { PageHeader } from '@/ui/PageHeader';
import { SectionCard } from '@/ui/SectionCard';
import { SkeletonText } from '@/ui/Skeleton';

const ONLINE_SETTINGS_HREF = '/biz/online/settings';

export function PrepaymentSettingsScreen() {
  const t = useT('finance');
  const format = useFormat();
  const { ready, businessId } = useCurrent();
  const staffQ = useCoreList('staff', { businessId: businessId ?? '' }, { enabled: ready && Boolean(businessId) });
  const staff = (staffQ.data ?? []).filter((s) => s.status === 'active' && !s.assistantOnly);

  return (
    <div data-f="F-07-088 F-07-089 F-07-090 F-07-091 F-07-092 F-07-093 F-07-094 F-07-095 F-07-097" className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
      <PageHeader back={{ href: '/biz/finance/online' }} title={t('online.prepayment.title')} description={t('online.prepayment.readOnlyHint')} />
      <SectionCard
        title={t('online.prepayment.byStaffTitle')}
        actions={
          <Link href={ONLINE_SETTINGS_HREF} className="inline-flex min-h-10 items-center gap-1 text-sm font-medium text-primary-text hover:underline">
            {t('online.prepayment.editInOnline')} <ExternalLink aria-hidden className="size-3.5" />
          </Link>
        }
      >
        {staffQ.isError ? (
          <ErrorState onRetry={() => staffQ.refetch()} />
        ) : !staffQ.data ? (
          <SkeletonText width="24ch" />
        ) : staff.length === 0 ? (
          <EmptyState compact icon={<Percent aria-hidden className="size-6" />} title={t('online.prepayment.staffEmpty')} />
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {staff.map((s) => {
              const rule = s.prepayment;
              return (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3">
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{s.name}</span>
                    {rule && (
                      <span className="text-xs text-muted">
                        {t('online.prepayment.ruleDetails', { minutes: rule.timeoutMin, requisites: rule.requisites || '—' })}
                      </span>
                    )}
                    {rule?.onlyAfterNoShows && (
                      <span className="text-xs text-muted" data-f="F-00-071">
                        {t('online.prepayment.ruleNoShows', { count: rule.onlyAfterNoShows.count, months: rule.onlyAfterNoShows.months })}
                      </span>
                    )}
                  </div>
                  {rule ? (
                    <Badge tone="info">{rule.percent ? t('online.prepayment.rulePercent', { percent: rule.percent }) : format.money(rule.amount)}</Badge>
                  ) : (
                    <Badge tone="neutral">{t('online.prepayment.ruleNone')}</Badge>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
