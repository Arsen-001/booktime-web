'use client';

/**
 * Что написано на квитанции — один раз для экрана и для PNG (04.10.2026): бизнес (название, адрес, телефон), заказ,
 * дата приёма, клиент, что сдали, срок, цена / предоплата / осталось и ссылка статуса /o/<код>.
 */
import { useCoreGet } from '@/api/core';
import { useCurrent } from '@/demo/hooks';
import { orderRemaining, type Order } from '@/domain/orders';
import { useFormat } from '@/i18n/useFormat';
import { useLocale } from 'next-intl';
import { useT } from '@/i18n/useT';
import { pickText } from '@/lib/text';

export interface ReceiptModel {
  businessName: string;
  address: string;
  phone: string;
  title: string;
  accepted: string;
  client: string;
  due: string;
  items: string[];
  price: string;
  prepaid: string | null;
  remaining: string;
  url: string;
}

export function useReceiptModel(order: Order | undefined, origin: string): { model: ReceiptModel | null; loading: boolean } {
  const t = useT('orders');
  const fmt = useFormat();
  const locale = useLocale() as 'ru' | 'en' | 'hy';
  const { businessId } = useCurrent();
  const businessQ = useCoreGet('businesses', businessId);
  const locationId = order?.locationId ?? businessQ.data?.locationIds[0];
  const locationQ = useCoreGet('locations', locationId);
  if (!order) return { model: null, loading: true };
  const business = businessQ.data;
  const location = locationQ.data;
  const at = (v: string) => `${fmt.date(v, 'weekday')}, ${fmt.time(v)}`;
  return {
    loading: businessQ.isLoading || (Boolean(locationId) && locationQ.isLoading),
    model: {
      businessName: business?.brandName || business?.name || '',
      address: location?.address ? pickText(location.address, locale) : '',
      phone: location?.phone || business?.phone ? fmt.phone(location?.phone || business?.phone || '') : '',
      title: t('receipt.order', { number: order.number }),
      accepted: at(order.createdAt),
      client: order.clientName,
      due: order.dueDate ? fmt.date(order.dueDate, 'weekday') : t('receipt.noDue'),
      items: order.items.map((i) => (i.qty > 1 ? `${i.title} ×${i.qty}` : i.title)),
      price: fmt.money(order.price),
      prepaid: order.prepaid > 0 ? fmt.money(order.prepaid) : null,
      remaining: fmt.money(orderRemaining(order)),
      url: `${origin}/o/${order.code}`,
    },
  };
}
