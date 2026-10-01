'use client';

/**
 * Личный кабинет → «Email» (F-15-150): подтверждение и смена почты. Новая почта работает только после
 * перехода по ссылке из письма — в демо ссылку заменяет кнопка «Я перешёл по ссылке».
 */
import { useState } from 'react';
import { coreGet } from '@/api/core';
import { useApiMutation, useApiQuery } from '@/api/request';
import { confirmEmailLinkDemo, getPersonalAccount, sendEmailConfirmation } from '@/api/settings';
import type { Id } from '@/domain/core';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { SectionCard } from '@/ui/SectionCard';
import { useToast } from '@/ui/Toast';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function EmailTab({ staffId }: { staffId: Id }) {
  const t = useT('settings');
  const format = useFormat();
  const toast = useToast();
  const staffQ = useApiQuery(['core', 'staff', staffId], () => coreGet('staff', staffId));
  const accQ = useApiQuery(['settings', 'personalAccount', staffId], () => getPersonalAccount(staffId));
  const resend = useApiMutation(() => sendEmailConfirmation(staffId), { invalidates: [['settings', 'personalAccount', staffId]] });
  const change = useApiMutation((email: string) => sendEmailConfirmation(staffId, email), {
    invalidates: [
      ['settings', 'personalAccount', staffId],
      ['core', 'staff', staffId],
    ],
  });
  const confirmLink = useApiMutation(() => confirmEmailLinkDemo(staffId), { invalidates: [['settings', 'personalAccount', staffId]] });

  const [newEmail, setNewEmail] = useState('');
  const [touched, setTouched] = useState(false);

  // До данных — та же карточка: текущая почта пустым выключенным полем, поле новой почты с кнопкой
  const loading = staffQ.isLoading || accQ.isLoading || !staffQ.data || !accQ.data;
  const currentEmail = staffQ.data?.email;
  const verified = accQ.data?.emailVerified;
  const sentAt = accQ.data?.emailConfirmSentAt;
  const invalid = touched && newEmail.trim().length > 0 && !EMAIL_RE.test(newEmail.trim());

  const changeEmail = async () => {
    setTouched(true);
    const trimmed = newEmail.trim();
    if (!EMAIL_RE.test(trimmed)) return;
    try {
      await change.mutate(trimmed);
      toast.success(t('account.email.sent'));
      setNewEmail('');
      setTouched(false);
    } catch {
      toast.error(t('account.email.changeFailed'));
    }
  };

  return (
    <SectionCard title={t('account.email.title')} description={t('account.email.description')}>
      <div data-f="F-15-150 F-10-124 F-05-064" className="flex flex-col gap-5">
        <FormField label={t('account.email.currentLabel')}>
          <div className="flex flex-wrap items-center gap-2">
            <Input value={currentEmail ?? ''} disabled readOnly placeholder={loading ? undefined : t('account.email.notSet')} className="max-w-xs" />
            {currentEmail && (
              <Badge tone={verified ? 'success' : 'warning'}>{verified ? t('account.email.verified') : t('account.email.notVerified')}</Badge>
            )}
          </div>
        </FormField>

        {currentEmail && !verified && (
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="secondary"
              loading={resend.isPending}
              onClick={() => void resend.mutate(undefined).then(() => toast.success(t('account.email.sent')))}
            >
              {t('account.email.resend')}
            </Button>
            {sentAt && (
              <Button
                variant="ghost"
                loading={confirmLink.isPending}
                onClick={() => void confirmLink.mutate(undefined).then(() => toast.success(t('account.email.confirmed')))}
              >
                {t('account.email.confirmDemo')}
              </Button>
            )}
          </div>
        )}

        <FormField label={t('account.email.newLabel')} error={invalid ? t('account.email.invalidEmail') : undefined}>
          <div className="flex flex-wrap items-center gap-3">
            <Input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              onBlur={() => setTouched(true)}
              invalid={invalid}
              className="max-w-xs"
            />
            <Button loading={change.isPending} disabled={loading} onClick={() => void changeEmail()}>
              {t('account.email.changeButton')}
            </Button>
          </div>
        </FormField>
        {sentAt && <p className="text-xs text-muted">{format.dateTime(sentAt)}</p>}
      </div>
    </SectionCard>
  );
}
