import { getRequestConfig } from 'next-intl/server';
import { MISSING_TEXT, TIME_ZONE } from '@/i18n/config';
import { loadMessages } from '@/i18n/load';
import { getRequestLocale } from '@/i18n/locale';

// Конфигурация next-intl для серверных компонентов. Язык без префикса в адресе — из cookie.
export default getRequestConfig(async () => {
  const locale = await getRequestLocale();
  const { messages } = await loadMessages(locale);
  return {
    locale,
    messages,
    timeZone: TIME_ZONE,
    onError(error) {
      console.error(`[i18n:missing] ${error.message}`);
    },
    getMessageFallback() {
      return MISSING_TEXT;
    },
  };
});
