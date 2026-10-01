'use client';

/** «до 17 окт · осталось 22 дня» или «закончилось 30 авг» — будущее и прошлое различаются словами, а не только цветом */
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { parse, today } from '@/lib/date';

export function useFreeUntilText() {
  const t = useT('platform');
  const fmt = useFormat();
  return (date: string) => {
    const left = parse(date).diff(parse(today()), 'day');
    return left >= 0 ? t('businesses.freeLeft', { date: fmt.date(date, 'dayMonth'), n: left }) : t('businesses.freeEnded', { date: fmt.date(date, 'dayMonth') });
  };
}
