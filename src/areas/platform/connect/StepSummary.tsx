'use client';

/** Шаг «Итог»: промокод, ответственный и что именно создастся — до нажатия «Подключить» (Р6); чего не хватает — с «Исправить». */
import { useState } from 'react';
import { AlertCircle, BadgePercent, X } from 'lucide-react';
import { validatePromo } from '@/api/platform';
import { useApiMutation } from '@/api/request';
import { useTeam } from '@/areas/platform/hooks/usePlatformData';
import type { ConnectForm } from '@/areas/platform/connect/connectForm';
import { connectIssues, type ConnectIssue } from '@/domain/platform';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { addDays, today } from '@/lib/date';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { FormField } from '@/ui/FormField';
import { IconButton } from '@/ui/IconButton';
import { Input } from '@/ui/Input';
import { KeyValueList } from '@/ui/KeyValueList';
import { Select } from '@/ui/Select';

interface StepSummaryProps {
  form: ConnectForm;
  onChange: (patch: Partial<ConnectForm>) => void;
  onFix: (issue: ConnectIssue) => void;
}

export function StepSummary({ form, onChange, onFix }: StepSummaryProps) {
  const t = useT('platform');
  const tc = useT('common');
  const fmt = useFormat();
  const teamQ = useTeam();
  const check = useApiMutation(validatePromo);
  const [code, setCode] = useState('');
  const [appliedCode, setAppliedCode] = useState('');
  const [promoError, setPromoError] = useState('');
  const issues = connectIssues(form);

  const apply = async () => {
    setPromoError('');
    try {
      const result = await check.mutate(code);
      if (result.ok) {
        onChange({ promoCodeId: result.promo.id });
        setAppliedCode(result.promo.code);
        setCode('');
      } else {
        setPromoError(t(`connect.promoError.${result.reason}`));
      }
    } catch {
      setPromoError(t('connect.saveFailed'));
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {issues.length > 0 && (
        <ul className="flex flex-col gap-2 rounded-xl border border-warning bg-warning-soft p-3">
          {issues.map((i) => (
            <li key={i} className="flex items-center gap-3 text-sm text-fg">
              <AlertCircle aria-hidden className="size-4 shrink-0 text-warning" />
              <span className="flex-1">{t(`connect.issue.${i}`)}</span>
              <Button size="sm" variant="ghost" onClick={() => onFix(i)}>
                {t('connect.fix')}
              </Button>
            </li>
          ))}
        </ul>
      )}

      <KeyValueList
        items={[
          { label: t('connect.summary.business'), value: `${form.name.trim() || t('connect.untitled')} · ${form.sphereId ? tc(`spheres.${form.sphereId}`) : '—'}` },
          { label: t('connect.summary.owner'), value: form.ownerPhone ? fmt.phone(form.ownerPhone) : '—' },
          { label: t('connect.summary.services'), value: t('connect.servicesSelected', { n: form.services.filter((s) => s.selected).length }) },
          { label: t('connect.summary.staff'), value: t('connect.staffCount', { n: 1 + form.invites.length }) },
          { label: t('connect.summary.photos'), value: t('connect.photosCount', { n: form.photos.length }) },
          { label: t('connect.summary.free'), value: t('connect.freeUntil', { date: fmt.date(addDays(today(), 30), 'dayMonth') }) },
        ]}
      />

      <FormField label={t('connect.promoLabel')} optional hint={form.promoCodeId ? undefined : t('connect.promoHint')} error={promoError || undefined}>
        {form.promoCodeId ? (
          <div className="flex items-center gap-2">
            <Badge tone="success" icon={<BadgePercent aria-hidden />}>
              {t('connect.promoApplied', { code: appliedCode || t('connect.promoAppliedFallback') })}
            </Badge>
            <IconButton icon={<X />} label={t('connect.promoRemove')} size="sm" onClick={() => onChange({ promoCodeId: undefined })} />
          </div>
        ) : (
          <div className="flex gap-2">
            <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="VISIT30" className="flex-1" autoCapitalize="characters" />
            <Button variant="outline" onClick={apply} loading={check.isPending} disabled={!code.trim()}>
              {t('connect.promoApply')}
            </Button>
          </div>
        )}
      </FormField>

      <FormField label={t('connect.responsible')}>
        <Select value={form.responsibleId} onValueChange={(v) => onChange({ responsibleId: v })} options={(teamQ.data ?? []).map((m) => ({ value: m.id, label: m.name }))} placeholder={t('connect.responsiblePlaceholder')} />
      </FormField>
    </div>
  );
}
