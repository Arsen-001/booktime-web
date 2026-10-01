'use client';

import { X } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { Button } from '@/ui/Button';
import { IconButton } from '@/ui/IconButton';
import { useEscape } from '@/ui/hooks/useEscape';
import { useFloating, type FloatingAlign, type FloatingSide } from '@/ui/hooks/useFloating';
import { useIsMobile } from '@/ui/hooks/useMediaQuery';
import { Portal } from '@/ui/Portal';
import { StepDots } from '@/ui/onboarding/StepDots';

export interface CoachmarkLabels {
  next: string;
  back: string;
  done: string;
  skip: string;
}

export interface CoachmarkProps {
  /** Элемент, к которому привязана карточка; null — карточка по центру экрана (на телефоне — внизу) */
  target: HTMLElement | null;
  title: ReactNode;
  body?: ReactNode;
  /** Значок в кружке слева от заголовка (lucide, 20 px) */
  icon?: ReactNode;
  /** Картинка или схема над заголовком (для первого шага тура) */
  media?: ReactNode;
  side?: FloatingSide;
  align?: FloatingAlign;
  /** Номер шага с 0 и число шагов — точки прогресса и «Шаг 1 из 3» */
  step?: number;
  total?: number;
  onNext?: () => void;
  onBack?: () => void;
  /** Крестик, Esc и «Пропустить» */
  onClose: () => void;
  /** Подписи кнопок; по умолчанию — из общих словарей */
  labels?: Partial<CoachmarkLabels>;
  className?: string;
}

/**
 * Карточка-подсказка у элемента: заголовок, 1–2 фразы, точки шагов, «Назад / Далее», «Пропустить».
 * Десктоп — рядом с элементом (переворачивается у края); телефон — внизу экрана у большого пальца.
 * Обычно используется через Tour; одиночная — для разовой подсказки к новой кнопке.
 */
export function Coachmark({
  target,
  title,
  body,
  icon,
  media,
  side = 'bottom',
  align = 'start',
  step = 0,
  total = 1,
  onNext,
  onBack,
  onClose,
  labels,
  className,
}: CoachmarkProps) {
  const tc = useT('common');
  const tu = useT('ui');
  const isMobile = useIsMobile();
  const [card, setCard] = useState<HTMLDivElement | null>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const bodyId = useId();

  const l: CoachmarkLabels = {
    next: labels?.next ?? tc('actions.next'),
    back: labels?.back ?? tc('actions.back'),
    done: labels?.done ?? tc('actions.done'),
    skip: labels?.skip ?? tu('close'),
  };
  const isLast = step >= total - 1;
  const floating = !isMobile && !!target;

  useFloating({
    open: floating,
    anchor: target,
    floating: floating ? card : null,
    side,
    align,
    offset: 14,
  });
  useEscape(true, onClose);

  // Фокус на главную кнопку при каждом шаге: клавиатура и скринридер сразу «внутри» подсказки
  useEffect(() => {
    primaryRef.current?.focus({ preventScroll: true });
  }, [step]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowRight' && onNext) onNext();
    if (event.key === 'ArrowLeft' && onBack && step > 0) onBack();
  };

  return (
    <Portal>
      <div
        ref={setCard}
        role="dialog"
        aria-modal="false"
        aria-labelledby={titleId}
        aria-describedby={body ? bodyId : undefined}
        data-coachmark
        onKeyDown={onKeyDown}
        style={floating ? { position: 'fixed', top: 0, left: 0, visibility: 'hidden' } : undefined}
        className={cn(
          'z-[56] flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5 text-fg shadow-xl outline-none',
          floating && 'w-[22rem] max-w-[calc(100vw-2rem)] animate-pop',
          !floating &&
            'fixed inset-x-3 bottom-3 mx-auto max-w-md animate-slide-up pb-[max(1.25rem,env(safe-area-inset-bottom))] md:bottom-auto md:top-1/2 md:-translate-y-1/2 md:animate-scale-in',
          className,
        )}
      >
        {media && <div className="-mx-1 -mt-1 overflow-hidden rounded-xl bg-surface-2">{media}</div>}

        <div className="flex items-start gap-3">
          {icon && (
            <span
              aria-hidden
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-text [&_svg]:size-5"
            >
              {icon}
            </span>
          )}
          <div className="min-w-0 flex-1 pt-0.5">
            {total > 1 && (
              <p className="text-sm font-medium text-primary-text">
                {tu('stepper.step', { current: step + 1, total })}
              </p>
            )}
            <h2 id={titleId} className="mt-0.5 text-lg leading-snug font-semibold tracking-tight text-balance">
              {title}
            </h2>
          </div>
          <IconButton
            icon={<X aria-hidden />}
            label={l.skip}
            size="sm"
            onClick={onClose}
            className="-mt-1.5 -mr-2 rounded-full text-muted hover:text-fg"
          />
        </div>

        {body && (
          <div id={bodyId} className="text-base leading-relaxed text-muted">
            {body}
          </div>
        )}

        <div className="flex items-center gap-2">
          {total > 1 ? <StepDots total={total} current={step} /> : <span />}
          <div className="ml-auto flex items-center gap-2">
            {step > 0 && onBack && (
              <Button variant="ghost" size="sm" onClick={onBack}>
                {l.back}
              </Button>
            )}
            <Button ref={primaryRef} size="sm" onClick={onNext ?? onClose}>
              {isLast ? l.done : l.next}
            </Button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
