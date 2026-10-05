'use client';

/**
 * ⭐ Действия со сметой в кабинете: «Отправить ещё раз» и ответ клиента, полученный по телефону (отказ — с
 * подтверждением: заказ не пойдёт в работу). Сама отправка сметы — в EstimateSheet.
 */
import { decideOrderEstimate, resendOrderEstimate } from '@/api/orders';
import { useApiMutation } from '@/api/request';
import type { EstimateDecision, Order } from '@/domain/orders';
import { useT } from '@/i18n/useT';
import { useConfirm, useToast } from '@/ui/Toast';

export function useEstimateActions(order: Order) {
  const t = useT('orders');
  const toast = useToast();
  const confirm = useConfirm();
  const resendM = useApiMutation(resendOrderEstimate);
  const decideM = useApiMutation(decideOrderEstimate);

  async function resend() {
    try {
      await resendM.mutate({ businessId: order.businessId, orderId: order.id });
      toast.success(t('estimate.toast.resent'));
    } catch {
      toast.error(t('toast.failed'));
    }
  }

  async function decide(decision: EstimateDecision) {
    if (decision === 'decline') {
      const ok = await confirm({
        title: t('estimate.declineConfirm.title'),
        description: t('estimate.declineConfirm.text'),
        confirmLabel: t('estimate.declineConfirm.confirm'),
        cancelLabel: t('estimate.declineConfirm.keep'),
        tone: 'danger',
      });
      if (!ok) return;
    }
    try {
      await decideM.mutate({ businessId: order.businessId, orderId: order.id, decision });
      toast.success(t(decision === 'approve' ? 'estimate.toast.approved' : 'estimate.toast.declined'));
    } catch {
      toast.error(t('toast.failed'));
    }
  }

  return { resend, decide, resending: resendM.isPending, deciding: decideM.isPending };
}
