import type { WaitlistWish } from '@/api/resources';
import type { useFormat } from '@/i18n/useFormat';
import type { useT } from '@/i18n/useT';

/** «пт, 3 окт · 10:00–12:00, 16:00–18:00», «Любой день · 18:00», «пт, 3 окт · Любое время» — одна строка желания */
export function wishText(wish: WaitlistWish, format: ReturnType<typeof useFormat>, t: ReturnType<typeof useT>): string {
  // Желание без даты — «любой день, но с 10 до 12»
  const datePart = wish.date ? format.date(wish.date, 'short') : t('waitlist.anyDay');
  if (wish.intervals && wish.intervals.length > 0) {
    return `${datePart} · ${wish.intervals.map((iv) => (iv.from === iv.to ? iv.from : `${iv.from}–${iv.to}`)).join(', ')}`;
  }
  return wish.time ? `${datePart} · ${wish.time}` : `${datePart} · ${t('waitlist.anyTime')}`;
}
