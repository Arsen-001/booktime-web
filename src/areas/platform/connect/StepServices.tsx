'use client';

/** Шаг «Услуги»: готовые услуги сферы уже отмечены — снять лишнее быстрее, чем набирать (F-00-083). */
import { Shapes } from 'lucide-react';
import { useLocale } from 'next-intl';
import type { ConnectForm, StepErrors } from '@/areas/platform/connect/connectForm';
import type { LocaleCode } from '@/domain/core';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { pickText } from '@/lib/text';
import { Button } from '@/ui/Button';
import { Checkbox } from '@/ui/Checkbox';
import { EmptyState } from '@/ui/EmptyState';

interface StepServicesProps {
  form: ConnectForm;
  errors: StepErrors;
  onChange: (patch: Partial<ConnectForm>) => void;
  onPickSphere: () => void;
}

export function StepServices({ form, errors, onChange, onPickSphere }: StepServicesProps) {
  const t = useT('platform');
  const fmt = useFormat();
  const locale = useLocale() as LocaleCode;

  if (!form.sphereId || form.services.length === 0) {
    return (
      <EmptyState
        variant="section"
        icon={<Shapes aria-hidden />}
        title={t('connect.noSphereTitle')}
        description={t('connect.noSphereText')}
        action={<Button variant="outline" onClick={onPickSphere}>{t('connect.pickSphere')}</Button>}
      />
    );
  }

  const selected = form.services.filter((s) => s.selected).length;
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
        {form.services.map((line) => (
          <li key={line.templateId} className="px-3 py-3">
            <Checkbox
              checked={line.selected}
              onCheckedChange={(c) => onChange({ services: form.services.map((s) => (s.templateId === line.templateId ? { ...s, selected: c } : s)) })}
              label={pickText(line.name, locale)}
              description={`${fmt.duration(line.durationMin)} · ${fmt.money(line.price)}`}
            />
          </li>
        ))}
      </ul>
      <p className={errors.services ? 'text-sm text-danger' : 'text-sm text-muted'}>
        {errors.services ? t('connect.issue.services') : t('connect.servicesSelected', { n: selected })}
      </p>
    </div>
  );
}
