'use client';

/**
 * Автопродление (F-15-070/179) — один сценарий на «Подписке» и на «Правилах подписки» (Н3, 27.09.2026):
 * выключение всегда спрашивает с последствиями («срок не продлится сам, после {date} кабинет заморозится»),
 * включение — без вопроса. Переключается оптимистично — без перечитывания страницы.
 */
import { toggleAutoRenew, type SubscriptionView } from '@/api/settings';
import { optimistic, useApiMutation } from '@/api/request';
import type { Id } from '@/domain/core';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { useConfirm, useToast } from '@/ui/Toast';

export function useAutoRenewToggle(businessId: Id | undefined, paidUntil: string | undefined) {
  const t = useT('settings');
  const format = useFormat();
  const toast = useToast();
  const confirm = useConfirm();
  const mutation = useApiMutation(toggleAutoRenew, {
    optimistic: optimistic<SubscriptionView, { businessId: Id; autoRenew: boolean }>(
      (args) => ['settings', 'subscription', args.businessId],
      (old, args) => ({ ...old, autoRenew: args.autoRenew }),
    ),
  });

  const setAutoRenew = async (value: boolean): Promise<boolean> => {
    if (!businessId) return false;
    if (!value) {
      const ok = await confirm({
        title: t('terms.cancelConfirmTitle'),
        description: t('terms.cancelConfirmTextDated', { date: paidUntil ? format.date(paidUntil, 'long') : '—' }),
        confirmLabel: t('terms.cancelConfirmAction'),
        tone: 'danger',
      });
      if (!ok) return false;
    }
    try {
      await mutation.mutate({ businessId, autoRenew: value });
      toast.success(value ? t('billing.autoRenewSaved') : t('terms.cancelled'));
      return true;
    } catch {
      toast.error(value ? t('billing.autoRenewFailed') : t('terms.cancelFailed'));
      return false;
    }
  };

  return { setAutoRenew, isPending: mutation.isPending };
}
