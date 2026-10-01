/**
 * Короткие ссылки SMS (28.09): `booktime.am/s/<код>` вместо `booktime.am/b/<slug>/booking/<id>?h=…` —
 * полная ссылка одна съедала больше половины SMS (70 символов в кириллице/армянском).
 *
 * Код в моке детерминированный: 6 знаков base62 от хеша «бизнес + путь» — одна и та же ссылка каждый раз даёт
 * один и тот же код, поэтому живой журнал (выводится заново на каждое чтение) не плодит новые коды. На сервере
 * код случайный (crypto), таблица short_links. 62^6 ≈ 5,7·10^10 — совпадение разрешается солью (salt).
 */
/**
 * Короткая ссылка `booktime.am/s/<code>` — ведёт на полный адрес на нашем же домене. На сервере — таблица
 * short_links (этап 21), в моке — срез notify.shortLinks по коду.
 */
export interface ShortLink {
  code: string;
  /** Путь на нашем домене, с «/» в начале: /b/<slug>/booking/<id>?h=… */
  target: string;
  businessId: string;
  createdAt: string;
  expiresAt?: string;
}

export const SHORT_HOST = 'booktime.am';
export const SHORT_CODE_LENGTH = 6;

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/** FNV-1a 32 бита с разным началом — два независимых хеша на 64 бита вместе */
function fnv(text: string, seed: number): number {
  let h = seed >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function shortCodeFor(businessId: string, target: string, salt = 0): string {
  const key = `${businessId}|${target}|${salt}`;
  let a = fnv(key, 0x811c9dc5);
  let b = fnv(key, 0x9747b28c);
  let out = '';
  for (let i = 0; i < SHORT_CODE_LENGTH; i++) {
    // Берём разряды попеременно из двух половин, чтобы обе участвовали в коде
    const src = i % 2 === 0 ? a : b;
    out += ALPHABET[src % 62];
    if (i % 2 === 0) a = Math.floor(a / 62);
    else b = Math.floor(b / 62);
  }
  return out;
}

export function isShortCode(code: string): boolean {
  return /^[0-9A-Za-z]{4,12}$/.test(code);
}

export function shortUrl(code: string): string {
  return `${SHORT_HOST}/s/${code}`;
}

/** «booktime.am/b/x/book» или «https://booktime.am/b/x/book» → «/b/x/book»; чужой адрес — null (его не сокращаем) */
export function ownPathOf(link: string): string | null {
  const m = /^(?:https?:\/\/)?booktime\.am(\/.*)$/.exec(link.trim());
  return m ? m[1] : null;
}

/** Цель короткой ссылки безопасна для перехода: только путь на нашем домене, не «//чужой.сайт» */
export function isSafeTarget(target: string): boolean {
  return target.startsWith('/') && !target.startsWith('//') && !target.startsWith('/\\');
}
