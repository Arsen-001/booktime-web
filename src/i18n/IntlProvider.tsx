'use client';

import { NextIntlClientProvider, type AbstractIntlMessages, type IntlError } from 'next-intl';
import { usePathname } from 'next/navigation';
import { startTransition, use, useCallback, useState, type ReactNode } from 'react';
import { MISSING_TEXT, TIME_ZONE, type Locale } from '@/i18n/config';
import { setFallbackKeys } from '@/i18n/fallbacks';
import { splitLocalePrefix } from '@/i18n/localePath';
import { namespacesForPath } from '@/i18n/routeMessages';

export interface IntlProviderProps {
  locale: Locale;
  messages: AbstractIntlMessages;
  /** Ключи, для которых в этом языке показан ru (см. useT) */
  fallbackKeys: string[];
  /** Пришли только словари публичной страницы (src/i18n/routeMessages.ts) — остальные догружаются при переходе */
  partial?: boolean;
  children: ReactNode;
}

interface FullMessages {
  messages: AbstractIntlMessages;
  fallbackKeys: string[];
}

/** Все словари языка: один запрос на вкладку (адрес /i18n/<язык> — src/app/i18n/[locale]/route.ts) */
const fullLoads = new Map<Locale, Promise<FullMessages | null>>();
const fullLoaded = new Map<Locale, FullMessages>();

function loadFull(locale: Locale): Promise<FullMessages | null> {
  let load = fullLoads.get(locale);
  if (!load) {
    load = fetch(`/i18n/${locale}`)
      .then((res) => (res.ok ? (res.json() as Promise<FullMessages>) : null))
      .catch(() => null)
      .then((full) => {
        if (full) fullLoaded.set(locale, full);
        // Не вышло (нет сети) — показываем то, что есть, и пробуем снова при следующем переходе
        else fullLoads.delete(locale);
        return full;
      });
    fullLoads.set(locale, load);
  }
  return load;
}

/**
 * Клиентский провайдер переводов. Ключа нет даже в ru → на экране «⋯», в консоли
 * `[i18n:missing] …` (это ловит scripts/measure.mjs). Сырой «namespace.key» пользователю не показываем.
 *
 * Публичная страница получает только свои словари (partial). Переход на страницу, которой нужны все
 * (кабинет, профиль), ждёт их загрузки внутри перехода — старая страница остаётся на экране, «⋯» не мелькает.
 */
export function IntlProvider({ locale, messages, fallbackKeys, partial = false, children }: IntlProviderProps) {
  'use no memo'; // читает модульный кэш словарей во время отрисовки — автоматическое запоминание здесь неуместно
  const pathname = usePathname();
  // На публичной странице встретился ключ из словаря, которого нет в её наборе — догрузить все словари
  const [missedIn, setMissedIn] = useState<Locale | null>(null);
  const needFull = partial && (missedIn === locale || namespacesForPath(splitLocalePrefix(pathname).pathname) === null);
  const full = partial ? (fullLoaded.get(locale) ?? (needFull ? use(loadFull(locale)) : null)) : null;
  const current = full ?? { messages, fallbackKeys };
  setFallbackKeys(locale, current.fallbackKeys);
  const recover = partial && !full && missedIn !== locale;
  const loaded = current.messages;
  // Одни и те же функции между переходами: иначе провайдер будил бы все тексты на каждой смене адреса
  const getMessageFallback = useCallback(
    ({ namespace, key }: { namespace?: string; key: string }) => {
      const ns = (namespace ?? key).split('.')[0];
      if (recover && ns && !(ns in loaded) && typeof window !== 'undefined') {
        queueMicrotask(() => startTransition(() => setMissedIn(locale)));
      }
      return MISSING_TEXT;
    },
    [recover, loaded, locale],
  );
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={loaded}
      timeZone={TIME_ZONE}
      onError={reportMissing}
      getMessageFallback={getMessageFallback}
    >
      {children}
    </NextIntlClientProvider>
  );
}

function reportMissing(error: IntlError) {
  console.error(`[i18n:missing] ${error.message}`);
}
