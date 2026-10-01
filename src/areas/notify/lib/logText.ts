import type { LocalizedText } from '@/domain/core';
import type { LogMessage, NotifyLanguage } from '@/domain/notify';

/**
 * Текст строки журнала на языке, на котором сообщение фактически ушло (Ув16), — не на языке кабинета: владелец
 * должен видеть то, что прочитал клиент. Нет sentLanguage (ранние строки, текст владельца) — ru.
 */
export function sentText(m: Pick<LogMessage, 'text' | 'sentLanguage'>): string {
  const lang: NotifyLanguage = m.sentLanguage ?? 'ru';
  return m.text[lang] || m.text.ru || m.text.en || '';
}

/** Название типа — на языке интерфейса кабинета (это наша подпись, не текст клиенту) */
export function typeLabelIn(label: LocalizedText, locale: string): string {
  return label[locale as NotifyLanguage] || label.ru;
}
