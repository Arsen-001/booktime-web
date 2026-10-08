'use client';

/**
 * Телефон, вид BookTime («Живой день», макет https://claude.ai/artifact/U3Xdi4nkNKgCZzsh83sQ5Z → «1 · телефон»): вместо
 * узкой сетки на 2 колонки — день одного мастера списком. Сверху мастера кружками с кольцом загрузки (выбор), дальше
 * строки «время | карточка»: свободное окно точками с «Предложить» и «+ сумма», записи в тоне услуги (имя, «новый»,
 * услуга · длительность, цена · статус), опоздавший — красная рамка и «Позвонить»; прошедшее свёрнуто в строку
 * «N визитов позади · сумма». Идущие визиты — карточками выше (LiveNowStrip).
 */
import { useState } from 'react';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import type { Booking, Client, DayHours, Id, ISODate, Service, Staff } from '@/domain/core';
import type { BookingLacquer } from '@/domain/journal';
import { useWaitlist } from '@/api/resources';
import { useCurrent } from '@/demo/hooks';
import { bookingTone, FREE_SLOT_MIN, freeGaps, isActiveBooking, startMinutes } from '@/areas/journal/lib/board';
import { lateMinutes, useNowMinuteYerevan } from '@/areas/journal/lib/lateness';
import { isNewClientBooking } from '@/areas/journal/lib/heuristics';
import { liveGap } from '@/areas/journal/lib/liveGaps';
import { useJournalHourFormat } from '@/areas/journal/lib/useJournalHourFormat';
import type { OfferGap } from '@/areas/journal/components/GapOfferSheet';
import { LiveNowStrip } from '@/areas/journal/components/LiveNowStrip';
import styles from '@/areas/journal/board.module.css';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { fromMinutes, today, toMinutes } from '@/lib/date';
import { pickText } from '@/lib/text';
import { useBookingStatusLabel } from '@/ui/BookingStatusBadge';
import { useLocale } from 'next-intl';

export interface LiveAgendaProps {
  date: ISODate;
  /** Чей день показываем — выбирается кружком мастера в шапке (PhoneHeader) */
  staffId: Id;
  staff: Staff[];
  hoursByStaff: Record<Id, DayHours>;
  bookings: Booking[];
  clientsById: Record<Id, Client>;
  services: Service[];
  lacquersById: Record<Id, BookingLacquer>;
  showPhones: boolean;
  canCreate: boolean;
  onOpen: (bookingId: Id) => void;
  onCreate: (staffId: Id, time: string) => void;
  onOfferGap?: (gap: OfferGap) => void;
  /** «+15 мин» на карточке идущего визита */
  canExtend: boolean;
}

/** «Рипсиме С.» — как в сетке и макете: имя и первая буква фамилии */
function shortName(name: string): string {
  const [first, last] = name.trim().split(/\s+/);
  return last ? `${first} ${last[0]}.` : first;
}

type Row =
  | { kind: 'booking'; at: number; booking: Booking; late: number | null }
  | { kind: 'gap'; at: number; gap: ReturnType<typeof liveGap> };

