'use client';

import { useCallback } from 'react';
import type { BookingLink } from '@/domain/online';
import { useT } from '@/i18n/useT';

/**
 * Название ссылки онлайн-записи для экрана (20.11.2026). У ссылки без своего названия (nameDefault — сервер и мок)
 * name подставлен на языке запроса, а браузер шлёт свой язык, не язык кабинета, — поэтому подпись берём из словаря
 * кабинета: основная — «Основная ссылка», другая — «Ссылка на запись». Своё название владельца — как есть.
 */
export function useLinkName(): (link: Pick<BookingLink, 'name' | 'nameDefault' | 'primary'>) => string {
  const t = useT('online');
  return useCallback((link) => (link.nameDefault ? t(link.primary ? 'links.nameDefault.primary' : 'links.nameDefault.other') : link.name), [t]);
}
