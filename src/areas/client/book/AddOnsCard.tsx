'use client';

/**
 * ⭐ Допродажа при записи (владелец, 01.10.2026): на шаге «Подтверждение» — «Добавить к визиту». Сопутствующие из
 * карточки услуги, которые мастер успеет сделать в это же время (услуги), и товары, которые есть на складе (оплата на
 * визите). Одно касание — добавить, ещё одно — убрать. Нечего предложить — блока нет.
 */
import { useLocale } from 'next-intl';
import { Package, Sparkles } from 'lucide-react';
import { useApiQuery } from '@/api/request';
import { getUpsellOffers } from '@/api/services-upsell';
import { useClientFormat } from '@/areas/client/useClientFormat';
import type { Id, ISODateTime } from '@/domain/core';
import type { BookingAddOns, UpsellOffers } from '@/domain/services';
import { useT } from '@/i18n/useT';
import { pickText } from '@/lib/text';
import { AddOnList, type AddOnItem } from '@/ui/AddOnList';
import { Card } from '@/ui/Card';

export const NO_ADD_ONS: BookingAddOns = { serviceIds: [], productIds: [] };

/** Сумма добавленного (нижняя и верхняя граница) — для итога записи */
export function addOnsTotal(offers: UpsellOffers | undefined, value: BookingAddOns): { min: number; max: number; minutes: number } {
  let min = 0;
  let max = 0;
  let minutes = 0;
  for (const s of offers?.services ?? []) {
    if (!value.serviceIds.includes(s.serviceId)) continue;
    min += s.priceMin;
    max += s.priceMax ?? s.priceMin;
    minutes += s.durationMax ?? s.durationMin;
  }
  for (const p of offers?.products ?? []) {
    if (!value.productIds.includes(p.productId)) continue;
    min += p.price;
    max += p.price;
  }
  return { min, max, minutes };
}

export const addOnsKey = (staffId: Id, serviceId: Id, start: ISODateTime | undefined) => ['client', 'upsellOffers', staffId, serviceId, start ?? ''] as const;

export function AddOnsCard({
  staffId,
  serviceId,
  start,
  value,
  onChange,
}: {
  staffId: Id;
  serviceId: Id;
  start: ISODateTime;
  value: BookingAddOns;
  onChange: (v: BookingAddOns) => void;
}) {
  const t = useT('client');
  const fmt = useClientFormat();
  const locale = useLocale();
  const baseQ = useApiQuery(addOnsKey(staffId, serviceId, start), () => getUpsellOffers({ staffId, serviceIds: [serviceId], start }));
  // С уже добавленными услугами — что ещё помещается в это время
  const withQ = useApiQuery(
    ['client', 'upsellOffers', staffId, serviceId, start, value.serviceIds.join(',')],
    () => getUpsellOffers({ staffId, serviceIds: [serviceId], start, added: value.serviceIds }),
    { enabled: value.serviceIds.length > 0 },
  );
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
        meta: fits ? `${fmt.duration(s.durationMin)}${s.durationMax ? `–${fmt.duration(s.durationMax)}` : ''} · ${fmt.moneyRange(s.priceMin, s.priceMax)}` : t('book.addOns.noTime'),
        selected,
        disabled: !fits,
        icon: <Sparkles aria-hidden />,
      };
    }),
    ...base.products.map((p) => ({
      id: `p:${p.productId}`,
      title: pickText(p.name, locale),
      meta: t('book.addOns.productMeta', { price: fmt.money(p.price) }),
      selected: value.productIds.includes(p.productId),
      icon: <Package aria-hidden />,
    })),
  ];

  const toggle = (key: string) => {
    const [kind, id] = [key.slice(0, 1), key.slice(2)];
    if (kind === 's') {
      const has = value.serviceIds.includes(id);
      onChange({ ...value, serviceIds: has ? value.serviceIds.filter((x) => x !== id) : [...value.serviceIds, id] });
    } else {
      const has = value.productIds.includes(id);
      onChange({ ...value, productIds: has ? value.productIds.filter((x) => x !== id) : [...value.productIds, id] });
    }
  };

  return (
    <Card padding="md" className="flex flex-col gap-1" data-f="F-00-092">
      <h2 className="font-semibold text-fg">{t('book.addOns.title')}</h2>
      <p className="text-sm text-muted">{t('book.addOns.hint')}</p>
      <AddOnList items={items} onToggle={toggle} aria-label={t('book.addOns.title')} />
    </Card>
  );
}
