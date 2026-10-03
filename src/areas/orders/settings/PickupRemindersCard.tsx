'use client';

/**
 * «Если клиент не забирает заказ» (04.10.2026): напоминать через 3 дня / через 3 и 7 дней после «Готово» или не
 * напоминать. Выбор сохраняется сразу. Тем же путём, что «Готово» (пуш → Telegram → SMS/WhatsApp бизнеса), ночью — нет.
 */
import { ordersKeys, setPickupReminders } from '@/api/orders';
import { optimistic, useApiMutation } from '@/api/request';
import { useCan, useCurrent } from '@/demo/hooks';
import type { Id } from '@/domain/core';
import { DEFAULT_PICKUP_REMINDER_MODE, pickupReminderModeOf, type PickupReminderMode } from '@/domain/orders';
import { useT } from '@/i18n/useT';
import { usePickupReminders } from '@/areas/orders/lib/useOrdersData';
import { RadioGroup } from '@/ui/Radio';
import { SectionCard } from '@/ui/SectionCard';
import { useToast } from '@/ui/Toast';

const MODES = ['3_7', '3', 'off'] as const satisfies readonly PickupReminderMode[];
const LABEL = { off: 'off', '3': 'd3', '3_7': 'd3_7' } as const;

export function PickupRemindersCard() {
  const t = useT('orders');
  const toast = useToast();
  const { businessId } = useCurrent();
  const canManage = useCan('settings.manage');
  const q = usePickupReminders();
  const save = useApiMutation(setPickupReminders, {
    optimistic: optimistic<PickupReminderMode, { businessId: Id; mode: PickupReminderMode }>((a) => ordersKeys.pickupReminders(a.businessId), (_old, a) => a.mode),
  });

  async function change(value: string) {
    if (!businessId) return;
    try {
      await save.mutate({ businessId, mode: pickupReminderModeOf(value) });
      toast.success(t('settings.reminders.saved'));
    } catch {
      toast.error(t('toast.failed'));
    }
  }

  return (
    <div data-f="orders-pickup-reminders">
      <SectionCard title={t('settings.reminders.title')} description={t('settings.reminders.description')}>
        <RadioGroup
          aria-label={t('settings.reminders.label')}
          value={q.data ?? DEFAULT_PICKUP_REMINDER_MODE}
          onValueChange={(v) => void change(v)}
          disabled={q.isLoading || !canManage}
          options={MODES.map((m) => ({
            value: m,
            label: t(`settings.reminders.${LABEL[m]}`),
            description: t(`settings.reminders.${LABEL[m]}Hint`),
          }))}
        />
        {!canManage && <p className="mt-2 text-sm text-muted">{t('settings.noRights')}</p>}
      </SectionCard>
    </div>
  );
}
