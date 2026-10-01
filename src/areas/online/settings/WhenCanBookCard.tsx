'use client';

import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { updateBusinessRules, type getBusinessRules } from '@/api/online';
import { useApiMutation, useApiQuery } from '@/api/request';
import { getSlotRules, saveSlotRule } from '@/api/schedule';
import type { Id } from '@/domain/core';
import { DEFAULT_MAX_DAYS_AHEAD } from '@/domain/online';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { FormField } from '@/ui/FormField';
import { SectionCard } from '@/ui/SectionCard';
import { Select } from '@/ui/Select';
import { useToast } from '@/ui/Toast';
import { useUnsavedGuard } from '@/ui/hooks/useUnsavedGuard';

const STEP_OPTIONS = [15, 30, 60];
const LEAD_HOURS = [0, 1, 2, 3, 6, 12, 24];
const HORIZON_DAYS = [7, 14, 30, 60, 90];

type Rules = Awaited<ReturnType<typeof getBusinessRules>>;

/**
 * О1 «Когда можно записаться» — первым блоком «Правил записи»: шаг, «не раньше чем за», «не дальше чем на» и
 * недоступные дни. Шаг и «не раньше» — это основное правило слотов локации (хозяин — раздел schedule, пишем
 * через его api, те же значения видно в «График работы → Слоты»); горизонт — наше поле BusinessOnlineRules.maxDaysAhead.
 * Недоступные дни и тип слотов настраиваются там же, в «Слотах» — ссылка «подробнее».
 */
export function WhenCanBookCard({
  businessId,
  locationId,
  rules,
  loading = false,
}: {
  businessId: Id;
  locationId: Id | undefined;
  rules: Rules;
  /** Правила бизнеса ещё грузятся — та же форма, без ввода */
  loading?: boolean;
}) {
  const t = useT('online');
  const slotRulesQ = useApiQuery(['schedule', 'slot-rules', 'location', locationId], () => getSlotRules('location', locationId ?? ''), {
    enabled: Boolean(locationId),
  });
  const base = slotRulesQ.data?.find((r) => r.isBase);

  return (
    <section id="when" className="scroll-mt-24" data-f="F-03-065">
      <SectionCard title={t('settings.when.title')} description={t('settings.when.hint')}>
        {slotRulesQ.isLoading || loading ? (
          // До данных — та же форма (поля выключены, значения по умолчанию); с данными форма заводится заново
          <div inert aria-busy="true">
            <WhenForm key="loading" businessId={businessId} locationId={locationId} base={undefined} rules={rules} />
          </div>
        ) : (
          <WhenForm businessId={businessId} locationId={locationId} base={base} rules={rules} />
        )}
      </SectionCard>
    </section>
  );
}

function WhenForm({
  businessId,
  locationId,
  base,
  rules,
}: {
  businessId: Id;
  locationId: Id | undefined;
  base: Awaited<ReturnType<typeof getSlotRules>>[number] | undefined;
  rules: Rules;
}) {
  const t = useT('online');
  const toast = useToast();
  const [step, setStep] = useState(base?.stepMin ?? 30);
  const [leadH, setLeadH] = useState(Math.round((base?.leadTimeMin ?? 0) / 60));
  const [horizon, setHorizon] = useState(rules.maxDaysAhead ?? DEFAULT_MAX_DAYS_AHEAD);
  const slotMutation = useApiMutation((next: { stepMin: number; leadTimeMin: number | undefined }) =>
    saveSlotRule('location', locationId ?? '', { ...base!, stepMin: next.stepMin, leadTimeMin: next.leadTimeMin }),
  );
  const horizonMutation = useApiMutation((days: number) => updateBusinessRules(businessId, { maxDaysAhead: days }));

  const slotDirty = Boolean(base) && (step !== base!.stepMin || leadH !== Math.round((base!.leadTimeMin ?? 0) / 60));
  const horizonDirty = horizon !== (rules.maxDaysAhead ?? DEFAULT_MAX_DAYS_AHEAD);
  const dirty = slotDirty || horizonDirty;
  useUnsavedGuard(dirty);

  const save = async () => {
    try {
      if (slotDirty) await slotMutation.mutate({ stepMin: step, leadTimeMin: leadH > 0 ? leadH * 60 : undefined });
      if (horizonDirty) await horizonMutation.mutate(horizon);
      toast.success(t('settings.saved'));
    } catch {
      toast.error(t('settings.saveFailed'));
    }
  };

  const stepOptions = [...new Set([...STEP_OPTIONS, step])].sort((a, b) => a - b);
  const leadOptions = [...new Set([...LEAD_HOURS, leadH])].sort((a, b) => a - b);
  const horizonOptions = [...new Set([...HORIZON_DAYS, horizon])].sort((a, b) => a - b);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <FormField label={t('settings.when.step')}>
          <Select
            value={String(step)}
            disabled={!base}
            onValueChange={(v) => setStep(Number(v))}
            options={stepOptions.map((m) => ({ value: String(m), label: t('settings.when.stepValue', { min: m }) }))}
          />
        </FormField>
        <FormField label={t('settings.when.lead')}>
          <Select
            value={String(leadH)}
            disabled={!base}
            onValueChange={(v) => setLeadH(Number(v))}
            options={leadOptions.map((h) => ({ value: String(h), label: h === 0 ? t('settings.when.leadNone') : t('settings.when.leadValue', { h }) }))}
          />
        </FormField>
        <FormField label={t('settings.when.horizon')}>
          <Select
            value={String(horizon)}
            onValueChange={(v) => setHorizon(Number(v))}
            options={horizonOptions.map((d) => ({ value: String(d), label: t('settings.when.horizonValue', { d }) }))}
          />
        </FormField>
      </div>
      <p className="text-sm text-muted">
        {t('settings.when.moreHint')}{' '}
        <Link href="/biz/schedule/slots" className="inline-flex min-h-11 items-center gap-1 font-medium text-primary-text hover:underline">
          {t('settings.when.moreLink')}
          <ExternalLink aria-hidden className="size-3.5" />
        </Link>
      </p>
      {dirty && (
        <div>
          <Button size="sm" onClick={save} loading={slotMutation.isPending || horizonMutation.isPending}>
            {t('settings.save')}
          </Button>
        </div>
      )}
    </div>
  );
}
