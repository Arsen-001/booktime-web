'use client';

/**
 * /biz/orders/[orderId] — заказ целиком: крупные шаги «Принят → В работе → Готов → Выдан» и одна главная кнопка
 * следующего шага («Взять в работу», «Готово — сообщить клиенту», «Выдать»); у готового — «Отправить ещё раз».
 * Ниже — что сдали, клиент, деньги (осталось = цена − предоплата), ссылка для клиента и история. Редактирование,
 * «Вернуть в работу» и отмена (с подтверждением) — в меню «⋯».
 */
import { useState, useSyncExternalStore } from 'react';
import { Ban, MoreHorizontal, PackageX, Pencil, Send, Undo2 } from 'lucide-react';
import { useCoreGet } from '@/api/core';
import { useCurrent } from '@/demo/hooks';
import { canTransitionOrder, nextOrderStep, orderReadyAt, type Order, type OrderStatus } from '@/domain/orders';
import { useFormat } from '@/i18n/useFormat';
import { addDays, today } from '@/lib/date';
import { useT } from '@/i18n/useT';
import { useOrderActions } from '@/areas/orders/detail/useOrderActions';
import { ClientCard } from '@/areas/orders/detail/ClientCard';
import { HistoryCard } from '@/areas/orders/detail/HistoryCard';
import { ItemsCard } from '@/areas/orders/detail/ItemsCard';
import { MoneyCard } from '@/areas/orders/detail/MoneyCard';
import { PublicLinkCard } from '@/areas/orders/detail/PublicLinkCard';
import { useStaffNames } from '@/areas/orders/detail/useStaffNames';
import { OrderDetailSkeleton } from '@/areas/orders/detail/OrderDetailSkeleton';
import { OrderFormSheet } from '@/areas/orders/form/OrderFormSheet';
import { useOrder } from '@/areas/orders/lib/useOrdersData';
import { OrderProgress } from '@/areas/orders/ui/OrderProgress';
import { OrderStatusBadge } from '@/areas/orders/ui/OrderStatusBadge';
import { ApiError } from '@/api/request';
import { Button, LinkButton } from '@/ui/Button';
import { DropdownMenu, type DropdownMenuItem } from '@/ui/DropdownMenu';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { ExitHold } from '@/ui/ExitHold';
import { IconButton } from '@/ui/IconButton';
import { PageHeader } from '@/ui/PageHeader';
import { StickyActionBar } from '@/ui/StickyActionBar';

const noop = () => () => {};

/** «Сегодня, 12:10» → «сегодня, 12:10» внутри фразы «принят …» */
const lowerFirst = (text: string) => (text ? text.charAt(0).toLocaleLowerCase() + text.slice(1) : text);

/** Подпись главной кнопки следующего шага */
const NEXT_LABEL: Partial<Record<OrderStatus, 'next.in_progress' | 'next.ready' | 'next.issued'>> = {
  in_progress: 'next.in_progress',
  ready: 'next.ready',
  issued: 'next.issued',
};

