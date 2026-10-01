'use client';

/** Личный кабинет → «Телефон» (F-15-149): смена номера входа по коду. Занятый другим аккаунтом номер — отказ. */
import { useState } from 'react';
import { coreGet } from '@/api/core';
import { useApiMutation, useApiQuery } from '@/api/request';
import { confirmPhoneChange, sendPhoneChangeCode } from '@/api/settings';
import type { Id } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { PhoneVerify } from '@/ui/PhoneVerify';
import { SectionCard } from '@/ui/SectionCard';
import { useToast } from '@/ui/Toast';

export function PhoneTab({ staffId }: { staffId: Id }) {
  const t = useT('settings');
  const toast = useToast();
  const staffQ = useApiQuery(['core', 'staff', staffId], () => coreGet('staff', staffId));
  const send = useApiMutation((phone: string) => sendPhoneChangeCode(phone));
  const confirmChange = useApiMutation(confirmPhoneChange, { invalidates: [['core', 'staff', staffId]] });
  const [phone, setPhone] = useState('');

  // До данных — та же карточка: текущий номер пустым выключенным полем того же размера (DESIGN.md «The skeleton IS the page»)
  const currentPhone = staffQ.data?.phone ?? '';
  const sameAsCurrent = phone && phone === currentPhone;

  return (
    <SectionCard title={t('account.phone.title')} description={t('account.phone.description')}>
      <div data-f="F-15-149 F-10-123 F-05-064" className="flex flex-col gap-5">
        <FormField label={t('account.phone.currentLabel')}>
          <Input value={currentPhone} disabled readOnly aria-busy={staffQ.isLoading || undefined} />
        </FormField>

        <FormField label={t('account.phone.newLabel')} error={sameAsCurrent ? t('account.phone.sameAsCurrent') : undefined}>
          <PhoneVerify
            phone={phone}
            onPhoneChange={setPhone}
            canSend={!sameAsCurrent}
            sendLabel={t('account.phone.changeButton')}
            codeHint={t('account.phone.codeHint')}
            onSendCode={async ({ phone: p }) => {
              await send.mutate(p);
            }}
            onVerify={async ({ phone: p, code }) => {
              try {
                await confirmChange.mutate({ staffId, phone: p, code });
                toast.success(t('account.phone.changed'));
              } catch (e: unknown) {
                const message =
                  e instanceof Error && e.name === 'ApiError' && (e as { code?: string }).code === 'phone_taken'
                    ? t('account.phone.phoneTaken')
                    : t('account.phone.wrongCode');
                toast.error(message);
                throw e;
              }
            }}
          />
        </FormField>
      </div>
    </SectionCard>
  );
}
