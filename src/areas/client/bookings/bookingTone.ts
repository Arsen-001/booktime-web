/**
 * Тон карточки записи клиента (docs/design/DESIGN.md → «Booking card C · Tone»): вся карточка — светлая заливка
 * цвета категории услуги, крупное время — тёмным тоном того же цвета. Тот же язык, что у карточки записи в журнале
 * (src/areas/journal/lib/board.ts → bookingTone), но свой файл: раздел client не трогает src/areas/journal.
 *
 * Палитра — те же 8 «лаковых» оттенков, что в журнале (одна и та же лента цветов должна читаться одинаково в обоих
 * приложениях). Индекс — стабильный хэш id категории, а не порядок в каталоге: у клиента нет всего каталога под рукой
 * (только услуга самой записи), а хэш даёт тот же цвет одной и той же категории на всех экранах клиента.
 */
import { tone, type Tone } from '@/ui/tone';
import type { BookingStatus } from '@/domain/core';

const CATEGORY_HEX = [
  '#d98a9e', // tokens-ok — розовый
  '#8fb9a8', // tokens-ok — шалфей
  '#a896d6', // tokens-ok — лаванда
  '#e2a878', // tokens-ok — персик
  '#7fa3d1', // tokens-ok — голубой
  '#c9a95c', // tokens-ok — песок
  '#9cb4c4', // tokens-ok — туман
  '#cf8fbf', // tokens-ok — орхидея
] as const;

/** Отменённая/неявка — цвет категории не показываем: карточка нейтральная, приглушённая */
const NEUTRAL_HEX = '#9a99ad'; // tokens-ok — tone() считает оттенки из hex, как палитра выше

/** Статусы, при которых записи больше не «живые» — тон гасим, а не подсвечиваем */
const INACTIVE: readonly BookingStatus[] = ['cancelled_by_client', 'cancelled_by_master', 'no_show'];
/** Статусы «ждёт ответа» — пунктирная рамка (DESIGN.md) */
export const AWAITING: readonly BookingStatus[] = ['awaiting_confirmation', 'awaiting_prepayment'];

function hashToIndex(id: string, mod: number): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return hash % mod;
}

const toneCache = new Map<string, Tone>();
function cachedTone(hex: string): Tone {
  let t = toneCache.get(hex);
  if (!t) {
    t = tone(hex);
    toneCache.set(hex, t);
  }
  return t;
}

/** Тон карточки: цвет категории услуги записи, приглушённый для отменённых и неявок */
export function bookingCardTone(status: BookingStatus, categoryId?: string): Tone {
  if (INACTIVE.includes(status)) return cachedTone(NEUTRAL_HEX);
  const hex = categoryId ? CATEGORY_HEX[hashToIndex(categoryId, CATEGORY_HEX.length)] : CATEGORY_HEX[0];
  return cachedTone(hex);
}
