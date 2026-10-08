'use client';

/**
 * Телефон, стиль «Живой день» (owner 08.10.2026): над сеткой — идущие визиты карточками primary: кольцо прогресса с
 * «N мин», клиент, услуга, мастер и «до 15:30»; кнопки «Оплата» (окно записи) и «+15 мин». Нажатие открывает запись. Несколько мастеров — карточки листаются вбок.
 * Ничего не идёт — полосы нет.
 */
import type { Booking, Client, Id, ISODate, Service, Staff } from '@/domain/core';
import { updateBooking } from '@/api/core';
import { hasOverlap } from '@/api/journal';
import { isActiveBooking, startMinutes } from '@/areas/journal/lib/board';
import { lateMinutes, useNowMinuteYerevan } from '@/areas/journal/lib/lateness';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { fromMinutes } from '@/lib/date';
import { pickText } from '@/lib/text';
import { useToast } from '@/ui/Toast';
import { useLocale } from 'next-intl';

export interface LiveNowStripProps {
  date: ISODate;
  bookings: Booking[];
  clientsById: Record<Id, Client>;
  staff: Staff[];
  services: Service[];
  onOpen: (bookingId: Id) => void;
  /** Право переносить и растягивать записи — «+15 мин» */
  canExtend: boolean;
}

export function LiveNowStrip({ date, bookings, clientsById, staff, services, onOpen, canExtend }: LiveNowStripProps) {
  const t = useT('journal');
  const tc = useT('common');
  const toast = useToast();
  const format = useFormat();
  const locale = useLocale();
  const nowMin = useNowMinuteYerevan(date);
  // +15 минут к идущему визиту — с той же проверкой пересечения, что у растягивания карточки (F-01-031)
  const extend = async (b: Booking) => {
    const durationMin = b.durationMin + 15;
    if (await hasOverlap(b.staffId, b.start, durationMin, b.id)) {
      toast.error(t('block.resizeOverlap'));
      return;
    }
    try {
      await updateBooking(b.id, { durationMin });
      toast.success(t('board.live.extended', { time: format.time(`${date}T${fromMinutes(startMinutes(b) + durationMin)}`) }));
    } catch {
      toast.error(tc('states.actionFailed'));
    }
  };
  if (nowMin === null) return null;
  const current = bookings.filter((b) => {
    const from = startMinutes(b);
    return isActiveBooking(b) && b.status !== 'no_show' && from <= nowMin && nowMin < from + b.durationMin && lateMinutes(b, nowMin) === null;
  });
  if (current.length === 0) return null;
  const staffName = new Map(staff.map((s) => [s.id, s.name.split(' ')[0]]));
  const serviceName = new Map(services.map((s) => [s.id, pickText(s.name, locale as never)]));

  return (
    <section aria-label={t('board.live.nowTitle')} className="-mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
      {current.map((b) => {
        const from = startMinutes(b);
        const to = from + b.durationMin;
        const pct = Math.max(3, Math.min(100, ((nowMin - from) / b.durationMin) * 100));
        const left = to - nowMin;
        const client = b.clientId ? clientsById[b.clientId] : undefined;
        return (
          <div
            key={b.id}
            className="flex w-[min(100%,20rem)] shrink-0 snap-start flex-col gap-3 rounded-[22px] bg-primary p-4 text-primary-contrast shadow-lg"
          >
            <button type="button" onClick={() => onOpen(b.id)} className="flex items-center gap-3.5 text-left">
              <span className="relative grid size-[68px] shrink-0 place-items-center">
                <svg aria-hidden viewBox="0 0 76 76" className="absolute inset-0 size-full -rotate-90">
                  <circle cx="38" cy="38" r="33" fill="none" strokeWidth="7" className="stroke-primary-contrast/25" />
                  <circle
                    cx="38"
                    cy="38"
                    r="33"
                    fill="none"
                    strokeWidth="7"
                    strokeLinecap="round"
                    className="stroke-primary-contrast"
                    strokeDasharray={`${Math.round((pct / 100) * 207)} 207`}
                  />
                </svg>
                <span className="font-display max-w-12 text-center text-[11px] leading-tight font-bold">{format.duration(left).replace(/\u00a0/g, ' ')}</span>
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-xs opacity-85">
                  {t('board.live.nowTitle')} · {staffName.get(b.staffId)} · {t('board.card.until', { time: format.time(`${date}T${fromMinutes(to)}`) })}
                </span>
                <span className="font-display truncate text-lg leading-6 font-extrabold">{client?.name ?? t('block.noClient')}</span>
                <span className="truncate text-[13px] opacity-90">
                  {b.services.map((s) => serviceName.get(s.serviceId)).filter(Boolean).join(' + ')}
                  {b.total > 0 && ` · ${format.money(b.total)}`}
                </span>
              </span>
            </button>
            {/* Как в макете: оплата (окно записи — там касса) и продление на 15 минут, если следующая запись не мешает */}
            <span className="flex gap-2">
              <button
                type="button"
                onClick={() => onOpen(b.id)}
                className="inline-flex h-10 flex-1 items-center justify-center rounded-xl bg-primary-contrast text-sm font-semibold text-primary"
              >
                {t('board.live.pay')}
              </button>
              {canExtend && (
                <button
                  type="button"
                  onClick={() => void extend(b)}
                  className="inline-flex h-10 items-center justify-center rounded-xl bg-primary-contrast/20 px-4 text-sm font-semibold"
                >
                  {t('board.live.plus15')}
                </button>
              )}
            </span>
          </div>
        );
      })}
    </section>
  );
}
