'use client';

import { useState } from 'react';
import { addDiaryEntry } from '@/api/client';
import { useApiMutation } from '@/api/request';
import type { Id, ISODate } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { today } from '@/lib/date';
import { Button } from '@/ui/Button';
import { DatePicker } from '@/ui/DatePicker';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { Modal } from '@/ui/Modal';
import { MoneyInput } from '@/ui/MoneyInput';
import { useToast } from '@/ui/Toast';

/** Добавить расход вручную в дневник (F-00-122) */
export function AddDiaryEntryModal({
  open,
  onOpenChange,
  appUserId,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appUserId: Id;
  onAdded: () => void;
}) {
  const t = useT('client');
  const tc = useT('common');
  const toast = useToast();
  const [serviceName, setServiceName] = useState('');
  const [masterName, setMasterName] = useState('');
  const [date, setDate] = useState<ISODate>(today());
  const [amount, setAmount] = useState<number>();
  const submit = useApiMutation(addDiaryEntry);

  const reset = () => {
    setServiceName('');
    setMasterName('');
    setDate(today());
    setAmount(undefined);
  };

  const handleSubmit = async () => {
    if (!serviceName.trim() || !amount) return;
    try {
      await submit.mutate({ appUserId, serviceName: serviceName.trim(), masterName: masterName.trim(), date, amount });
      toast.success(t('diary.added'));
      reset();
      onOpenChange(false);
      onAdded();
    } catch {
      toast.error(t('diary.addFailed'));
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
      title={t('diary.addTitle')}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tc('actions.cancel')}
          </Button>
          <Button onClick={() => void handleSubmit()} loading={submit.isPending} disabled={!serviceName.trim() || !amount}>
            {t('diary.addSubmit')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <FormField label={t('diary.serviceLabel')} required>
          <Input value={serviceName} onChange={(e) => setServiceName(e.target.value)} placeholder={t('diary.servicePlaceholder')} />
        </FormField>
        <FormField label={t('diary.masterLabel')} optional>
          <Input value={masterName} onChange={(e) => setMasterName(e.target.value)} placeholder={t('diary.masterPlaceholder')} />
        </FormField>
        <FormField label={t('diary.dateLabel')} required>
          <DatePicker value={date} onValueChange={(d) => d && setDate(d)} max={today()} />
        </FormField>
        <FormField label={t('diary.amountLabel')} required>
          <MoneyInput value={amount} onValueChange={setAmount} />
        </FormField>
      </div>
    </Modal>
  );
}
