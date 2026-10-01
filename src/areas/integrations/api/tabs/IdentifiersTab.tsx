'use client';

/** F-13-056: идентификаторы для внешних систем — ID бизнеса/филиалов/сотрудников/услуг с «Копировать»;
 *  правило ключа доп. поля (латиница, цифры, «.», «-», «_»). */
import { getIdentifiers, isValidApiFieldKey } from '@/api/integrations';
import { useApiQuery } from '@/api/request';
import { CopyRow } from '@/areas/integrations/components/CopyRow';
import { useCurrent, useDemo } from '@/demo/hooks';
import { useState } from 'react';
import { useT } from '@/i18n/useT';
import { ErrorState } from '@/ui/ErrorState';
import { EmptyState } from '@/ui/EmptyState';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { SectionCard } from '@/ui/SectionCard';
import { Skeleton } from '@/ui/Skeleton';

export function IdentifiersTab() {
  const t = useT('integrations');
  const { businessId, ready } = useCurrent();
  const { lang } = useDemo();
  const [fieldKey, setFieldKey] = useState('');
  const q = useApiQuery(['integrations', 'identifiers', businessId, lang], () => getIdentifiers(businessId!, lang), { enabled: ready && Boolean(businessId) });

  const fieldKeyError = fieldKey.length > 0 && !isValidApiFieldKey(fieldKey) ? t('api.identifiers.fieldKeyInvalid') : undefined;

  // QA 30.09: ошибка загрузки — ErrorState, а не «пусто» во всех разделах
  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;

  return (
    <div data-f="F-13-056" className="flex flex-col gap-4">
      <SectionCard title={t('api.identifiers.businessTitle')}>
        <CopyRow label={t('api.identifiers.businessId')} value={businessId ?? '—'} />
      </SectionCard>

      {!ready || q.isLoading ? (
        <Skeleton lines={6} />
      ) : (
        <>
          <SectionCard title={t('api.identifiers.locationsTitle')}>
            {q.data?.locations.length ? (
              <div className="flex flex-col gap-2">
                {q.data.locations.map((l) => (
                  <CopyRow key={l.id} label={l.name} value={l.id} />
                ))}
              </div>
            ) : (
              <EmptyState compact title={t('api.identifiers.empty')} />
            )}
          </SectionCard>

          <SectionCard title={t('api.identifiers.staffTitle')}>
            {q.data?.staff.length ? (
              <div className="flex flex-col gap-2">
                {q.data.staff.map((s) => (
                  <CopyRow key={s.id} label={s.name} value={s.id} />
                ))}
              </div>
            ) : (
              <EmptyState compact title={t('api.identifiers.empty')} />
            )}
          </SectionCard>

          <SectionCard title={t('api.identifiers.servicesTitle')}>
            {q.data?.services.length ? (
              <div className="flex flex-col gap-2">
                {q.data.services.map((s) => (
                  <CopyRow key={s.id} label={s.name} value={s.id} />
                ))}
              </div>
            ) : (
              <EmptyState compact title={t('api.identifiers.empty')} />
            )}
          </SectionCard>
        </>
      )}

      <SectionCard title={t('api.identifiers.fieldKeyTitle')} description={t('api.identifiers.fieldKeyHint')}>
        <FormField label={t('api.identifiers.fieldKeyLabel')} error={fieldKeyError}>
          <Input value={fieldKey} onChange={(e) => setFieldKey(e.target.value)} placeholder="crm.client_id" />
        </FormField>
      </SectionCard>
    </div>
  );
}
