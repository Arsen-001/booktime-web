'use client';

/**
 * Путь заказа крупно: «Принят → В работе → Готов → Выдан». Пройденные шаги — залитые кружки с галочкой, текущий —
 * с кольцом и значком статуса, будущие — серые. Под шагом — когда он случился (если знаем). Одинаково в кабинете и
 * на публичной странице клиента; отменённый заказ шагов не показывает — только плашку «Заказ отменён».
 */
import { Check } from 'lucide-react';
import { ORDER_STEPS, type OrderStatus } from '@/domain/orders';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { ORDER_STATUS_META } from '@/areas/orders/ui/orderStatusMeta';

export interface OrderProgressProps {
  status: OrderStatus;
  /** Подписи времени под шагами: { ready: 'сегодня, 14:30' } */
  times?: Partial<Record<OrderStatus, string>>;
  /** Шаги, которых не было (выдали без ремонта после отказа от сметы) — серые, без галочки */
  skipped?: readonly OrderStatus[];
  className?: string;
}

export function OrderProgress({ status, times, skipped = [], className }: OrderProgressProps) {
  const t = useT('orders');
  if (status === 'cancelled') {
    const { icon: Icon } = ORDER_STATUS_META.cancelled;
    return (
      <div role="status" className={cn('flex items-center gap-3 rounded-xl bg-danger-soft px-4 py-3 text-danger', className)}>
        <Icon aria-hidden className="size-5 shrink-0" />
        <p className="text-sm font-semibold">{t('progress.cancelled')}</p>
      </div>
    );
  }
  const current = (ORDER_STEPS as readonly OrderStatus[]).indexOf(status);
  return (
    <ol aria-label={t('progress.label')} className={cn('grid grid-cols-4', className)}>
      {ORDER_STEPS.map((step, i) => {
        const done = (i < current && !skipped.includes(step)) || (i === current && step === 'issued');
        const active = i === current && step !== 'issued';
        const Icon = ORDER_STATUS_META[step].icon;
        return (
          <li key={step} aria-current={i === current ? 'step' : undefined} className="relative flex min-w-0 flex-col items-center gap-2 text-center">
            {i > 0 && (
              <span
                aria-hidden
                className={cn('absolute top-5 right-1/2 h-0.5 w-full -translate-y-1/2', i <= current && !skipped.includes(step) && !skipped.includes(ORDER_STEPS[i - 1]) ? 'bg-primary' : 'bg-border')}
              />
            )}
            <span
              className={cn(
                'relative inline-flex size-10 items-center justify-center rounded-full [&_svg]:size-5',
                done && 'bg-primary text-primary-contrast',
                active && 'bg-primary-soft text-primary-text ring-2 ring-primary ring-offset-2 ring-offset-surface',
                !done && !active && 'bg-surface-3 text-muted',
              )}
            >
              {done ? <Check aria-hidden strokeWidth={3} /> : <Icon aria-hidden />}
            </span>
            {/* Без боковых полей и чуть плотнее на телефоне: «Ընթացքում» (hy) целиком влезает в колонку на 360 px, уже 360 px — 11 px */}
            <span className="flex w-full min-w-0 flex-col">
              {/* На телефоне мельче и с переносом: армянские «Աշխատանքում» не помещались в четверть ширины */}
              <span className={cn('text-xs leading-tight tracking-tight break-words max-[359px]:text-[0.6875rem] sm:text-sm sm:tracking-normal', i <= current && !skipped.includes(step) ? 'font-semibold text-fg' : 'text-muted')}>{t(`steps.${step}`)}</span>
              {times?.[step] && i <= current && <span className="mt-0.5 text-xs leading-tight text-muted">{times[step]}</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
