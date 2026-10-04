import 'server-only';
import en from '@messages/en/platform.json';
import hy from '@messages/hy/platform.json';
import ru from '@messages/ru/platform.json';
import type { Locale } from '@/i18n/config';

/**
 * Тексты слайдов презентации для салонов на всех трёх языках (messages/<lang>/platform.json → pitchDeck).
 * Язык показа выбирается на странице независимо от языка панели, поэтому странице нужны все три сразу —
 * сервер отдаёт только этот кусок словарей, а не весь platform.json.
 */
export type PitchDeckTexts = typeof ru.pitchDeck;

export const PITCH_DECKS: Record<Locale, PitchDeckTexts> = {
  hy: hy.pitchDeck,
  ru: ru.pitchDeck,
  en: en.pitchDeck,
};
