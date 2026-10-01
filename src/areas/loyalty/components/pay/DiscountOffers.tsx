'use client';

import { Percent } from 'lucide-react';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import type { Id } from '@/domain/core';

export interface DiscountOffer {
  id: Id;
  cardId: Id;
  name: string;
  /** Сколько даст сверх уже действующей личной скидки клиента */
  extra: number;
}

export interface DiscountOffersProps {
  offers: DiscountOffer[];
  /** Id акции, которая сейчас стоит скидкой визита (её чип не показываем) */
  currentPromotionId?: Id;
  /** Уже есть скидка на визит — остальные предлагаются как «Заменить» (Л4: одна скидка на визит) */
  hasDiscount: boolean;
  busy?: boolean;
  onPick: (offer: DiscountOffer) => void;
}

/**
 * Л4: скидочные акции держателя от выгодной к менее выгодной. Пока скидки нет — «Применить» у каждой; как
 * только одна стоит — у остальных «Заменить», вторая скидка на тот же визит не складывается.
 */
export function DiscountOffers({ offers, currentPromotionId, hasDiscount, busy, onPick }: DiscountOffersProps) {
  const t = useT('loyalty');
  const format = useFormat();
  const visible = offers.filter((o) => o.id !== currentPromotionId);
  if (visible.length === 0) return null;
  return (
    <div data-f="F-06-063 F-06-064" className="flex flex-wrap gap-1.5">
      {visible.map((o, i) => (
        <button
          key={`${o.id}_${o.cardId}`}
          type="button"
          disabled={busy}
          onClick={() => onPick(o)}
          className="flex min-h-9 items-center gap-1.5 rounded-full border border-primary/40 bg-primary/5 px-3 py-1.5 text-sm font-medium text-primary-text transition-colors hover:bg-primary/10 disabled:opacity-50"
        >
          <Percent aria-hidden className="size-3.5" />
          {hasDiscount
            ? t('bookingWindow.pay.promoReplace', { name: o.name, amount: format.money(o.extra) })
            : t(i === 0 ? 'bookingWindow.pay.promoBest' : 'bookingWindow.pay.promoTile', { name: o.name, amount: format.money(o.extra) })}
        </button>
      ))}
    </div>
  );
}
