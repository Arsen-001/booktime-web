/**
 * Ширина экрана, известная серверу до первого кадра (DESIGN.md → «Skeleton per element»): без неё сервер рисует
 * телефон в раскладке компьютера, а после гидрации всё перестраивается — «прыгает». Браузер держит ширину в cookie
 * (ViewportHintProvider), при самом первом заходе сервер берёт её по типу устройства из заголовков.
 */
export const VIEWPORT_COOKIE = 'bp-vw';
/** Ширина по умолчанию, если о браузере ничего не известно: телефон / компьютер */
export const PHONE_WIDTH = 390;
export const DESKTOP_WIDTH = 1440;

/**
 * Подходит ли медиазапрос под ширину экрана — только простые (min-width / max-width в px, через «and»).
 * Остальное (ориентация, hover, prefers-*) — undefined: такой запрос на сервере считается несовпавшим, как раньше.
 */
export function matchesWidth(query: string, width: number): boolean | undefined {
  const parts = query.split(/\s+and\s+/i);
  let result = true;
  for (const part of parts) {
    const m = /^\(\s*(min|max)-width\s*:\s*([\d.]+)px\s*\)$/i.exec(part.trim());
    if (!m) return undefined;
    const value = Number(m[2]);
    result &&= m[1].toLowerCase() === 'min' ? width >= value : width <= value;
  }
  return result;
}
