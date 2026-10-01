'use client';

import { useState } from 'react';
import { addToWaitlist } from '@/api/client';
import { useApiMutation } from '@/api/request';
import { clientKeys } from '@/areas/client/ui/clientKeys';
import { useCurrent } from '@/demo/hooks';
import type { Id, ISODate } from '@/domain/core';
import type { PublicService } from '@/api/client';
import { useT } from '@/i18n/useT';
import { useLocale } from 'next-intl';
import { pickText } from '@/lib/text';
import { Button } from '@/ui/Button';
import { DatePicker } from '@/ui/DatePicker';
import { FormField } from '@/ui/FormField';
import { Modal } from '@/ui/Modal';
import { RadioGroup } from '@/ui/Radio';
import { Select } from '@/ui/Select';
import { useToast } from '@/ui/Toast';

/** «Сообщить, если освободится» — встать в лист ожидания на день/услугу у мастера (F-00-102) */
export function WaitlistModal({
  open,
  onOpenChange,
  staffId,
  services,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staffId: Id;
  services: PublicService[];
}) {
  const t = useT('client');
  const tc = useT('common');
  const locale = useLocale();
  const toast = useToast();
  const { appUserId } = useCurrent();
  const [serviceId, setServiceId] = useState(services[0]?.id ?? '');
  const [mode, setMode] = useState<'any' | 'date'>('any');
  const [date, setDate] = useState<ISODate>('');
  const submit = useApiMutation(addToWaitlist, { invalidates: [clientKeys.waitlist(appUserId ?? '')] });

  const handleSubmit = async () => {
    if (!appUserId) {
      toast.info(t('master.waitlistNeedLogin'));
      return;
    }
    try {
      await submit.mutate({
        appUserId,
        staffId,
        serviceId,
        date: mode === 'any' ? 'any' : date || 'any',
      });
      toast.success(t('master.waitlistAdded'));
      onOpenChange(false);
    } catch {
      toast.error(t('master.waitlistFailed'));
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t('master.waitlistTitle')}
      description={t('master.waitlistDescription')}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {tc('actions.cancel')}
          </Button>
          <Button onClick={handleSubmit} loading={submit.isPending} disabled={!serviceId}>
            {t('master.waitlistSubmit')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <FormField label={t('master.waitlistService')}>
          <Select
            value={serviceId}
            onValueChange={setServiceId}
            options={services.map((s) => ({
              value: s.id,
              label: pickText(s.name, locale),
            }))}
          />
        </FormField>
        <FormField label={t('master.waitlistWhen')}>
          <RadioGroup
            value={mode}
            onValueChange={(v) => setMode(v as 'any' | 'date')}
            options={[
              { value: 'any', label: t('master.waitlistAnyDay') },
              { value: 'date', label: t('master.waitlistPickDay') },
            ]}
          />
        </FormField>
        {mode === 'date' && (
          <FormField label={t('master.waitlistDate')}>
            <DatePicker value={date || null} onValueChange={(d) => setDate(d ?? '')} />
          </FormField>
        )}
      </div>
    </Modal>
  );
}
