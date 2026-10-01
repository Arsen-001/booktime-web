'use client';

/**
 * Сегменты рассылки (Ув13): «давно не был» (последний визит раньше N дней), «был на услуге», «был у мастера»,
 * «новые / повторные». Отбор считает api (audienceClients в @/api/notify) по визитам «пришёл».
 */
import { useLocale } from 'next-intl';
import { useCoreList } from '@/api/core';
import { useCurrent } from '@/demo/hooks';
import type { Id } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { FormField } from '@/ui/FormField';
import { Select } from '@/ui/Select';

export interface MailingSegment {
  lastVisitOlderThanDays?: number;
  serviceId?: Id;
  staffId?: Id;
  visitKind?: 'new' | 'returning';
}

const STALE_DAYS = [30, 60, 90, 180] as const;

export interface MailingSegmentFieldsProps {
  value: MailingSegment;
  onChange: (next: MailingSegment) => void;
}

export function MailingSegmentFields({ value, onChange }: MailingSegmentFieldsProps) {
  const t = useT('notify');
  const locale = useLocale() as 'ru' | 'en' | 'hy';
  const { ready, businessId } = useCurrent();
  const servicesQ = useCoreList('services', { businessId }, { enabled: ready && !!businessId });
  const staffQ = useCoreList('staff', { businessId }, { enabled: ready && !!businessId });
  const anyLabel = t('newMailing.segment.any');

  return (
    <div data-f="F-05-096" className="grid gap-3 border-t border-border pt-3 sm:grid-cols-2">
      <FormField label={t('newMailing.segment.lastVisit')}>
        <Select
          options={[
            { value: '', label: anyLabel },
            ...STALE_DAYS.map((d) => ({ value: String(d), label: t('newMailing.segment.lastVisitDays', { days: d }) })),
          ]}
          value={value.lastVisitOlderThanDays ? String(value.lastVisitOlderThanDays) : ''}
          onValueChange={(v) => onChange({ ...value, lastVisitOlderThanDays: v ? Number(v) : undefined })}
        />
      </FormField>
      <FormField label={t('newMailing.segment.visitKind')}>
        <Select
          options={[
            { value: '', label: anyLabel },
            { value: 'new', label: t('newMailing.segment.new') },
            { value: 'returning', label: t('newMailing.segment.returning') },
          ]}
          value={value.visitKind ?? ''}
          onValueChange={(v) => onChange({ ...value, visitKind: (v || undefined) as MailingSegment['visitKind'] })}
        />
      </FormField>
      <FormField label={t('newMailing.segment.service')}>
        <Select
          searchable
          options={[
            { value: '', label: anyLabel },
            ...(servicesQ.data ?? []).map((sv) => ({ value: sv.id, label: sv.name[locale] || sv.name.ru })),
          ]}
          value={value.serviceId ?? ''}
          onValueChange={(v) => onChange({ ...value, serviceId: v || undefined })}
        />
      </FormField>
      <FormField label={t('newMailing.segment.staff')}>
        <Select
          searchable
          options={[{ value: '', label: anyLabel }, ...(staffQ.data ?? []).map((st) => ({ value: st.id, label: st.name }))]}
          value={value.staffId ?? ''}
          onValueChange={(v) => onChange({ ...value, staffId: v || undefined })}
        />
      </FormField>
    </div>
  );
}
