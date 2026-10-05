/**
 * Черновик формы заказа (useState, не база) и проверка полей — чистые функции. Ошибки — ключи словаря orders.form.errors.*
 */
import type { Id, ISODate } from '@/domain/core';
import type { Order, OrderInput, OrderItem } from '@/domain/orders';
import { normalizePhone } from '@/lib/phone';

export interface ItemDraft {
  key: string;
  title: string;
  qty: string;
  note: string;
}

export interface OrderDraft {
  clientId: Id | null;
  clientName: string;
  clientPhone: string;
  items: ItemDraft[];
  photos: string[];
  staffId: Id | '';
  dueDate: ISODate | null;
  price: number | undefined;
  prepaid: number | undefined;
  comment: string;
}

export type OrderFormErrorKey = 'clientName' | 'clientPhone' | 'items' | 'price' | 'prepaidOverPrice';
export type OrderFormErrors = Partial<Record<'clientName' | 'clientPhone' | 'items' | 'price' | 'prepaid', OrderFormErrorKey>>;

let seq = 0;
export const newItem = (item?: Partial<OrderItem>): ItemDraft => ({
  key: `item-${++seq}`,
  title: item?.title ?? '',
  qty: String(item?.qty ?? 1),
  note: item?.note ?? '',
});

export function emptyDraft(): OrderDraft {
  return { clientId: null, clientName: '', clientPhone: '', items: [newItem()], photos: [], staffId: '', dueDate: null, price: undefined, prepaid: undefined, comment: '' };
}

/** ⭐ По записи на сдачу (05.10.2026): клиент и мастер — из записи, первая вещь — то, что клиент написал о ней */
export function draftFromBooking(b: { clientId: Id | null; clientName: string; clientPhone: string; description: string | null; staffId: Id | null }): OrderDraft {
  return { ...emptyDraft(), clientId: b.clientId, clientName: b.clientName, clientPhone: b.clientPhone, items: [newItem({ title: (b.description ?? '').trim().slice(0, 200) })], staffId: b.staffId ?? '' };
}

export function draftFromOrder(o: Order): OrderDraft {
  return {
    clientId: o.clientId,
    clientName: o.clientName,
    clientPhone: o.clientPhone,
    items: o.items.length ? o.items.map((i) => newItem(i)) : [newItem()],
    photos: o.photos,
    staffId: o.staffId ?? '',
    dueDate: o.dueDate,
    price: o.price,
    prepaid: o.prepaid,
    comment: o.comment ?? '',
  };
}

const items = (d: OrderDraft): OrderItem[] =>
  d.items
    .map((i) => ({ title: i.title.trim(), qty: Math.max(1, Math.round(Number(i.qty) || 1)), ...(i.note.trim() ? { note: i.note.trim() } : {}) }))
    .filter((i) => i.title);

export function validateDraft(d: OrderDraft): OrderFormErrors {
  const e: OrderFormErrors = {};
  if (!d.clientName.trim()) e.clientName = 'clientName';
  if (!normalizePhone(d.clientPhone)) e.clientPhone = 'clientPhone';
  if (!items(d).length) e.items = 'items';
  if (d.price === undefined || d.price < 0) e.price = 'price';
  if ((d.prepaid ?? 0) > (d.price ?? 0)) e.prepaid = 'prepaidOverPrice';
  return e;
}

export function draftToInput(d: OrderDraft): OrderInput {
  return {
    clientId: d.clientId,
    clientName: d.clientName.trim(),
    clientPhone: normalizePhone(d.clientPhone) ?? d.clientPhone,
    items: items(d),
    photos: d.photos,
    staffId: d.staffId || null,
    dueDate: d.dueDate,
    price: d.price ?? 0,
    prepaid: d.prepaid ?? 0,
    comment: d.comment.trim() || null,
  };
}

/** Сравнение для «есть несохранённое» — по тому, что уйдёт на сервер */
export function sameDraft(a: OrderDraft, b: OrderDraft): boolean {
  return JSON.stringify(draftToInput(a)) === JSON.stringify(draftToInput(b));
}
