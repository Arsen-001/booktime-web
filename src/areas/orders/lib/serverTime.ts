import type { ISODateTime } from '@/domain/core';
import { dayjs, YEREVAN_TZ } from '@/lib/date';

/**
 * Время с сервера может прийти с поясом ('2026-10-03T10:30:00.000Z') — в данных у нас местное время Еревана без
 * пояса ('2026-10-03T14:30'), как в моке. Местное время без пояса — как есть (обрезаем секунды).
 */
export function toLocalDateTime(value: string | null | undefined): ISODateTime | null {
  if (!value) return null;
  if (!/[zZ]|[+-]\d{2}:?\d{2}$/.test(value)) return value.slice(0, 16);
  try {
    return dayjs(value).tz(YEREVAN_TZ).format('YYYY-MM-DDTHH:mm');
  } catch {
    return value.slice(0, 16);
  }
}
