'use client';

import { useEffect } from 'react';
import type { WidgetTheme } from '@/domain/online';

/**
 * Тема виджета (F-03-023) переопределяет тему на `<html>` только пока открыта публичная страница —
 * токены темы объявлены как `:root[data-theme]`, поэтому местный override возможен только на корне
 * документа. Возвращает системную/платформенную тему при уходе со страницы.
 */
export function ApplyWidgetTheme({ theme }: { theme: WidgetTheme | undefined }) {
  useEffect(() => {
    if (!theme) return undefined;
    const root = document.documentElement;
    const previous = root.getAttribute('data-theme');
    root.setAttribute('data-theme', theme);
    return () => {
      if (previous) root.setAttribute('data-theme', previous);
      else root.removeAttribute('data-theme');
    };
  }, [theme]);

  return null;
}
