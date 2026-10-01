'use client';

import { useState } from 'react';
import { getClientProfile, requestCallback } from '@/api/client';
import { useApiMutation, useApiQuery } from '@/api/request';
import { clientKeys } from '@/areas/client/ui/clientKeys';
import { useCurrent } from '@/demo/hooks';
import type { Id } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { Modal } from '@/ui/Modal';
import { PhoneInput } from '@/ui/PhoneInput';
import { useToast } from '@/ui/Toast';

/**
 * «Попросить перезвонить», когда кнопка звонка закрыта (F-00-106). Вошедшему клиенту имя и номер подставлены —
 * не вводить то, что приложение уже знает (ux-r1 №24, e2e-q2 №15).
 */
export function CallbackModal({
  open,
  onOpenChange,
  staffId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staffId: Id;
}) {
  const t = useT('client');
  const tc = useT('common');
  const toast = useToast();
  const { ready, appUserId } = useCurrent();
  const profileQ = useApiQuery(clientKeys.profile(appUserId ?? ''), () => getClientProfile(appUserId ?? ''), {
    enabled: ready && Boolean(appUserId),
  });
  const [edited, setEdited] = useState<{ name?: string; phone?: string }>({});
  const name = edited.name ?? profileQ.data?.appUser.name ?? '';
  const phone = edited.phone ?? profileQ.data?.appUser.phone ?? '';
  const setName = (v: string) => setEdited((e) => ({ ...e, name: v }));
  const setPhone = (v: string) => setEdited((e) => ({ ...e, phone: v }));
  const submit = useApiMutation(requestCallback);

  const handleSubmit = async () => {
    try {
      await submit.mutate({ staffId, phone, name: name || undefined });
      toast.success(t('master.callbackSent'));
      onOpenChange(false);
      setEdited({});
    } catch {
      toast.error(t('master.callbackFailed'));
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t('master.callbackTitle')}
      description={t('master.callbackDescription')}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {tc('actions.cancel')}
          </Button>
          <Button onClick={handleSubmit} loading={submit.isPending} disabled={phone.replace(/\D/g, '').length < 8}>
            {t('master.callbackSubmit')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <FormField label={t('master.callbackName')} optional>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </FormField>
        <FormField label={t('master.callbackPhone')} required>
          <PhoneInput value={phone} onValueChange={setPhone} />
        </FormField>
      </div>
    </Modal>
  );
}
