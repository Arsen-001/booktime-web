'use client';

/**
 * Личный кабинет → «Пароль» (F-15-151). «Завершить все сеансы» (F-15-152) — во «Входе и безопасности» (Н9).
 * ⭐ Наше решение (F-00-033/034): пароль есть только у администратора — мастер и владелец входят по коду.
 */
import { useState } from 'react';
import { useApiMutation } from '@/api/request';
import { changePassword } from '@/api/settings';
import { useDemo } from '@/demo/hooks';
import type { Id } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { EmptyState } from '@/ui/EmptyState';
import { Button } from '@/ui/Button';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { SectionCard } from '@/ui/SectionCard';
import { useToast } from '@/ui/Toast';
import { useUnsavedGuard } from '@/ui/hooks/useUnsavedGuard';

export function PasswordTab({ staffId }: { staffId: Id }) {
  const t = useT('settings');
  const toast = useToast();
  const { persona } = useDemo();
  const save = useApiMutation(changePassword);

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [touched, setTouched] = useState(false);
  useUnsavedGuard(Boolean(current || next || repeat));

  const isAdmin = persona === 'admin';

  if (!isAdmin) {
    return (
      <SectionCard title={t('account.password.title')}>
        <EmptyState variant="section" title={t('account.password.adminOnlyTitle')} description={t('account.password.adminOnlyHint')} />
      </SectionCard>
    );
  }

  const currentError = touched && !current ? t('account.password.currentRequired') : undefined;
  const shortError = touched && next.length > 0 && next.length < 6 ? t('account.password.tooShort') : undefined;
  const mismatchError = touched && repeat.length > 0 && repeat !== next ? t('account.password.mismatch') : undefined;

  const submit = async () => {
    setTouched(true);
    if (!current || next.length < 6 || repeat !== next) return;
    try {
      await save.mutate({ staffId, currentPassword: current, newPassword: next });
      toast.success(t('account.password.saved'));
      setCurrent('');
      setNext('');
      setRepeat('');
      setTouched(false);
    } catch {
      toast.error(t('account.password.saveFailed'));
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <SectionCard title={t('account.password.title')} description={t('account.password.description')}>
        <form
          data-f="F-15-151 F-10-125"
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <FormField label={t('account.password.currentLabel')} error={currentError}>
            <Input
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              onBlur={() => setTouched(true)}
              invalid={Boolean(currentError)}
            />
          </FormField>
          <FormField label={t('account.password.newLabel')} error={shortError}>
            <Input
              type="password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              onBlur={() => setTouched(true)}
              invalid={Boolean(shortError)}
            />
          </FormField>
          <FormField label={t('account.password.repeatLabel')} error={mismatchError}>
            <Input
              type="password"
              value={repeat}
              onChange={(e) => setRepeat(e.target.value)}
              onBlur={() => setTouched(true)}
              invalid={Boolean(mismatchError)}
            />
          </FormField>
          <Button type="submit" loading={save.isPending} className="self-start">
            {t('account.password.save')}
          </Button>
        </form>
      </SectionCard>
    </div>
  );
}