export function LiveAgenda({
  date,
  staffId,
  staff,
  hoursByStaff,
  bookings,
  clientsById,
  services,
  lacquersById,
  showPhones,
  canCreate,
  onOpen,
  onCreate,
  onOfferGap,
  canExtend,
}: LiveAgendaProps) {
  const t = useT('journal');
  const format = useFormat({ hourCycle: useJournalHourFormat() });
  const statusLabel = useBookingStatusLabel();
  const locale = useLocale();
  const { businessId } = useCurrent();
  const nowMin = useNowMinuteYerevan(date);
  const waitlistQuery = useWaitlist(businessId);
  const [pastOpen, setPastOpen] = useState(false);
  const selected = staff.find((s) => s.id === staffId) ?? staff[0];
  if (!selected) return null;

  const dayPast = date < today();
  const servicesById = new Map(services.map((s) => [s.id, s]));
  const own = bookings.filter((b) => b.staffId === selected.id).sort((a, b) => a.start.localeCompare(b.start));
  const endOf = (b: Booking) => startMinutes(b) + b.durationMin;
  // Прошедшее сворачиваем только сегодня, пока смена мастера идёт: закончившийся и прошлый день — весь списком, в цвете
  const shiftEnd = Math.max(0, ...(hoursByStaff[selected.id] ?? []).map((h) => toMinutes(h.to)));
  const foldPast = !dayPast && nowMin !== null && nowMin < shiftEnd;
  const isPast = (b: Booking) => foldPast && nowMin !== null && lateMinutes(b, nowMin) === null && (endOf(b) <= nowMin || !isActiveBooking(b));
  const isNow = (b: Booking) =>
    nowMin !== null && isActiveBooking(b) && startMinutes(b) <= nowMin && nowMin < endOf(b) && lateMinutes(b, nowMin) === null;
  const past = own.filter(isPast);
  const pastSum = past.filter((b) => isActiveBooking(b) && b.status !== 'no_show').reduce((sum, b) => sum + b.total, 0);
  const gaps = dayPast
    ? []
    : freeGaps(hoursByStaff[selected.id] ?? [], own, FREE_SLOT_MIN, nowMin !== null ? Math.ceil(nowMin / 5) * 5 : 0).map((g) =>
        liveGap(g, selected, services, waitlistQuery.data ?? [], date),
      );
  const rows: Row[] = [
    ...own.filter((b) => !isPast(b) && !isNow(b)).map((b) => ({ kind: 'booking' as const, at: startMinutes(b), booking: b, late: lateMinutes(b, nowMin) })),
    ...gaps.map((g) => ({ kind: 'gap' as const, at: g.from, gap: g })),
  ].sort((a, b) => a.at - b.at);
  const time = (m: number) => format.time(`${date}T${fromMinutes(m)}`);

  const bookingCard = (b: Booking, late: number | null, dim: boolean) => {
    const tone = bookingTone(b, lacquersById[b.id], servicesById);
    const client = b.clientId ? clientsById[b.clientId] : undefined;
    const isNew = isNewClientBooking(client, b);
    const serviceNames = b.services.map((s) => servicesById.get(s.serviceId)).filter(Boolean).map((s) => pickText(s!.name, locale as never)).join(' + ');
    const status = b.prepayment ? (b.prepayment.paid ? t('board.live.prepaid') : t('board.live.prepayWait')) : statusLabel(b.status);
    return (
      <div className={cn('relative', dim && styles.lPast)}>
        <button
          type="button"
          onClick={() => onOpen(b.id)}
          style={{ ['--tone-fill' as string]: tone.fill, ['--tone-ink' as string]: tone.ink, ['--tone-drop' as string]: tone.drop }}
          className={cn(
            styles.lCard,
            'flex w-full flex-col gap-0.5 rounded-2xl px-3.5 py-3 text-left text-[13px]',
            b.status === 'awaiting_confirmation' && styles.lPending,
            late !== null && styles.lLate,
          )}
        >
          <span className="flex items-center gap-1.5">
            <span className={cn('font-display truncate text-[15px] font-bold text-fg', b.status.startsWith('cancelled') && 'line-through')}>
              {client?.name ? shortName(client.name) : t('block.noClient')}
            </span>
            {isNew && <span className="shrink-0 rounded-full bg-fg px-1.5 text-[11px] leading-5 font-semibold text-surface">{t('board.card.newClient')}</span>}
            {late !== null && (
              <span className="ml-auto shrink-0 rounded-full bg-danger px-2 text-[11px] leading-5 font-semibold text-primary-contrast">
                {t('board.live.late', { time: format.duration(late) })}
              </span>
            )}
          </span>
          <span className="truncate">
            {serviceNames || t('block.noService')} · {format.duration(b.durationMin)}
          </span>
          {late === null && (
            <span className="mt-1 font-semibold">
              {b.total > 0 && `${format.money(b.total)} · `}
              {status}
            </span>
          )}
        </button>
        {late !== null && showPhones && client?.phone && (
          <a
            href={`tel:${client.phone}`}
            className="mt-2 inline-flex h-10 items-center rounded-xl bg-danger px-4 text-sm font-semibold text-primary-contrast"
          >
            {t('board.live.call')}
          </a>
        )}
      </div>
    );
  };

  return (
    <section aria-label={selected.name} className="flex flex-col gap-3">
      {/* Идущий визит выбранного мастера — крупной карточкой с кольцом, «Оплата» и «+15 мин» */}
      <LiveNowStrip
        date={date}
        bookings={own}
        clientsById={clientsById}
        staff={staff}
        services={services}
        onOpen={onOpen}
        canExtend={canExtend}
      />

      {rows.map((row) => (
        <div key={row.kind === 'gap' ? `gap-${row.at}` : row.booking.id} className="grid grid-cols-[52px_minmax(0,1fr)] items-start gap-3">
          <span className={cn('font-display pt-3 text-right text-[15px] font-extrabold', row.kind === 'gap' ? 'text-primary-text' : 'text-fg')}>{time(row.at)}</span>
          {row.kind === 'gap' ? (
            <div className={cn(styles.lFree, 'flex flex-col gap-0.5 rounded-2xl px-3.5 py-3 text-[13px]')}>
              <span className="font-display text-[15px] font-bold">{t('board.live.freeFor', { time: format.duration(row.gap.to - row.gap.from) })}</span>
              <span>
                {time(row.gap.from)}–{time(row.gap.to)}
                {row.gap.waiting > 0 && ` · ${t('board.live.waitingFit', { n: row.gap.waiting })}`}
              </span>
              {canCreate && (
                <span className="mt-2 flex items-center gap-2">
                  {onOfferGap && (
                    <button
                      type="button"
                      onClick={() => onOfferGap({ staffId: selected.id, from: row.gap.from, to: row.gap.to })}
                      className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-contrast"
                    >
                      {t('board.live.offer')}
                    </button>
                  )}
                  <button
                    type="button"
                    aria-label={t('board.live.book')}
                    onClick={() => onCreate(selected.id, fromMinutes(row.gap.from))}
                    className="inline-grid size-10 place-items-center rounded-xl bg-surface text-primary-text ring-1 ring-primary/30"
                  >
                    <Plus aria-hidden className="size-5" strokeWidth={2.5} />
                  </button>
                  {row.gap.potential > 0 && <span className="ml-auto text-xs font-medium">+ {format.money(row.gap.potential)}</span>}
                </span>
              )}
            </div>
          ) : (
            bookingCard(row.booking, row.late, false)
          )}
        </div>
      ))}

      {rows.length === 0 && past.length === 0 && (
        <p className="rounded-2xl border border-border bg-surface px-4 py-5 text-center text-sm text-muted">{t('board.live.emptyDay')}</p>
      )}

      {past.length > 0 && (
        <div className="grid grid-cols-[52px_minmax(0,1fr)] items-start gap-3">
          <span className="pt-3 text-right text-[13px] text-muted">{t('board.live.pastLabel')}</span>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              aria-expanded={pastOpen}
              onClick={() => setPastOpen((v) => !v)}
              className="flex min-h-12 items-center justify-between gap-2 rounded-2xl border border-border bg-surface px-3.5 text-left text-[13px] text-muted"
            >
              <span>
                {t('board.live.pastSummary', { n: past.length })}
                {pastSum > 0 && ` · ${format.money(pastSum)}`}
              </span>
              {pastOpen ? <ChevronDown aria-hidden className="size-4" /> : <ChevronRight aria-hidden className="size-4" />}
            </button>
            {pastOpen && past.map((b) => <div key={b.id}>{bookingCard(b, null, true)}</div>)}
          </div>
        </div>
      )}
    </section>
  );
}
