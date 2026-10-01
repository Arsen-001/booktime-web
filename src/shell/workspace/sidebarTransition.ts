import { flushSync } from 'react-dom';

type DocumentWithTransitions = Document & {
  startViewTransition?: (update: () => void) => { finished: Promise<void> };
};

/**
 * Свернуть/развернуть левое меню плавно (DESIGN.md → Performance: «Page transitions are native View Transitions»).
 * Ширину полосы ведёт браузер по снимкам — без JS на кадр и без анимации width у самого меню. Класс vt-sidebar
 * на <html> на время перехода включает свои правила в globals.css (обычно каркас в переходах стоит на месте).
 * Нет поддержки или prefers-reduced-motion — меню меняется сразу, как раньше.
 */
export function animateSidebarResize(update: () => void): void {
  const doc = document as DocumentWithTransitions;
  if (!doc.startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    update();
    return;
  }
  const root = document.documentElement;
  root.classList.add('vt-sidebar');
  const transition = doc.startViewTransition(() => flushSync(update));
  transition.finished.finally(() => root.classList.remove('vt-sidebar'));
}
