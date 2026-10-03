'use client';

/**
 * «Заказы» вкл/выкл у бизнеса (03.10.2026): включены — пункт «Заказы» в меню кабинета. По умолчанию включены у
 * ателье, ремонта техники, химчистки и детейлинга; любой бизнес может включить сам. Переключатель сохраняется сразу.
 */
import { setOrdersEnabled, ordersKeys } from '@/api/orders';
import { optimistic, useApiMutation } from '@/api/request';
import { useCan, useCurrent } from '@/demo/hooks';
import type { Id } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { useOrdersEnabled } from '@/areas/orders/lib/useOrdersData';
import { SectionCard } from '@/ui/SectionCard';
import { Switch } from '@/ui/Switch';
import { useToast } from '@/ui/Toast';

export function OrdersToggleCard() {
  const t = useT('orders');
  const toast = useToast();
  const { businessId } = useCurrent();
  const canManage = useCan('settings.manage');
  const { enabled, loading } = useOrdersEnabled();
  const save = useApiMutation(setOrdersEnabled, {
    optimistic: optimistic<boolean, { businessId: Id; enabled: boolean }>((a) => ordersKeys.enabled(a.businessId), (_old, a) => a.enabled),
  });

  async function toggle(next: boolean) {
    if (!businessId) return;
    try {
      await save.mutate({ businessId, enabled: next });
      toast.success(next ? t('settings.enabledToast') : t('settings.disabledToast'));
    } catch {
      toast.error(t('toast.failed'));
    }
  }

  return (
    <SectionCard title={t('settings.toggleTitle')} description={canManage ? undefined : t('settings.noRights')}>
      <Switch
        data-f="orders-enabled"
        checked={enabled}
        disabled={loading || !canManage || save.isPending}
        onCheckedChange={(v) => void toggle(v)}
        label={t('settings.toggleLabel')}
        description={t('settings.toggleHint')}
        labelPosition="start"
      />
    </SectionCard>
  );
}
