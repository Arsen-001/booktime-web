'use client';

/**
 * ⭐ Допродажа при записи (владелец, 01.10.2026): на шаге «Детали» виджета/ссылки — «Добавить к визиту».
 * Сопутствующие из карточек выбранных услуг: услуги, которые тот же мастер успеет сразу после (окно проверено
 * сервером), и товары со склада (оплата на визите). Одно касание — добавить, ещё одно — убрать. Нечего
 * предложить — блока нет. Добавки идут к последней части визита (продление в конце ничего не сдвигает).
 */
import { useLocale } from 'next-intl';
import { Package, Sparkles } from 'lucide-react';
import { useApiQuery } from '@/api/request';
import { getUpsellOffers } from '@/api/services-upsell';
import type { Id, ISODateTime, LocaleCode } from '@/domain/core';
import type { BookingAddOns, UpsellOffers } from '@/domain/services';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { pickText } from '@/lib/text';
import { AddOnList, type AddOnItem } from '@/ui/AddOnList';
import { Card } from '@/ui/Card';

export const NO_ADD_ONS: BookingAddOns = { serviceIds: [], productIds: [] };

export interface AddOnsTarget {
  staffId: Id;
  serviceIds: Id[];
  start: ISODateTime;
  locationId?: Id;
}

export const upsellOffersKey = (q: AddOnsTarget, added: Id[] = []) =>
  ['online', 'upsellOffers', q.staffId, q.serviceIds.join(','), q.start, q.locationId ?? '', added.join(',')] as const;

export const fetchUpsellOffers = (q: AddOnsTarget, added: Id[] = []) => getUpsellOffers({ ...q, added });

/** Что добавлено: строки для итога визита и минуты продления */
export function addedLines(offers: UpsellOffers | undefined, value: BookingAddOns, locale: LocaleCode) {
  const services = (offers?.services ?? [])
    .filter((s) => value.serviceIds.includes(s.serviceId))
    .map((s) => ({ id: s.serviceId, name: pickText(s.name, locale), min: s.priceMin, max: s.priceMax ?? s.priceMin, minutes: s.durationMax ?? s.durationMin }));
  const products = (offers?.products ?? [])
    .filter((p) => value.productIds.includes(p.productId))
    .map((p) => ({ id: p.productId, name: pickText(p.name, locale), min: p.price, max: p.price, minutes: 0 }));
  return { services, products, minutes: services.reduce((a, s) => a + s.minutes, 0) };
}

export function AddOnsBlock({
  target,
  value,
  onChange,
  hourCycle,
}: {
  target: AddOnsTarget;
  value: BookingAddOns;
  onChange: (v: BookingAddOns) => void;
  hourCycle?: '24' | '12';
}) {
  const t = useT('online');
  const format = useFormat({ hourCycle });
  const locale = useLocale();
  const baseQ = useApiQuery(upsellOffersKey(target), () => fetchUpsellOffers(target));
  const withQ = useApiQuery(upsellOffersKey(target, value.serviceIds), () => fetchUpsellOffers(target, value.serviceIds), {
    enabled: value.serviceIds.length > 0,
  });
  const base = baseQ.data;
  if (!base || (base.services.length === 0 && base.products.length === 0)) return null;
  const stillFits = (id: Id) => value.serviceIds.length === 0 || !withQ.data || withQ.data.services.some((s) => s.serviceId === id);

  const items: AddOnItem[] = [
    ...base.services.map((s) => {
      const selected = value.serviceIds.includes(s.serviceId);
      const fits = selected || stillFits(s.serviceId);
      return {
        id: `s:${s.serviceId}`,
        title: pickText(s.name, locale),
        meta: fits ? `${format.duration(s.durationMin)}${s.durationMax ? `–${format.duration(s.durationMax)}` : ''} · ${format.moneyRange(s.priceMin, s.priceMax)}` : t('booking.addOns.noTime'),
        selected,
        disabled: !fits,
        icon: <Sparkles aria-hidden />,
      };
    }),
    ...base.products.map((p) => ({
      id: `p:${p.productId}`,
      title: pickText(p.name, locale),
      meta: t('booking.addOns.productMeta', { price: format.money(p.price) }),
      selected: value.productIds.includes(p.productId),
      icon: <Package aria-hidden />,
    })),
  ];

  const toggle = (key: string) => {
    const id = key.slice(2);
    if (key.startsWith('s:')) {
      const has = value.serviceIds.includes(id);
      onChange({ ...value, serviceIds: has ? value.serviceIds.filter((x) => x !== id) : [...value.serviceIds, id] });
    } else {
      const has = value.productIds.includes(id);
      onChange({ ...value, productIds: has ? value.productIds.filter((x) => x !== id) : [...value.productIds, id] });
    }
  };

  return (
    <Card padding="md" className="flex flex-col gap-1" data-f="F-03-090">
      <h2 className="font-semibold text-fg">{t('booking.addOns.title')}</h2>
      <p className="text-sm text-muted">{t('booking.addOns.hint')}</p>
      <AddOnList items={items} onToggle={toggle} aria-label={t('booking.addOns.title')} />
    </Card>
  );
}
