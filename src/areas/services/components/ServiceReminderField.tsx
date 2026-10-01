'use client';

/**
 * Своё время напоминания о визите для этой услуги (Ув15 раздела notify): «за N часов до визита». Хранит notify
 * (условия типа 1, `setServiceReminderHours`), движок уведомлений берёт его вместо общего времени напоминания.
 * Сохраняется сразу при выборе (оптимистично), отдельно от кнопки «Сохранить» услуги — у новой услуги поле
 * появится после первого сохранения, когда у неё есть id.
 */
import { getServiceReminderHours, setServiceReminderHours } from '@/api/notify';
import { optimistic, useApiMutation, useApiQuery } from '@/api/request';
import { useT } from '@/i18n/useT';
import { FormField } from '@/ui/FormField';
import { Select } from '@/ui/Select';
import { Skeleton } from '@/ui/Skeleton';
import { useToast } from '@/ui/Toast';

const HOURS = [1, 2, 3, 6, 12, 24, 48] as const;

interface Args {
  businessId: string;
  serviceId: string;
  hours: number | null;
}

export function ServiceReminderField({ businessId, serviceId }: { businessId: string; serviceId: string }) {
  const t = useT('services');
  const toast = useToast();
  const q = useApiQuery(['notify', 'serviceReminder', businessId, serviceId], () => getServiceReminderHours({ businessId, serviceId }));
  const save = useApiMutation(setServiceReminderHours, {
    optimistic: optimistic<number | null, Args>((a) => ['notify', 'serviceReminder', a.businessId, a.serviceId], (_old, a) => a.hours),
  });
  return (
    <FormField label={t('form.reminderLabel')} hint={t('form.reminderHint')}>
      {q.isLoading ? (
        <Skeleton variant="rect" className="h-11 w-full" />
      ) : (
        <Select
          options={[
            { value: '', label: t('form.reminderDefault') },
            ...HOURS.map((h) => ({ value: String(h), label: t('form.reminderHours', { h }) })),
          ]}
          value={q.data == null ? '' : String(q.data)}
          onValueChange={async (v) => {
            try {
              await save.mutate({ businessId, serviceId, hours: v ? Number(v) : null });
            } catch {
              toast.error(t('form.reminderSaveFailed'));
            }
          }}
        />
      )}
    </FormField>
  );
}
