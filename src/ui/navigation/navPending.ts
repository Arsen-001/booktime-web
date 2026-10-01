'use client';

import { create } from 'zustand';

/**
 * Переход на другую страницу начался, но новая ещё не пришла (owner 29.09.2026: «нажимаю — как будто не работает,
 * и только через 2 секунды открывается»). Каркас по этому состоянию сразу подсвечивает новый пункт меню, показывает
 * полоску загрузки и скелет страницы (NavPendingFeedback). Сбрасывается, когда адрес сменился.
 */
export const useNavPending = create<{ path: string | undefined }>(() => ({ path: undefined }));

/**
 * Отметить начало перехода. Нажатия на ссылки ловит NavPendingFeedback сам; переходы из кода (строка таблицы →
 * router.push) зовут это прямо перед push: `startNavPending(href); router.push(href)`. Принимает адрес целиком,
 * с ?query. Переход в пределах той же страницы (меняется только ?query) и на чужой сайт не отмечает — такой переход
 * не сменит адрес страницы, и полоска висела бы до страховочного таймера.
 */
export function startNavPending(href: string): void {
  if (typeof window === 'undefined') return;
  const url = new URL(href, window.location.href);
  if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
  useNavPending.setState({ path: url.pathname });
}

export function clearNavPending(): void {
  if (useNavPending.getState().path !== undefined) useNavPending.setState({ path: undefined });
}
