'use client';

import { useEffect, useState, type ReactNode } from 'react';
import type { FloatingAlign, FloatingSide } from '@/ui/hooks/useFloating';
import { Portal } from '@/ui/Portal';
import { Coachmark, type CoachmarkLabels } from '@/ui/onboarding/Coachmark';
import { Spotlight } from '@/ui/onboarding/Spotlight';
import { useTargetElement } from '@/ui/onboarding/useTargetElement';

export interface TourStep {
  id: string;
  /**
   * Что подсветить: CSS-селектор, обычно `[data-tour="journal-add"]`. Нет селектора или элемента на экране —
   * шаг показывается карточкой по центру (на телефоне — внизу) без подсветки.
   */
  target?: string;
  title: ReactNode;
  body?: ReactNode;
  icon?: ReactNode;
  /** Картинка/схема над заголовком — обычно только у первого шага */
  media?: ReactNode;
  side?: FloatingSide;
  align?: FloatingAlign;
}

export type TourCloseReason = 'done' | 'skip';

export interface TourProps {
  steps: TourStep[];
  open: boolean;
  /** 'done' — дошли до конца; 'skip' — крестик, Esc или «Пропустить» */
  onClose: (reason: TourCloseReason) => void;
  /** Затемнять экран вокруг элемента (по умолчанию да) */
  spotlight?: boolean;
  labels?: Partial<CoachmarkLabels>;
}

/**
 * Короткий тур по экрану: 1–4 шага, каждый — подсветка элемента и карточка Coachmark.
 * Состояние «видел / не видел» и автозапуск — в useTour(id): `const tour = useTour('journal.intro', { autoStart: true })`,
 * затем `<Tour steps={…} {...tour.props} />`. Повторить — `tour.start()` (кнопка «Как это работает»).
 */
export function Tour({ steps, open, onClose, spotlight = true, labels }: TourProps) {
  const [index, setIndex] = useState(0);
  const count = Math.min(steps.length, 4);
  const current = open ? steps[Math.min(index, count - 1)] : undefined;
  const target = useTargetElement(current?.target, open && !!current);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' && steps.length > 4) {
      console.warn(
        `[onboarding] В туре ${steps.length} шагов, показываю первые 4. Тур — не больше 3–4 шагов (docs/ONBOARDING.md).`,
      );
    }
  }, [steps.length]);

  // Элемент шага за пределами экрана — плавно подвести к нему
  useEffect(() => {
    if (!target) return;
    const r = target.getBoundingClientRect();
    const margin = 96;
    if (r.top < margin || r.bottom > window.innerHeight - margin) {
      target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [target]);

  if (!open || !current) return null;

  const close = (reason: TourCloseReason) => {
    setIndex(0);
    onClose(reason);
  };
  const step = Math.min(index, count - 1);

  return (
    <Portal>
      {/* Подложка ловит клики мимо подсказки, чтобы случайно не нажать что-то на странице во время тура */}
      <div aria-hidden className="fixed inset-0 z-[55]" />
      {spotlight && <Spotlight target={target} className="z-[55]" />}
      <Coachmark
        key={current.id}
        target={target}
        title={current.title}
        body={current.body}
        icon={current.icon}
        media={current.media}
        side={current.side}
        align={current.align}
        step={step}
        total={count}
        labels={labels}
        onBack={() => setIndex(Math.max(0, step - 1))}
        onNext={() => (step >= count - 1 ? close('done') : setIndex(step + 1))}
        onClose={() => close('skip')}
      />
    </Portal>
  );
}
