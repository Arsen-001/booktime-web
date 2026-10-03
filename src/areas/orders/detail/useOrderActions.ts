'use client';

/**
 * Действия над заказом: следующий шаг (одна главная кнопка), «Отправить ещё раз», «Вернуть в работу», «Отменить».
 * Статус — оптимистично (бейдж и шаги меняются сразу, ошибка откатит), тост — после ответа.
 */
import { notifyOrderReady, setOrderStatus } from '@/api/orders';
import { patchInList, useApiMutation } from '@/api/request';
import type { Id } from '@/domain/core';
import type { Order, OrderStatus } from '@/domain/orders';
import { useT } from '@/i18n/useT';
import { useConfirm, useToast } from '@/ui/Toast';

export function useOrderActions(businessId: Id, order: Order | undefined) {
  const t = useT('orders');
  const toast = useToast();
  const confirm = useConfirm();
  const statusM = useApiMutation(setOrderStatus, {
    optimistic: patchInList(['orders', 'order'], (a: { orderId: Id; status: OrderStatus }) => ({ id: a.orderId, patch: { status: a.status } })),
  });
  const notifyM = useApiMutation(notifyOrderReady);

  async function move(status: OrderStatus) {
    if (!order) return;
    try {
      await statusM.mutate({ businessId, orderId: order.id, status });
      toast.success(t(`toast.${status}`, { number: order.number }));
    } catch {
      toast.error(t('toast.failed'));
    }
  }

  async function cancel() {
    if (!order) return;
    const ok = await confirm({
      title: t('cancel.title', { number: order.number }),
      description: t('cancel.text'),
      confirmLabel: t('cancel.confirm'),
      cancelLabel: t('cancel.keep'),
      tone: 'danger',
    });
    if (ok) await move('cancelled');
  }

  async function notifyAgain() {
    if (!order) return;
    try {
      await notifyM.mutate({ businessId, orderId: order.id });
      toast.success(t('toast.notified'));
    } catch {
      toast.error(t('toast.failed'));
    }
  }

  return { move, cancel, notifyAgain, moving: statusM.isPending, notifying: notifyM.isPending };
}
