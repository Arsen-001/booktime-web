import { Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface EmptyStateHintProps {
  icon?: ReactNode;
  /** Что здесь будет, когда появятся данные («Здесь будут ваши записи») */
  title: ReactNode;
  /** Зачем это человеку, одна фраза */
  description?: ReactNode;
  /** «Как это работает» — 2–3 коротких шага, по порядку */
  steps?: ReactNode[];
  /** Главное действие — одна Button primary («Добавить первую услугу») */
  action?: ReactNode;
  /** Второстепенное — Button ghost/link («Посмотреть пример», «Как это работает») */
  secondaryAction?: ReactNode;
  /** Мелкая строка внизу: совет или «сколько займёт» */
  footnote?: ReactNode;
  /** Меньше отступов — внутри карточки или вкладки */
  compact?: boolean;
  /** Пунктирная рамка, как у EmptyState framed: пустой блок посреди страницы не теряется */
  framed?: boolean;
  className?: string;
}

/**
 * Пустой экран первого входа: не «Пока пусто», а что здесь будет, зачем и как начать — с шагами и одной
 * главной кнопкой. Для пустоты «ничего не нашлось по фильтру» — обычный EmptyState из src/ui.
 */
export function EmptyStateHint({
  icon,
  title,
  description,
  steps,
  action,
  secondaryAction,
  footnote,
  compact = false,
  framed = false,
  className,
}: EmptyStateHintProps) {
  return (
    <div
      data-empty-hint
      className={cn(
        'mx-auto flex w-full max-w-xl flex-col items-center text-center',
        compact ? 'gap-3 px-4 py-6' : 'gap-4 px-4 py-10 sm:py-14',
        framed && 'max-w-none rounded-xl border border-dashed border-border-strong/40 bg-surface-2/40',
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          'relative mb-1 inline-flex items-center justify-center rounded-full bg-primary-soft text-primary-text ring-primary-soft/50',
          compact ? 'size-12 ring-[6px] [&_svg]:size-5' : 'size-16 ring-8 [&_svg]:size-7',
        )}
      >
        {icon ?? <Sparkles />}
      </span>

      <div className="flex flex-col gap-1.5">
        <h2
          className={cn(
            'font-semibold tracking-tight text-balance text-fg',
            compact ? 'text-lg' : 'text-xl sm:text-2xl',
          )}
        >
          {title}
        </h2>
        {description && (
          <p className="mx-auto max-w-md text-base leading-relaxed text-pretty text-muted">{description}</p>
        )}
      </div>

      {steps && steps.length > 0 && (
        <ol
          className={cn(
            'grid w-full gap-2 text-left',
            steps.length >= 3 ? 'sm:grid-cols-3' : steps.length === 2 && 'sm:grid-cols-2',
          )}
        >
          {steps.map((step, i) => (
            <li
              key={i}
              className="flex items-start gap-3 rounded-xl border border-border bg-surface px-3.5 py-3 sm:flex-col sm:gap-2"
            >
              <span
                aria-hidden
                className="nums inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary-text"
              >
                {i + 1}
              </span>
              <span className="pt-0.5 text-sm leading-snug text-fg sm:pt-0">{step}</span>
            </li>
          ))}
        </ol>
      )}

      {(action || secondaryAction) && (
        <div className="flex w-full flex-col items-stretch gap-2 pt-1 sm:w-auto sm:flex-row sm:items-center sm:justify-center">
          {action}
          {secondaryAction}
        </div>
      )}

      {footnote && <p className="text-sm text-muted">{footnote}</p>}
    </div>
  );
}
