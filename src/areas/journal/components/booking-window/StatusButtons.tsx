'use client';

/**
 * F-01-054 · Кнопки статуса в окне.
 * Altegio-четыре («Ожидание» = scheduled, «Клиент пришел» = arrived, «Не пришёл» = no_show,
 * «Подтвердил» = client_confirmed) как основные кнопки; наши дополнительные статусы (ждёт
 * подтверждения, ждёт предоплату, отменена клиентом/мастером — F-00-068) — во втором ряду
 * компактными чипами, чтобы не превращать шапку в восемь одинаковых кнопок (CONVENTIONS §0).
 */
import { CalendarClock, CheckCircle2, Clock, CreditCard, UserCheck, XCircle } from 'lucide-react';
import type { BookingStatus } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { Chip } from '@/ui/Chip';

export interface StatusButtonsProps {
  value: BookingStatus;
  onValueChange: (status: BookingStatus) => void;
}

const MAIN: { status: BookingStatus; icon: typeof Clock }[] = [
  { status: 'scheduled', icon: Clock },
  { status: 'arrived', icon: CheckCircle2 },
  { status: 'no_show', icon: XCircle },
  { status: 'client_confirmed', icon: UserCheck },
];

const EXTRA: { status: BookingStatus; icon: typeof Clock }[] = [
  { status: 'awaiting_confirmation', icon: CalendarClock },
  { status: 'awaiting_prepayment', icon: CreditCard },
  { status: 'cancelled_by_client', icon: XCircle },
  { status: 'cancelled_by_master', icon: XCircle },
];

export function StatusButtons({ value, onValueChange }: StatusButtonsProps) {
  const tc = useT('common');
  const t = useT('journal');

  return (
    <div data-f="F-01-054 F-01-075 F-01-076 F-01-124 F-14-093" className="flex flex-col gap-2">
      <p className="text-xs font-medium text-muted">{t('window.center.statusTitle')}</p>
      <div className="flex flex-wrap gap-2">
        {MAIN.map(({ status, icon: Icon }) => {
          const cls = cn(
            'flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition-colors',
            value === status
              ? 'border-primary bg-primary-soft text-primary-text'
              : 'border-border text-muted hover:border-border-strong hover:text-fg',
          );
          const label = (
            <>
              <Icon aria-hidden className="size-4" />
              {tc(`bookingStatus.${status}`)}
            </>
          );
          // F-01-086: метка ДОЛЖНА быть статическим литералом атрибута — fids.mjs (парсер JSX)
          // не засчитывает `data-f={условие ? "…" : undefined}` (было так), только `data-f="F-…"`.
          return status === 'client_confirmed' ? (
            <button
              key={status}
              type="button"
              data-f="F-01-086"
              onClick={() => onValueChange(status)}
              aria-pressed={value === status}
              className={cls}
            >
              {label}
            </button>
          ) : (
            <button key={status} type="button" onClick={() => onValueChange(status)} aria-pressed={value === status} className={cls}>
              {label}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {EXTRA.map(({ status }) => (
          <Chip key={status} selected={value === status} onClick={() => onValueChange(status)}>
            {tc(`bookingStatus.${status}`)}
          </Chip>
        ))}
      </div>
    </div>
  );
}
