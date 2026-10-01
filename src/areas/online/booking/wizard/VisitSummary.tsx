'use client';

import { useLocale } from 'next-intl';
import { Clock, MapPin, Pencil } from 'lucide-react';
import type { PlanLegSlot } from '@/api/online';
import { useSpecialistTerms } from '@/areas/online/booking/wizard/specialistTerms';
import type { Service, SphereId, Staff } from '@/domain/core';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { addMinutes } from '@/lib/date';
import { pickText } from '@/lib/text';
import { Avatar } from '@/ui/Avatar';
import { Badge } from '@/ui/Badge';
import { Card } from '@/ui/Card';

/**
 * Итог визита на шаге «Детали» (F-03-090). О17: цены и итог «от–до» — не нижней границей молча («9 000–11 000 ֏»,
 * «от 17 000 ֏»), конец визита — по верхней длительности («до 13:45»). О4: несколько мастеров — по строке на каждого.
 */
export function VisitSummary({
  legs,
  staff,
  services,
  travelFee,
  anySpecialist,
  onEditTime,
  onEditServices,
  hourCycle,
  sphereIds,
  visitAddress,
  extras = [],
  extraMinutes = 0,
}: {
  legs: PlanLegSlot[];
  staff: Staff[];
  services: Service[];
  travelFee: number;
  anySpecialist: boolean;
  onEditTime: () => void;
  onEditServices: () => void;
  hourCycle?: '24' | '12';
  sphereIds?: SphereId[];
  visitAddress?: string;
  /** ⭐ Допродажа: добавленные клиентом услуги и товары — отдельными строками и в итоге */
  extras?: { id: string; name: string; min: number; max: number }[];
  /** На сколько продлилась последняя часть визита из-за добавленных услуг (конец визита) */
  extraMinutes?: number;
}) {
  const t = useT('online');
  const terms = useSpecialistTerms(sphereIds);
  const format = useFormat({ hourCycle });
  const locale = useLocale();
  const start = legs[0]?.start ?? '';
  const end = legs.length ? addMinutes(legs[legs.length - 1].start, legs[legs.length - 1].durationMin + extraMinutes) : start;
  const minTotal = services.reduce((sum, s) => sum + s.priceMin, 0) + travelFee + extras.reduce((a, x) => a + x.min, 0);
  const maxTotal = services.reduce((sum, s) => sum + (s.priceMax ?? s.priceMin), 0) + travelFee + extras.reduce((a, x) => a + x.max, 0);
  const svc = (id: string) => services.find((s) => s.id === id);
  return (
    <Card padding="md" className="flex flex-col gap-3" data-f="F-03-090">
      <button type="button" onClick={onEditTime} className="flex min-h-10 items-center gap-2 text-left text-sm font-medium text-fg">
        <Clock aria-hidden className="size-4 shrink-0 text-muted" />
        <span className="first-letter:uppercase">{t('booking.details.when', { date: format.date(start, 'weekday'), start: format.time(start), end: format.time(end) })}</span>
        <Pencil aria-hidden className="size-3.5 shrink-0 text-muted" />
      </button>
      <ul className="flex flex-col gap-3">
        {legs.map((leg) => {
          const st = staff.find((s) => s.id === leg.staffId);
          return (
            <li key={`${leg.staffId}-${leg.start}`} className="flex flex-col gap-1.5">
              <div className="flex items-center gap-3">
                {st && <Avatar name={st.name} src={st.avatarUrl} colorIndex={st.colorIndex} size="sm" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-fg">{st?.name}</p>
                  {legs.length > 1 && <p className="text-xs text-muted">{t('booking.details.legTime', { start: format.time(leg.start), end: format.time(addMinutes(leg.start, leg.durationMin)) })}</p>}
                </div>
                {anySpecialist && (
                  <Badge tone="neutral" size="sm" variant="soft" data-f="F-03-069">
                    {t('booking.details.anySpecialistBadge', terms)}
                  </Badge>
                )}
              </div>
              <button type="button" onClick={onEditServices} className="text-left text-sm">
                <ul className="flex flex-col gap-0.5 text-muted">
                  {leg.serviceIds.map((id) => {
                    const s = svc(id);
                    if (!s) return null;
                    return (
                      <li key={id} className="flex justify-between gap-3">
                        <span>{pickText(s.name, locale)}</span>
                        <span className="shrink-0 tabular-nums">{format.moneyRange(s.priceMin, s.priceMax)}</span>
                      </li>
                    );
                  })}
                </ul>
              </button>
            </li>
          );
        })}
        {extras.length > 0 && (
          <li className="flex flex-col gap-0.5 text-sm text-muted" data-f="F-03-090">
            {extras.map((x) => (
              <span key={x.id} className="flex justify-between gap-3">
                <span>+ {x.name}</span>
                <span className="shrink-0 tabular-nums">{format.moneyRange(x.min, x.max > x.min ? x.max : undefined)}</span>
              </span>
            ))}
          </li>
        )}
        {travelFee > 0 && (
          <li className="flex justify-between gap-2 text-sm text-muted" data-f="F-00-080">
            <span>{t('booking.workplaceStep.feeLine')}</span>
            <span>{format.money(travelFee)}</span>
          </li>
        )}
      </ul>
      <div className="flex justify-between gap-3 border-t border-border pt-2 text-base font-semibold text-fg">
        <span>{t('booking.details.total')}</span>
        <span className="tabular-nums">{maxTotal > minTotal ? format.moneyRange(minTotal, maxTotal) : format.money(minTotal)}</span>
      </div>
      {visitAddress && (
        <p className="flex items-center gap-1.5 text-sm text-muted" data-f="F-00-080">
          <MapPin aria-hidden className="size-3.5 shrink-0" />
          {visitAddress}
        </p>
      )}
    </Card>
  );
}
