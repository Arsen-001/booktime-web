'use client';

import { useT } from '@/i18n/useT';

/**
 * Знак продукта внизу страниц виджета (F-03-027). Открытый вопрос ТЗ «показывать ли знак продукта»
 * решён нашим декларативным решением («У нас: ⭐»): маленький знак допустим — ссылка на площадку
 * (не на других клиентов площадки, только на своё имя), без каталога и рекламы (F-00-006).
 * Имя продукта «BookTime» — то же, что в src/shell/Logo.tsx (выбрано 26.09.2026, В-35).
 */
export function PoweredByMark() {
  const t = useT('online');
  return (
    <p className="px-4 pb-2 text-center text-xs text-muted" data-f="F-03-027">
      {t('public.poweredBy', { product: 'BookTime' })}
    </p>
  );
}