export function OrderDetailScreen({ orderId }: { orderId: string }) {
  const t = useT('orders');
  const fmt = useFormat();
  const { businessId } = useCurrent();
  const q = useOrder(orderId);
  const order = q.data;
  const businessQ = useCoreGet('businesses', businessId);
  const staffName = useStaffNames(businessId ?? '');
  const actions = useOrderActions(businessId ?? '', order);
  const [editing, setEditing] = useState(false);
  const origin = useSyncExternalStore(noop, () => window.location.origin, () => '');

  if (q.isLoading) return <OrderDetailSkeleton />;
  if (q.isError || !order) {
    const notFound = q.error instanceof ApiError && q.error.code === 'not_found';
    return notFound ? (
      <EmptyState
        icon={<PackageX aria-hidden />}
        title={t('detail.notFound')}
        description={t('detail.notFoundHint')}
        action={<LinkButton href="/biz/orders">{t('detail.backToList')}</LinkButton>}
      />
    ) : (
      <ErrorState onRetry={q.refetch} />
    );
  }

  const next = nextOrderStep(order.status);
  const at = (s: OrderStatus) => [...order.history].reverse().find((h) => h.status === s)?.at;
  const short = (v?: string | null) => (v ? `${fmt.relativeDay(v)}, ${fmt.time(v)}` : undefined);
  // Под шагами — коротко, чтобы на телефоне влезало в строку: сегодня — время, вчера — «Вчера», раньше — «1 окт.»
  const step = (v?: string | null) => {
    if (!v) return undefined;
    if (v.slice(0, 10) === today()) return fmt.time(v);
    if (v.slice(0, 10) === addDays(today(), -1)) return fmt.relativeDay(v);
    return fmt.date(v, 'dayMonthShort');
  };
  const readyAt = orderReadyAt(order);
  const times: Partial<Record<OrderStatus, string>> = {
    received: step(at('received')),
    in_progress: step(at('in_progress')),
    ready: step(readyAt),
    issued: step(order.issuedAt),
  };
  const businessName = businessQ.data?.brandName || businessQ.data?.name || '';

  const menu: DropdownMenuItem[] = [
    { id: 'edit', label: t('detail.edit'), icon: <Pencil aria-hidden />, onSelect: () => setEditing(true) },
    ...(order.status === 'ready' ? [{ id: 'back', label: t('detail.backToWork'), icon: <Undo2 aria-hidden />, onSelect: () => void actions.move('in_progress') }] : []),
    ...(canTransitionOrder(order.status, 'cancelled')
      ? [{ id: 'sep', separator: true as const }, { id: 'cancel', label: t('detail.cancel'), icon: <Ban aria-hidden />, danger: true, onSelect: () => void actions.cancel() }]
      : []),
  ];

  const moreMenu = (
    <DropdownMenu
      label={t('detail.more')}
      items={menu}
      trigger={(p) => <IconButton {...p} icon={<MoreHorizontal aria-hidden />} label={t('detail.more')} variant="outline" />}
    />
  );

  const primary = next ? (
    <Button data-f="orders-next" size="lg" fullWidth loading={actions.moving} onClick={() => void actions.move(next)}>
      {t(NEXT_LABEL[next] ?? 'next.ready')}
    </Button>
  ) : null;
  const resend =
    order.status === 'ready' ? (
      <Button variant="outline" size="lg" fullWidth leftIcon={<Send aria-hidden />} loading={actions.notifying} onClick={() => void actions.notifyAgain()}>
        {t('detail.notifyAgain')}
      </Button>
    ) : null;

  return (
    <div data-f="orders-detail" className="flex flex-col gap-6">
      <PageHeader
        back={{ href: '/biz/orders', label: t('title') }}
        title={t('number', { number: order.number })}
        meta={
          <>
            <OrderStatusBadge status={order.status} size="md" />
            <span className="text-sm text-muted">{t('detail.receivedAt', { when: lowerFirst(short(order.createdAt) ?? '') })}</span>
            {/* Телефон: «⋯» в строке статуса, а не отдельной строкой под заголовком */}
            <span className="ml-auto sm:hidden">{moreMenu}</span>
          </>
        }
        actions={<span className="hidden sm:inline-flex">{moreMenu}</span>}
      />

      <section className="rounded-2xl border border-border bg-surface p-4 sm:p-6">
        <OrderProgress status={order.status} times={times} />
        {(primary || resend) && (
          <div className="mt-6 hidden gap-3 border-t border-border pt-5 md:flex md:items-center">
            {order.status === 'ready' && <p className="mr-auto text-sm text-muted">{t('detail.readyHint')}</p>}
            {order.status === 'in_progress' && <p className="mr-auto text-sm text-muted">{t('detail.readyWillNotify')}</p>}
            {order.status === 'received' && <p className="mr-auto text-sm text-muted">{t('detail.receivedHint')}</p>}
            {resend && <div className="w-auto">{resend}</div>}
            {primary && <div className="w-auto">{primary}</div>}
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <div className="flex min-w-0 flex-col gap-6">
          <ItemsCard order={order} />
          {order.status !== 'cancelled' && <PublicLinkCard order={order} url={`${origin}/o/${order.code}`} businessName={businessName} />}
          <HistoryCard order={order} staffName={staffName} />
        </div>
        <div className="order-first flex min-w-0 flex-col gap-6 lg:order-none">
          <ClientCard order={order} staffName={staffName(order.staffId)} />
          <MoneyCard order={order} />
        </div>
      </div>

      {(primary || resend) && (
        <StickyActionBar desktop="hidden">
          {resend && order.status === 'ready' ? (
            <>
              <Button variant="outline" size="lg" className="flex-none! whitespace-nowrap!" leftIcon={<Send aria-hidden />} loading={actions.notifying} onClick={() => void actions.notifyAgain()}>
                {t('detail.notifyAgainShort')}
              </Button>
              {primary}
            </>
          ) : (
            primary
          )}
        </StickyActionBar>
      )}

      <ExitHold value={editing ? order : null}>{(o: Order) => <OrderFormSheet order={o} onClose={() => setEditing(false)} />}</ExitHold>
    </div>
  );
}
