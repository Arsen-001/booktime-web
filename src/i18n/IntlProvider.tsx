'use client';

import { NextIntlClientProvider, type AbstractIntlMessages } from 'next-intl';
import type { ReactNode } from 'react';
import { MISSING_TEXT, TIME_ZONE, type Locale } from '@/i18n/config';
import { setFallbackKeys } from '@/i18n/fallbacks';

export interface IntlProviderProps {
  locale: Locale;
  messages: AbstractIntlMessages;
  /** Ключи, для которых в этом языке показан ru (см. useT) */
  fallbackKeys: string[];
  children: ReactNode;
}

/**
 * Клиентский провайдер переводов. Ключа нет даже в ru → на экране «⋯», в консоли
 * `[i18n:missing] …` (это ловит scripts/measure.mjs). Сырой «namespace.key» пользователю не показываем.
 */
export function IntlProvider({ locale, messages, fallbackKeys, children }: IntlProviderProps) {
  setFallbackKeys(locale, fallbackKeys);
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={messages}
      timeZone={TIME_ZONE}
      onError={(error) => {
        console.error(`[i18n:missing] ${error.message}`);
      }}
      getMessageFallback={() => MISSING_TEXT}
    >
      {children}
    </NextIntlClientProvider>
  );
}
