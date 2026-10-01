'use client';

/**
 * Карточка визита на стойке администратора (⭐ рабочий день №10): крупное время, имя клиента, услуги и мастер — и одна
 * большая кнопка «Пришёл» (одно касание, отменить — в тосте). Карточка целиком открывает запись в журнале (растянутая
 * кнопка ПОД содержимым — кнопка в кнопке недопустима). data-booking — для подсветки чужих правок.
 */
import { Check, Phone, UserCheck } from 'lucide-react';
import type { DayListActionsApi } from '@/areas/journal/components/DayListActions';
import type { Booking, Client, Service, Staff } from '@/domain/core';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { Avatar } from '@/ui/Avatar';
import { Badge } from '@/ui/Badge';
import { BookingStatusBadge } from '@/ui/BookingStatusBadge';
import { Button } from '@/ui/Button';
import { IconButton } from '@/ui/IconButton';
import { SkeletonText } from '@/ui/Skeleton';
import { addMinutes } from '@/lib/date';
import { pickText } from '@/lib/text';
import { useLocale } from 'next-intl';

export type DeskCardTone = 'late' | 'soon' | 'later' | 'inSalon';

export interface DeskVisitCardProps {
  booking: Booking;
  tone: DeskCardTone;
  client?: Client;
  staff?: Staff;
  servicesById: Map<string, Service>;
  /** Минуты от «сейчас» до начала (минус — уже идёт) */
  minutesToStart: number;
  showPhone: boolean;
  canArrive: boolean;
  api: DayListActionsApi;
  onOpen: () => void;
  hourCycle?: '12' | '24';
}

export function DeskVisitCard({ booking: b, tone, client, staff, servicesById, minutesToStart, showPhone, canArrive, api, onOpen, hourCycle }: DeskVisitCardProps) {
  const t = useT('journal');
  const format = useFormat({ hourCycle });
  const locale = useLocale();
  const name = client?.name ?? b.visitorName ?? t('board.list.noClient');
  const services = b.services
    .map((l) => servicesById.get(l.serviceId))
    .filter((s): s is Service => Boolean(s))
    .map((s) => pickText(s.name, locale))
    .join(', ');
  const busy = api.busy[b.id];
  const phone = showPhone ? client?.phone : undefined;
  const arrived = b.status === 'arrived';

  const when =
    tone === 'late' ? (
      <Badge tone="danger" size="md">
        {minutesToStart <= -1 ? t('desk.lateBy', { min: -minutesToStart }) : t('desk.dueNow')}
      </Badge>
    ) : tone === 'soon' ? (
      <Badge tone="warning" size="md">
        {minutesToStart <= 0 ? t('desk.dueNow') : t('desk.inMin', { min: minutesToStart })}
      </Badge>
    ) : null;

  return (
    <li
      data-booking={b.id}
      className={cn(
        'relative rounded-2xl border bg-surface shadow-xs',
        tone === 'late' ? 'border-danger/40' : 'border-border',
        arrived && 'bg-surface-2/60',
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        aria-label={t('desk.openAria', { time: format.time(b.start), name })}
        className="absolute inset-0 w-full rounded-2xl transition-colors hover:bg-surface-2/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      />
      <div className="pointer-events-none relative flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-5 md:p-5">
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <div className="flex w-20 shrink-0 flex-col">
            <span className={cn('text-[28px] leading-8 font-extrabold tracking-tight tabular-nums', arrived ? 'text-muted' : 'text-fg')}>
              {format.time(b.start)}
            </span>
            <span className="text-sm text-muted tabular-nums">–{format.time(addMinutes(b.start, b.durationMin))}</span>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="truncate text-lg leading-6 font-semibold text-fg">{name}</span>
            {services && <span className="line-clamp-2 text-sm text-muted">{services}</span>}
            <span className="mt-1 flex flex-wrap items-center gap-2">
              {staff && (
                <span className="inline-flex items-center gap-1.5 text-sm text-fg">
                  <Avatar name={staff.name} src={staff.photos[0]} colorIndex={staff.colorIndex} size="xs" />
                  {staff.name}
                </span>
              )}
              {when}
              {(b.status === 'awaiting_confirmation' || b.status === 'awaiting_prepayment') && <BookingStatusBadge status={b.status} size="sm" />}
            </span>
          </div>
        </div>
        <div className="pointer-events-auto flex items-center gap-2 sm:shrink-0">
          {phone && (
            <IconButton
              variant="outline"
              size="lg"
              icon={<Phone aria-hidden />}
              label={t('board.list.callName', { name })}
              onClick={() => void api.call(phone)}
            />
          )}
          {arrived ? (
            <span className="inline-flex h-12 items-center gap-1.5 px-2 text-base font-semibold text-success">
              <Check aria-hidden className="size-5" />
              {t('desk.arrived')}
            </span>
          ) : canArrive ? (
            <Button
              size="lg"
              // Главная кнопка — у тех, кто уже должен быть или вот-вот придёт; позже сегодня — спокойнее
              variant={tone === 'later' ? 'secondary' : 'primary'}
              data-desk-action="arrive"
              leftIcon={<UserCheck aria-hidden />}
              loading={busy === 'arrive'}
              disabled={Boolean(busy)}
              onClick={() => void api.arrive(b, name)}
              className="h-14 flex-1 px-6 text-base sm:flex-none md:h-14"
            >
              {t('desk.arrive')}
            </Button>
          ) : null}
        </div>
      </div>
    </li>
  );
}

/** Та же разметка без данных — стойка до ответа сервера (DESIGN.md → «The skeleton IS the page») */
export function DeskVisitCardSkeleton() {
  return (
    <li aria-hidden data-skeleton className="relative rounded-2xl border border-border bg-surface shadow-xs">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-5 md:p-5">
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <div className="flex w-20 shrink-0 flex-col">
            <span className="text-[28px] leading-8 font-extrabold">
              <SkeletonText width="4ch" />
            </span>
            <span className="text-sm">
              <SkeletonText width="5ch" />
            </span>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-lg leading-6 font-semibold">
              <SkeletonText width="14ch" />
            </span>
            <span className="text-sm">
              <SkeletonText width="22ch" />
            </span>
            <span className="mt-1 flex items-center gap-2 text-sm">
              <span className="size-6 rounded-full bg-surface-3" />
              <SkeletonText width="8ch" />
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:shrink-0">
          <span className="inline-flex min-h-14 flex-1 items-center justify-center rounded-xl bg-surface-3 px-6 sm:w-36 sm:flex-none" />
        </div>
      </div>
    </li>
  );
}
