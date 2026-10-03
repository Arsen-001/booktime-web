'use client';

import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { DEMO_COOKIES } from '@/demo/settings';
import { CLIENT_LOCALES, type Locale } from '@/i18n/config';
import { refreshInLocale } from '@/i18n/switchLocale';
import { useT } from '@/i18n/useT';
import { SegmentedControl } from '@/ui/SegmentedControl';

/** Ключ синхронизирован с WidgetLocaleSync.tsx (F-03-114): явный выбор клиента язык ссылки больше не перебивает */
const WIDGET_LOCALE_CHOSEN_KEY = 'online.widgetLocaleChosen';

/** Подпись языка на самом языке — человек узнаёт свой, даже если сейчас страница на чужом */
const NATIVE: Record<Locale, string> = { hy: 'Հայ', ru: 'Рус', en: 'Eng' };

/**
 * О3: «Հայ / Рус / Eng» в шапке страницы салона, записи и кабинета (F-03-113, F-03-114). Армянский у клиента
 * включён раньше кабинета — главное отличие от DIKIDI и Fresha для Еревана.
 */
export function ClientLanguageSwitch() {
  const t = useT('online');
  const locale = useLocale() as Locale;
  const router = useRouter();
  return (
    <span data-f="F-03-113 F-03-114 F-15-138 F-15-140">
      <SegmentedControl
        size="sm"
        aria-label={t('public.language')}
        value={locale}
        onValueChange={(v) => {
          document.cookie = `${DEMO_COOKIES.lang}=${v}; path=/; max-age=31536000; samesite=lax`;
          try {
            window.localStorage.setItem(WIDGET_LOCALE_CHOSEN_KEY, v);
          } catch {
            /* приватный режим — ссылка сможет предложить свой язык в следующий раз */
          }
          // Язык в адресе (/hy/b/x → /en/b/x) меняем вместе с cookie — src/i18n/switchLocale.ts
          refreshInLocale(router, v as Locale);
        }}
        options={CLIENT_LOCALES.map((l) => ({ value: l, label: NATIVE[l] }))}
      />
    </span>
  );
}
