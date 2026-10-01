'use client';

import { useLocale } from 'next-intl';
import { ChevronRight, CreditCard, User } from 'lucide-react';
import { getPlanNearestDate, getPlanSlots, type PlanQuery } from '@/api/online';
import { useApiQuery } from '@/api/request';
import { planKey } from '@/areas/online/booking/wizard/plan';
import { useSpecialistTerms } from '@/areas/online/booking/wizard/specialistTerms';
import type { SphereId, Staff } from '@/domain/core';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { today } from '@/lib/date';
import { pickText } from '@/lib/text';
import { Avatar } from '@/ui/Avatar';
import { Badge } from '@/ui/Badge';
import { EmptyState } from '@/ui/EmptyState';
import { Skeleton } from '@/ui/Skeleton';

/**
 * Шаг «Мастер» (F-03-087, F-03-017, F-03-021). О23: у каждого мастера всегда видно, когда он свободен
 * («сегодня с 15:00» / «ср, 30 сент.»), и нажатие сразу ведёт на время — без поиска «Продолжить».
 * О5: у мастера с предоплатой — пометка «предоплата 7 000 ֏» ещё до выбора.
 */
export function StaffStep({
  staff,
  anyPool,
  selectedId,
  anyStaffAllowed,
  onSelect,
  sphereIds,
  planFor,
  hourCycle,
}: {
  staff: Staff[];
  /** Кого может назначить «любой» */
  anyPool: Staff[];
  selectedId: string | undefined;
  anyStaffAllowed: boolean;
  /** id мастера или 'any' */
  onSelect: (id: string) => void;
  sphereIds?: SphereId[];
  /** План окон для этих мастеров — для «ближайшего свободного» */
  planFor: (staffIds: string[]) => PlanQuery | undefined;
  hourCycle?: '24' | '12';
}) {
  const t = useT('online');
  const terms = useSpecialistTerms(sphereIds);
  const locale = useLocale();
  const format = useFormat();
  if (staff.length === 0) {
    return (
      <div data-f="F-03-089">
        <EmptyState title={t('booking.staffStep.noneTitle', terms)} description={t('booking.staffStep.noneDescription')} />
      </div>
    );
  }
  return (
    <ul className="flex flex-col gap-2" data-f="F-03-087 F-03-017 F-03-021 F-03-015">
      {anyStaffAllowed && anyPool.length > 1 && (
        <li>
          <button
            type="button"
            onClick={() => onSelect('any')}
            data-f="F-03-069"
            className={cn(
              'flex min-h-16 w-full items-center gap-3 rounded-xl border border-dashed px-3 py-2.5 text-left transition-colors',
              selectedId === 'any' ? 'border-primary bg-primary-soft' : 'border-border bg-surface hover:bg-surface-2',
            )}
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-text">
              <User aria-hidden className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium text-fg">{t('booking.staffStep.any', terms)}</span>
              <span className="block text-sm text-muted">{t('booking.staffStep.anyHint', terms)}</span>
            </span>
            <NearestBadge plan={planFor(anyPool.map((s) => s.id))} hourCycle={hourCycle} />
            <ChevronRight aria-hidden className="size-4 shrink-0 text-muted" />
          </button>
        </li>
      )}
      {staff.map((s) => {
        const secondary = s.position ? pickText(s.position, locale) : undefined;
        return (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => onSelect(s.id)}
              className={cn(
                'flex min-h-16 w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors',
                selectedId === s.id ? 'border-primary bg-primary-soft' : 'border-border bg-surface hover:bg-surface-2',
              )}
            >
              <Avatar name={s.name} src={s.avatarUrl} colorIndex={s.colorIndex} />
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-fg">{s.name}</span>
                {secondary && <span className="block text-sm text-muted">{secondary}</span>}
                {(s.accepts !== 'all' || (s.prepayment && s.prepayment.amount > 0)) && (
                  <span className="mt-1 flex flex-wrap gap-1">
                    {s.accepts !== 'all' && (
                      <span data-f="F-00-070">
                        <Badge tone="neutral" size="sm" variant="soft">
                          {t(s.accepts === 'women' ? 'public.acceptsWomen' : 'public.acceptsMen')}
                        </Badge>
                      </span>
                    )}
                    {s.prepayment && s.prepayment.amount > 0 && (
                      <span data-f="F-03-094">
                        <Badge tone="warning" size="sm" variant="soft" icon={<CreditCard aria-hidden />}>
                          {t('booking.staffStep.prepaymentBadge', { amount: format.money(s.prepayment.amount) })}
                        </Badge>
                      </span>
                    )}
                  </span>
                )}
              </span>
              <NearestBadge plan={planFor([s.id])} hourCycle={hourCycle} />
              <ChevronRight aria-hidden className="size-4 shrink-0 text-muted" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** «сегодня с 15:00» / «ср, 30 сент.» / «нет окон» — у каждого мастера (О23), ключи те же, что у шага времени */
export function NearestBadge({ plan, hourCycle }: { plan: PlanQuery | undefined; hourCycle?: '24' | '12' }) {
  const t = useT('online');
  const format = useFormat({ hourCycle });
  const key = planKey(plan);
  const now = today();
  const empty: PlanQuery = { businessId: '', legs: [] };
  const nearestQ = useApiQuery(['online', 'plan-nearest', key, now], () => getPlanNearestDate(plan ?? empty, now), { enabled: Boolean(plan) });
  const isToday = nearestQ.data === now;
  const slotsQ = useApiQuery(['online', 'plan-slots', key, now], () => getPlanSlots(plan ?? empty, now), {
    enabled: Boolean(plan) && isToday,
    keepPrevious: false,
  });
  if (!plan) return null;
  const loading = nearestQ.isLoading || (isToday && slotsQ.isLoading);
  return (
    <span className="w-24 shrink-0 text-right text-xs text-muted" data-f="F-03-015 F-02-077">
      {loading ? (
        <Skeleton className="ml-auto h-3.5 w-20" />
      ) : !nearestQ.data ? (
        t('booking.staffStep.noSlots')
      ) : isToday && slotsQ.data?.[0] ? (
        <span className="font-medium text-success">{t('booking.staffStep.todayFrom', { time: format.time(slotsQ.data[0].start) })}</span>
      ) : (
        format.date(nearestQ.data, 'weekday')
      )}
    </span>
  );
}
