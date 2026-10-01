import { Check, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { buttonClasses } from '@/ui/Button';

export interface ChecklistItemData {
  id: string;
  title: ReactNode;
  /** Одна фраза: что даст шаг («Клиенты увидят цены и время») */
  description?: ReactNode;
  done: boolean;
  /** Куда ведёт шаг (обычно экран раздела); или onClick — открыть окно */
  href?: string;
  onClick?: () => void;
  /** Подпись кнопки у следующего шага («Добавить услуги») */
  actionLabel?: ReactNode;
  /** Сколько займёт, например «1 мин» — снимает страх «это надолго» */
  meta?: ReactNode;
  /** Пометка вместо стрелки, например Badge «На проверке» */
  badge?: ReactNode;
  /** Шаг выполнен наполовину или ждёт других (выглядит как не сделанный, но без кнопки) */
  waiting?: boolean;
  /** Необязательный шаг: в конце списка, пунктирный кружок, в «готово» не считается */
  optional?: boolean;
}

export interface ChecklistItemProps {
  item: ChecklistItemData;
  /** Порядковый номер (с 1) — в кружке не сделанного шага */
  number: number;
  /** Это следующий шаг: подсвечен, с кнопкой действия */
  next?: boolean;
}

/** Строка чек-листа «Первые шаги»: кружок-статус, название, пояснение, действие. Вся строка — ссылка/кнопка */
export function ChecklistItem({ item, number, next = false }: ChecklistItemProps) {
  const { done } = item;
  const interactive = !done && !item.waiting && (item.href || item.onClick);

  const content: ReactNode = (
    <>
      <span
        aria-hidden
        className={cn(
          'mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-colors',
          done && 'bg-success text-primary-contrast',
          !done && next && 'bg-primary text-primary-contrast shadow-sm',
          !done && !next && !item.optional && 'border-2 border-border bg-surface text-muted',
          !done && !next && item.optional && 'border-2 border-dashed border-border-strong/50 bg-surface text-muted',
        )}
      >
        {done ? <Check className="size-4" strokeWidth={3} /> : number}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 pt-1">
        <span className={cn('text-base leading-snug font-medium', done ? 'text-muted' : 'text-fg')}>{item.title}</span>
        {item.description && !done && <span className="text-sm leading-relaxed text-muted">{item.description}</span>}
        {item.meta && !done && <span className="text-sm text-muted">{item.meta}</span>}
        {next && interactive && item.actionLabel && (
          <span className={cn(buttonClasses({ size: 'sm' }), 'mt-2 self-start sm:hidden')}>{item.actionLabel}</span>
        )}
      </span>
      {item.badge ? (
        <span className="shrink-0 self-center">{item.badge}</span>
      ) : next && interactive && item.actionLabel ? (
        <span className={cn(buttonClasses({ size: 'sm' }), 'hidden shrink-0 self-center sm:inline-flex')}>
          {item.actionLabel}
        </span>
      ) : interactive ? (
        <ChevronRight aria-hidden className="size-5 shrink-0 self-center text-muted" />
      ) : null}
    </>
  );

  const rowClass = cn(
    'flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left',
    next && !done && 'bg-primary-soft/50',
    interactive &&
      'transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
    interactive && next && 'hover:bg-primary-soft',
  );

  return (
    <li data-step={item.id} data-done={done || undefined}>
      {interactive && item.href ? (
        <Link href={item.href} className={rowClass} aria-current={next ? 'step' : undefined}>
          {content}
        </Link>
      ) : interactive ? (
        <button type="button" onClick={item.onClick} className={rowClass} aria-current={next ? 'step' : undefined}>
          {content}
        </button>
      ) : (
        <div className={rowClass}>{content}</div>
      )}
    </li>
  );
}
