/**
 * Подсчёт SMS-частей и цены (Ув8, Ув13) — по правилам GSM 03.38, как считают операторы:
 *  - текст целиком из алфавита GSM-7 (латиница, цифры, базовая пунктуация) — 160 символов в одной SMS,
 *    153 в каждой части длинной (склеенной) SMS; символы расширения (€ [ ] { } ~ ^ \ |) занимают по 2 места;
 *  - хотя бы один символ вне GSM-7 (кириллица, армянский, «ёлочки», эмодзи…) — весь текст уходит в UCS-2:
 *    70 символов в одной SMS, 67 в части длинной; символ вне BMP (эмодзи) занимает 2 места (две UTF-16 единицы).
 * Цена — части × тариф SMS-агрегатора (NETWORK_SMS_RATE_AMD, 25 ֏ за часть).
 */
import { NETWORK_SMS_RATE_AMD } from '@/domain/notify';

const GSM7_BASIC =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
const GSM7_EXTENDED = '^{}\\[~]|€\f';

const BASIC = new Set(Array.from(GSM7_BASIC));
const EXTENDED = new Set(Array.from(GSM7_EXTENDED));

export type SmsEncoding = 'gsm7' | 'ucs2';

export interface SmsCount {
  encoding: SmsEncoding;
  /** Сколько «мест» занимает текст в своей кодировке (для GSM-7 символ расширения = 2, для UCS-2 эмодзи = 2) */
  units: number;
  /** Сколько SMS-частей (0 — пустой текст) */
  parts: number;
  /** Мест в одной части при текущей длине: 160/153 или 70/67 */
  perPart: number;
  /** Сколько мест осталось до следующей части */
  remaining: number;
}

export const SMS_LIMITS = {
  gsm7: { single: 160, multi: 153 },
  ucs2: { single: 70, multi: 67 },
} as const;

export const SMS_PART_PRICE_AMD = NETWORK_SMS_RATE_AMD;

export function detectSmsEncoding(text: string): SmsEncoding {
  for (const ch of text) {
    if (!BASIC.has(ch) && !EXTENDED.has(ch)) return 'ucs2';
  }
  return 'gsm7';
}

export function countSms(text: string): SmsCount {
  const encoding = detectSmsEncoding(text);
  let units = 0;
  if (encoding === 'gsm7') {
    for (const ch of text) units += EXTENDED.has(ch) ? 2 : 1;
  } else {
    // UTF-16 единицы: всё из BMP (кириллица, армянский) — 1, эмодзи и прочее вне BMP — 2
    units = text.length;
  }
  const limits = SMS_LIMITS[encoding];
  if (units === 0) return { encoding, units, parts: 0, perPart: limits.single, remaining: limits.single };
  if (units <= limits.single) return { encoding, units, parts: 1, perPart: limits.single, remaining: limits.single - units };
  const parts = Math.ceil(units / limits.multi);
  return { encoding, units, parts, perPart: limits.multi, remaining: parts * limits.multi - units };
}

/** Цена одной SMS этого текста, ֏ */
export function smsPriceAmd(text: string): number {
  return countSms(text).parts * SMS_PART_PRICE_AMD;
}
