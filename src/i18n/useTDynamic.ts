'use client';

import { useTranslations } from 'next-intl';
import { reportIfFallback } from '@/i18n/fallbacks';

/**
 * Перевод по ПОЛНОМУ ключу, собранному во время работы ('loyalty.nav.cards').
 * Только для кода фундамента (меню, реестр расширений). Разделам — useT(ns): там ключи проверяет компилятор.
 */
export function useTDynamic(): (fullKey: string, values?: Record<string, string | number>) => string {
  const t = useTranslations();
  return (fullKey, values) => {
    reportIfFallback(fullKey);
    return (t as unknown as (k: string, v?: Record<string, string | number>) => string)(fullKey, values);
  };
}
