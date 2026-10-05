'use client';

import { useState } from 'react';
import { BellPlus, CircleCheck } from 'lucide-react';
import { submitDemandLead } from '@/api/client-public';
import { useApiMutation } from '@/api/request';
import type { DistrictId, Id, SphereId } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { PhoneInput } from '@/ui/PhoneInput';
import { useToast } from '@/ui/Toast';

/**
 * «Никого не нашли» (F-00-112): сброс фильтров и «Сообщить, когда появится». Вошедшего клиента номер не спрашиваем —
 * он известен (ux-r5 №12); заявка доходит до отчёта спроса нашей панели.
 */
export function SearchEmptyResult({
  query,
  sphereId,
  district,
  appUserId,
  onReset,
}: {
  query: string;
  sphereId?: SphereId;
  district?: DistrictId;
  appUserId?: Id;
  onReset?: () => void;
}) {
  const t = useT('client');
  const toast = useToast();
  const [leadQuery, setLeadQuery] = useState(query);
  const [phone, setPhone] = useState('');
  const [sent, setSent] = useState(false);
  const submit = useApiMutation(submitDemandLead);

  const handleSubmit = async () => {
    try {
      await submit.mutate({ query: leadQuery, sphereId, district, phone: phone || undefined, appUserId });
      setSent(true);
      toast.success(t('search.empty.submitted'));
    } catch {
      toast.error(t('search.empty.failed'));
    }
  };

  return (
    <div data-f="F-00-112" className="flex flex-col items-center gap-4">
      <EmptyState kind="search" title={t('search.empty.title')} description={t('search.empty.description')} onReset={onReset} />
      {sent ? (
        <p className="flex items-center gap-2 text-sm font-medium text-success">
          <CircleCheck aria-hidden className="size-4" />
          {t('search.empty.submitted')}
        </p>
      ) : (
        <form
          noValidate
          className="flex w-full max-w-sm flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (leadQuery.trim()) void handleSubmit();
          }}
        >
          <FormField label={t('search.empty.queryLabel')}>
            <Input value={leadQuery} onChange={(e) => setLeadQuery(e.target.value)} placeholder={t('search.empty.queryPlaceholder')} />
          </FormField>
          {!appUserId && (
            <FormField label={t('search.empty.phoneLabel')} optional>
              <PhoneInput value={phone} onValueChange={setPhone} />
            </FormField>
          )}
          <Button type="submit" leftIcon={<BellPlus aria-hidden />} loading={submit.isPending} disabled={!leadQuery.trim()}>
            {t('search.empty.submit')}
          </Button>
        </form>
      )}
    </div>
  );
}
