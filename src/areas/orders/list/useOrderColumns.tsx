'use client';

/** Колонки списка заказов и карточка строки на телефоне (у скелетона — та же разметка). */
import { TriangleAlert } from 'lucide-react';
import { useCan } from '@/demo/hooks';
import { isOrderOverdue, orderItemsSummary, orderRemaining, type Order } from '@/domain/orders';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { today } from '@/lib/date';
import { OrderStatusBadge } from '@/areas/orders/ui/OrderStatusBadge';
import { Skeleton, SkeletonText } from '@/ui/Skeleton';
import type { TableColumn } from '@/ui/Table';

/** Срок: «Сегодня», «Завтра», «чт, 9 октября»; просроченный — цветом предупреждения и словом */
export function OrderDue({ order }: { order: Order }) {
  const t = useT('orders');
  const fmt = useFormat();
  if (order.status === 'issued' && order.issuedAt) return <span className="whitespace-nowrap text-muted">{t('list.issuedOn', { date: fmt.date(order.issuedAt, 'dayMonthShort') })}</span>;
  if (!order.dueDate) return <span className="text-muted">{t('list.noDue')}</span>;
  const overdue = isOrderOverdue(order, today());
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap', overdue ? 'font-semibold text-warning' : 'text-fg', order.status === 'cancelled' && 'text-muted')}>
      {overdue && <TriangleAlert aria-hidden className="size-4 shrink-0" />}
      {fmt.relativeDay(order.dueDate)}
      {overdue && <span className="sr-only">{t('list.overdue')}</span>}
    </span>
  );
}

/** Сумма и остаток: «52 000 ֏» · «осталось 32 000 ֏» / «оплачено» */
export function OrderMoney({ order, align = 'right' }: { order: Order; align?: 'left' | 'right' }) {
  const t = useT('orders');
  const fmt = useFormat();
  const left = orderRemaining(order);
  return (
    <span className={cn('flex flex-col', align === 'right' ? 'items-end' : 'items-start')}>
      <span className="font-semibold whitespace-nowrap text-fg tabular-nums">{fmt.money(order.price)}</span>
      <span className="text-xs whitespace-nowrap text-muted">{order.price > 0 && left === 0 ? t('list.paid') : t('list.left', { amount: fmt.money(left) })}</span>
    </span>
  );
}

function useClientPhone() {
  const fmt = useFormat();
  const canPhones = useCan('clients.phones');
  return (phone: string) => (canPhones ? fmt.phone(phone) : fmt.maskedPhone(phone));
}

function ClientCell({ order }: { order: Order }) {
  const phone = useClientPhone();
  return (
    <span className="flex min-w-0 flex-col">
      <span className="truncate font-medium text-fg">{order.clientName}</span>
      <span className="truncate text-sm text-muted">{phone(order.clientPhone)}</span>
    </span>
  );
}

const CLIENT_SKELETON = (
  <span className="flex min-w-0 flex-col">
    <span className="truncate font-medium text-fg">
      <SkeletonText width="14ch" />
    </span>
    <span className="truncate text-sm text-muted">
      <SkeletonText width="13ch" />
    </span>
  </span>
);

const MONEY_SKELETON = (
  <span className="flex flex-col items-end">
    <span className="font-semibold text-fg">
      <SkeletonText width="8ch" />
    </span>
    <span className="text-xs text-muted">
      <SkeletonText width="11ch" />
    </span>
  </span>
);

export function useOrderColumns(): TableColumn<Order>[] {
  const t = useT('orders');
  return [
    {
      id: 'number',
      header: t('columns.number'),
      width: '6rem',
      skeletonWidth: '5ch',
      cell: (o) => <span className="font-semibold whitespace-nowrap text-fg tabular-nums">{t('numberShort', { number: o.number })}</span>,
    },
    { id: 'client', header: t('columns.client'), width: '15rem', skeleton: CLIENT_SKELETON, cell: (o) => <ClientCell order={o} /> },
    {
      id: 'items',
      header: t('columns.items'),
      skeletonWidth: '24ch',
      cell: (o) => <span className="line-clamp-2 text-fg">{orderItemsSummary(o.items)}</span>,
    },
    { id: 'due', header: t('columns.due'), width: '10rem', skeletonWidth: '9ch', cell: (o) => <OrderDue order={o} /> },
    {
      id: 'status',
      header: t('columns.status'),
      width: '9rem',
      skeleton: <Skeleton className="h-6 w-20 rounded-full" />,
      cell: (o) => <OrderStatusBadge status={o.status} />,
    },
    { id: 'money', header: t('columns.money'), width: '10rem', align: 'right', skeleton: MONEY_SKELETON, cell: (o) => <OrderMoney order={o} /> },
  ];
}

/** Карточка заказа на телефоне: №, статус; клиент; что сдали; срок и сумма */
export function OrderMobileCard({ order }: { order: Order }) {
  const t = useT('orders');
  return (
    <span className="flex min-w-0 flex-col gap-1.5">
      <span className="flex items-center justify-between gap-3">
        <span className="font-semibold text-fg tabular-nums">{t('numberShort', { number: order.number })}</span>
        <OrderStatusBadge status={order.status} />
      </span>
      <span className="truncate font-medium text-fg">{order.clientName}</span>
      <span className="truncate text-sm text-muted">{orderItemsSummary(order.items)}</span>
      <span className="mt-1 flex items-end justify-between gap-3 text-sm">
        <OrderDue order={order} />
        <OrderMoney order={order} />
      </span>
    </span>
  );
}

export const ORDER_MOBILE_CARD_SKELETON = (
  <span className="flex min-w-0 flex-col gap-1.5">
    <span className="flex items-center justify-between gap-3">
      <span className="font-semibold text-fg">
        <SkeletonText width="5ch" />
      </span>
      <Skeleton className="h-6 w-20 rounded-full" />
    </span>
    <span className="truncate font-medium text-fg">
      <SkeletonText width="14ch" />
    </span>
    <span className="truncate text-sm text-muted">
      <SkeletonText width="22ch" />
    </span>
    <span className="mt-1 flex items-end justify-between gap-3 text-sm">
      <span>
        <SkeletonText width="8ch" />
      </span>
      {MONEY_SKELETON}
    </span>
  </span>
);
