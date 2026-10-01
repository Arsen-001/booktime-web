'use client';

import { ChevronDown, PartyPopper, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { Button } from '@/ui/Button';
import { IconButton } from '@/ui/IconButton';
import { checklistProgress } from '@/ui/onboarding/checklist';
import { ChecklistItem, type ChecklistItemData } from '@/ui/onboarding/ChecklistItem';
import { useOnce, type OnceOptions } from '@/ui/onboarding/onboardingStore';
import { ProgressRing } from '@/ui/onboarding/ProgressRing';

export type ChecklistVariant = 'full' | 'compact';

export interface ChecklistCardProps {
  /** Ключ для «Скрыть»: скрытый чек-лист не появится снова у этой персоны. Без id — крестика нет (или onHide) */
  id?: string;
  scope?: OnceOptions['scope'];
  title: ReactNode;
  /** Одна строка: зачем эти шаги («Осталось 2 шага — и вас увидят в каталоге») */
  description?: ReactNode;
  items: ChecklistItemData[];
  /**
   * full — все шаги списком (экран «Быстрый старт», журнал в первый день);
   * compact — только следующий шаг и «Показать все» (верх любого экрана, телефон)
   */
  variant?: ChecklistVariant;
  /** Всё сделано: заголовок, фраза и кнопка (например, «Открыть журнал») */
  completeTitle?: ReactNode;
  completeDescription?: ReactNode;
  completeAction?: ReactNode;
  onHide?: () => void;
  /** Подпись кольца для скринридера, например «Выполнено 3 из 5» */
  progressLabel?: string;
  /** compact: подписи «Показать все» / «Свернуть» (по умолчанию — из общих словарей) */
  showAllLabel?: ReactNode;
  showLessLabel?: ReactNode;
  className?: string;
}

/**
 * Карточка «Первые шаги»: кольцо прогресса, список шагов, следующий подсвечен и с кнопкой.
 * Состояние «сделано» считает раздел по данным (есть услуги? есть окна?), а не по нажатиям — так чек-лист
 * не врёт, если шаг сделан другим путём. Когда всё сделано — поздравление и «Скрыть».
 */
export function ChecklistCard({
  id,
  scope,
  title,
  description,
  items,
  variant = 'full',
  completeTitle,
  completeDescription,
  completeAction,
  onHide,
  progressLabel,
  showAllLabel,
  showLessLabel,
  className,
}: ChecklistCardProps) {
  const tu = useT('ui');
  const tc = useT('common');
  const once = useOnce(`checklist.${id ?? '_'}`, { scope });
  const [expanded, setExpanded] = useState(variant === 'full');

  if (id && (!once.ready || once.seen)) return null;

  const { done, total, complete, nextIndex } = checklistProgress(items);
  const canHide = Boolean(id || onHide);
  const hide = () => {
    if (id) once.markSeen();
    onHide?.();
  };

  // Всё обязательное сделано — необязательные шаги («Добавьте администратора») остаются под поздравлением
  const extras = complete ? items.filter((i) => i.optional && !i.done) : [];
  const visible = expanded ? items : nextIndex >= 0 ? [items[nextIndex]] : [];

  return (
    <section
      data-checklist={id}
      aria-label={typeof title === 'string' ? title : undefined}
      className={cn('rounded-2xl border border-border bg-surface shadow-sm', className)}
    >
      <header className="flex items-start gap-4 px-4 pt-4 pb-2 sm:px-5 sm:pt-5">
        <ProgressRing done={done} total={total} label={progressLabel} />
        <div className="min-w-0 flex-1 pt-1">
          <h2 className="text-lg leading-snug font-semibold tracking-tight text-fg">
            {complete && completeTitle ? completeTitle : title}
          </h2>
          {(complete ? completeDescription : description) && (
            <p className="mt-1 text-sm leading-relaxed text-muted sm:text-base">
              {complete ? completeDescription : description}
            </p>
          )}
        </div>
        {canHide && (
          <IconButton
            icon={<X aria-hidden />}
            label={tu('close')}
            size="sm"
            onClick={hide}
            className="-mt-1 -mr-2 rounded-full text-muted hover:text-fg"
          />
        )}
      </header>

      {complete ? (
        <>
          <div className="flex flex-wrap items-center gap-4 px-4 pt-2 pb-5 sm:px-5">
            <span className="inline-flex items-center gap-2 rounded-full bg-success-soft px-3 py-1.5 text-sm font-medium text-success">
              <PartyPopper aria-hidden className="size-4" />
              {done}/{total}
            </span>
            <div className="flex w-full flex-col gap-2 sm:ml-auto sm:w-auto sm:flex-row sm:items-center">
              {completeAction}
              {canHide && (
                <Button variant="ghost" onClick={hide}>
                  {tu('close')}
                </Button>
              )}
            </div>
          </div>
          {extras.length > 0 && (
            <ol className="flex flex-col gap-1 border-t border-border px-2 py-2 sm:px-3">
              {extras.map((item) => (
                <ChecklistItem key={item.id} item={item} number={items.indexOf(item) + 1} />
              ))}
            </ol>
          )}
        </>
      ) : (
        <>
          <ol className="flex flex-col gap-1 px-2 pb-2 sm:px-3">
            {visible.map((item) => {
              const index = items.indexOf(item);
              return <ChecklistItem key={item.id} item={item} number={index + 1} next={index === nextIndex} />;
            })}
          </ol>
          {variant === 'compact' && total > 1 && (
            <div className="border-t border-border px-2 py-1.5 sm:px-3">
              <Button
                variant="ghost"
                size="sm"
                fullWidth
                aria-expanded={expanded}
                onClick={() => setExpanded((v) => !v)}
                rightIcon={<ChevronDown aria-hidden className={cn('transition-transform', expanded && 'rotate-180')} />}
                className="text-muted hover:text-fg"
              >
                {expanded ? (showLessLabel ?? tu('close')) : (showAllLabel ?? tc('actions.showAll'))}
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
