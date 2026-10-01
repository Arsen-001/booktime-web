/** Прокрутить к полю с ошибкой и поставить в него курсор (У19). Вызывать из обработчика, после смены вкладки. */
export function focusField(id: string): void {
  requestAnimationFrame(() => {
    const el = document.getElementById(id);
    if (!el) return;
    const target = el.matches('input, textarea, button') ? el : el.querySelector<HTMLElement>('input, textarea, button');
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target?.focus({ preventScroll: true });
  });
}
