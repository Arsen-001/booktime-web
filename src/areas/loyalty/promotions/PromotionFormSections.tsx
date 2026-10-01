'use client';

/**
 * Пять секций формы акции — общие для мастера (шаг за шагом) и для правки (все сразу).
 *   Section1NameType  — F-06-032 (название, тип: скидка/бонус)
 *   Section2Kind       — F-06-033 (4+4 вида)
 *   Section3Calc       — F-06-034, F-06-037…F-06-046 (способ расчёта: размер, таблица порогов, источник,
 *                         дата истории, сумма-база, частота/лимит, условие n-й услуги)
 *   Section4Rules      — F-06-035, F-06-047 (услуги/товары, отмена скидки, сгорание бонусов)
 *   Section5Scope      — F-06-036, F-06-049(флаг), F-06-082 (типы карт, локации, уведомления)
 */
import { useMemo } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { coreList } from '@/api/core';
import { getReferralSettings, listCardTypes, listServiceScopeOptions, type CardTypeRow } from '@/api/loyalty';
import { useApiQuery } from '@/api/request';
import { useCurrent, useDemo } from '@/demo/hooks';
import type { Id } from '@/domain/core';
import { isDiscountKind, type PromotionKind, type PromotionValidationErrors } from '@/domain/loyalty';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { pickText } from '@/lib/text';
import { NotifyTemplateField } from '@/areas/loyalty/NotifyTemplateField';
import { ServiceScopePicker } from '@/areas/loyalty/ServiceScopePicker';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { Checkbox } from '@/ui/Checkbox';
import { ChoiceGroup } from '@/ui/ChoiceGroup';
import { DatePicker } from '@/ui/DatePicker';
import { EmptyState } from '@/ui/EmptyState';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { MoneyInput } from '@/ui/MoneyInput';
import { RadioGroup } from '@/ui/Radio';
import { Select } from '@/ui/Select';
import { Skeleton } from '@/ui/Skeleton';
import { Switch } from '@/ui/Switch';
import { TimePicker } from '@/ui/TimePicker';
import { BONUS_KINDS, DISCOUNT_KINDS, isAccumulating, needsCancelBurn, needsFrequencyLimit, needsSumBasis, type PromotionDraft } from '@/areas/loyalty/promotions/promotionDraft';

type Patch = (patch: Partial<PromotionDraft>) => void;
/** Л3: ошибки проверки акции — ключи текстов promotionWizard.errors.* (validatePromotion) */
type Errors = PromotionValidationErrors;

// ─────────────────────────── Шаг 1 · F-06-032 ───────────────────────────

export function Section1NameType({ draft, patch, locked = false, errors = {} }: { draft: PromotionDraft; patch: Patch; locked?: boolean; errors?: Errors }) {
  const t = useT('loyalty');
  return (
    <div data-f="F-06-032" className="flex flex-col gap-5">
      <FormField label={t('promotionWizard.name')} required error={errors.name && t(`promotionWizard.errors.${errors.name}` as 'promotionWizard.errors.percentRange')}>
        <Input value={draft.name} onChange={(e) => patch({ name: e.target.value })} placeholder={t('promotionWizard.namePlaceholder')} />
      </FormField>
      <FormField label={t('promotionWizard.familyLabel')} hint={locked ? t('promotionWizard.familyLockedHint') : undefined}>
        <ChoiceGroup
          columns={2}
          value={draft.family}
          onValueChange={(v) => {
            if (locked) return;
            const family = v as 'discount' | 'bonus';
            patch({
              family,
              kind: family === 'discount' ? DISCOUNT_KINDS[0] : BONUS_KINDS[0],
            });
          }}
          options={[
            {
              value: 'discount',
              title: t('promotionWizard.familyOptions.discount.title'),
              description: t('promotionWizard.familyOptions.discount.description'),
              disabled: locked && draft.family !== 'discount',
            },
            {
              value: 'bonus',
              title: t('promotionWizard.familyOptions.bonus.title'),
              description: t('promotionWizard.familyOptions.bonus.description'),
              disabled: locked && draft.family !== 'bonus',
            },
          ]}
        />
      </FormField>
    </div>
  );
}

// ─────────────────────────── Шаг 2 · F-06-033 ───────────────────────────

export function Section2Kind({ draft, patch, locked = false }: { draft: PromotionDraft; patch: Patch; locked?: boolean }) {
  const t = useT('loyalty');
  const kinds = draft.family === 'discount' ? DISCOUNT_KINDS : BONUS_KINDS;
  const REFERRAL_HINT_KINDS: PromotionKind[] = ['discountFixed', 'cashbackFixed'];
  return (
    <div data-f="F-06-033" className="flex flex-col gap-3">
      {locked && <p className="text-sm text-muted">{t('promotionWizard.kindLockedHint')}</p>}
      <ChoiceGroup
        columns={2}
        value={draft.kind}
        onValueChange={(v) => {
          if (locked) return;
          patch({ kind: v as PromotionKind });
        }}
        options={kinds.map((k) => ({
          value: k,
          title: t(`promotions.kinds.${k}`),
          description: (
            <>
              {t(`promotionWizard.kindDescriptions.${k}`)}
              <span className="mt-1 block text-muted">{t(`promotionWizard.kindExamples.${k}`)}</span>
              {REFERRAL_HINT_KINDS.includes(k) && (
                <Badge tone="accent" size="sm" className="mt-1.5">
                  {/* Л11: скидка — приглашённому, бонус — пригласившему; не путать стороны */}
                  {t(k === 'discountFixed' ? 'promotionWizard.referralFriendlyInvitee' : 'promotionWizard.referralFriendlyReferrer')}
                </Badge>
              )}
            </>
          ),
          disabled: locked && k !== draft.kind,
        }))}
      />
    </div>
  );
}

// ─────────────────────────── Шаг 3 · F-06-034, F-06-037…F-06-046 ───────────────────────────

function ThresholdsTable({ draft, patch, unitLabel }: { draft: PromotionDraft; patch: Patch; unitLabel: string }) {
  const t = useT('loyalty');
  const set = (rows: PromotionDraft['thresholds']) => patch({ thresholds: rows });
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border-strong bg-surface p-3">
      <div className="flex items-center gap-3 text-xs font-medium text-muted">
        <span className="flex-1">{unitLabel}</span>
        <span className="w-24">{draft.valueType === 'percent' ? t('promotionWizard.thresholds.valuePercent') : t('promotionWizard.thresholds.valueFixed')}</span>
        <span className="w-8" />
      </div>
      {draft.thresholds.map((row, i) => (
        <div key={i} className="flex items-center gap-3">
          <Input type="number" min={0} value={row.from} onChange={(e) => set(draft.thresholds.map((r, idx) => (idx === i ? { ...r, from: Number(e.target.value) || 0 } : r)))} className="flex-1" />
          <Input type="number" min={0} value={row.value} onChange={(e) => set(draft.thresholds.map((r, idx) => (idx === i ? { ...r, value: Number(e.target.value) || 0 } : r)))} className="w-24" />
          <Button type="button" variant="ghost" size="sm" aria-label={t('promotionWizard.thresholds.remove')} onClick={() => set(draft.thresholds.filter((_, idx) => idx !== i))} disabled={draft.thresholds.length <= 1} className="w-8 shrink-0 px-0">
            <Trash2 className="size-4" aria-hidden />
          </Button>
        </div>
      ))}
      <Button type="button" variant="secondary" size="sm" leftIcon={<Plus aria-hidden />} onClick={() => set([...draft.thresholds, { from: 0, value: 0 }])} className="self-start">
        {t('promotionWizard.thresholds.add')}
      </Button>
    </div>
  );
}

export function Section3Calc({ draft, patch, errors = {} }: { draft: PromotionDraft; patch: Patch; errors?: Errors }) {
  const t = useT('loyalty');
  const { ready, businessId } = useCurrent();
  const accumulating = isAccumulating(draft.kind);
  const isConditional = draft.kind === 'discountConditional';

  const scopeQ = useApiQuery(['loyalty', 'serviceScope', businessId], () => listServiceScopeOptions(businessId!), {
    enabled: ready && Boolean(businessId) && isConditional,
  });

  return (
    <div data-f="F-06-034" className="flex flex-col gap-5">
      {!isConditional && (
        <>
          <FormField label={draft.family === 'discount' ? t('promotionWizard.valueType') : t('promotionWizard.bonusType')}>
            <RadioGroup
              orientation="horizontal"
              value={draft.valueType}
              onValueChange={(v) => patch({ valueType: v as 'percent' | 'fixed' })}
              options={[
                {
                  value: 'percent',
                  label: t('promotionWizard.valueTypeOptions.percent'),
                },
                {
                  value: 'fixed',
                  label: t('promotionWizard.valueTypeOptions.fixed'),
                },
              ]}
            />
          </FormField>

          {!accumulating ? (
            // Ровно один вид рендерится за раз: discountFixed (F-06-037) или cashbackFixed (F-06-041)
            <div data-f="F-06-037 F-06-041">
              <FormField label={t('promotionWizard.value')} error={errors.value && t(`promotionWizard.errors.${errors.value}` as 'promotionWizard.errors.percentRange')}>{draft.valueType === 'percent' ? <Input type="number" min={0} max={100} value={draft.value} onChange={(e) => patch({ value: Number(e.target.value) || 0 })} /> : <MoneyInput value={draft.value} onValueChange={(v) => patch({ value: v ?? 0 })} />}</FormField>
            </div>
          ) : (
            // Ровно один вид рендерится за раз (kind из ChoiceGroup на шаге 2); все пять литеральных id — на одном
            // узле, чтобы их видел статический подсчёт охвата (scripts/fids.mjs ищет только строковый литерал).
            <div data-f="F-06-038 F-06-039 F-06-042 F-06-043 F-06-044">
              <FormField label={t('promotionWizard.thresholdsLabel')} hint={t(`promotionWizard.thresholdsHint.${draft.kind}`)} error={errors.thresholds && t(`promotionWizard.errors.${errors.thresholds}` as 'promotionWizard.errors.percentRange')}>
                <ThresholdsTable draft={draft} patch={patch} unitLabel={t(`promotionWizard.thresholdUnit.${draft.kind}`)} />
              </FormField>
            </div>
          )}
        </>
      )}

      {isConditional && (
        <div data-f="F-06-040" className="flex flex-col gap-5">
          <FormField label={t('promotionWizard.conditionCount')} hint={t('promotionWizard.conditionCountHint')} error={errors.conditionCount && t(`promotionWizard.errors.${errors.conditionCount}` as 'promotionWizard.errors.percentRange')}>
            <Input type="number" min={1} value={draft.conditionCount} onChange={(e) => patch({ conditionCount: Number(e.target.value) || 1 })} />
          </FormField>
          <FormField label={t('promotionWizard.conditionDiscount')}>
            <RadioGroup
              orientation="horizontal"
              value={draft.valueType}
              onValueChange={(v) => patch({ valueType: v as 'percent' | 'fixed' })}
              options={[
                {
                  value: 'percent',
                  label: t('promotionWizard.valueTypeOptions.percent'),
                },
                {
                  value: 'fixed',
                  label: t('promotionWizard.valueTypeOptions.fixed'),
                },
              ]}
            />
          </FormField>
          <FormField label={t('promotionWizard.value')} error={errors.value && t(`promotionWizard.errors.${errors.value}` as 'promotionWizard.errors.percentRange')}>{draft.valueType === 'percent' ? <Input type="number" min={0} max={100} value={draft.value} onChange={(e) => patch({ value: Number(e.target.value) || 0 })} /> : <MoneyInput value={draft.value} onValueChange={(v) => patch({ value: v ?? 0 })} />}</FormField>
          <FormField label={t('promotionWizard.conditionServices')} hint={t('promotionWizard.conditionServicesHint')}>
            {scopeQ.isLoading ? (
              <Skeleton lines={3} />
            ) : !scopeQ.data?.services.length ? (
              <EmptyState compact title={t('serviceScope.emptyTitle')} />
            ) : (
              <div className="flex max-h-56 flex-col gap-1 overflow-y-auto rounded-xl border border-border bg-surface-2 p-3">
                {scopeQ.data.services.map((s) => (
                  <Checkbox
                    key={s.id}
                    checked={draft.conditionServiceIds.includes(s.id)}
                    onCheckedChange={(checked) =>
                      patch({
                        conditionServiceIds: checked ? [...draft.conditionServiceIds, s.id] : draft.conditionServiceIds.filter((id) => id !== s.id),
                      })
                    }
                    label={s.name}
                  />
                ))}
              </div>
            )}
          </FormField>
        </div>
      )}

      {(accumulating || isConditional) && (
        <div data-f="F-06-045" className="flex flex-col gap-5 rounded-xl border border-border bg-surface-2 p-4">
          <FormField label={t('promotionWizard.sourceScope')} hint={t('promotionWizard.sourceScopeHint')}>
            <Select
              options={[
                {
                  value: 'activeLocations',
                  label: t('promotionWizard.sourceScopeOptions.activeLocations'),
                },
                {
                  value: 'network',
                  label: t('promotionWizard.sourceScopeOptions.network'),
                },
                {
                  value: 'card',
                  label: t('promotionWizard.sourceScopeOptions.card'),
                },
              ]}
              value={draft.sourceScope}
              onValueChange={(v) => patch({ sourceScope: v as PromotionDraft['sourceScope'] })}
            />
          </FormField>
          <FormField label={t('promotionWizard.historyStartDate')} optional>
            <DatePicker value={draft.historyStartDate || null} onValueChange={(v) => patch({ historyStartDate: v ?? '' })} clearable />
          </FormField>
        </div>
      )}

      {needsSumBasis(draft.kind) && (
        <div data-f="F-06-039">
          <FormField label={t('promotionWizard.sumBasis')} hint={t('promotionWizard.sumBasisHint')}>
            <RadioGroup
              value={draft.sumBasis}
              onValueChange={(v) => patch({ sumBasis: v as PromotionDraft['sumBasis'] })}
              options={[
                {
                  value: 'listPrice',
                  label: t('promotionWizard.sumBasisOptions.listPrice'),
                },
                {
                  value: 'afterDiscounts',
                  label: t('promotionWizard.sumBasisOptions.afterDiscounts'),
                },
              ]}
            />
          </FormField>
        </div>
      )}

      {needsFrequencyLimit(draft.kind) && (
        <div data-f="F-06-046" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label={t('promotionWizard.applyFrequency')} hint={t('promotionWizard.applyFrequencyHint')} error={errors.applyFrequency && t(`promotionWizard.errors.${errors.applyFrequency}` as 'promotionWizard.errors.percentRange')}>
            <Input type="number" min={1} value={draft.applyFrequency} onChange={(e) => patch({ applyFrequency: Number(e.target.value) || 1 })} />
          </FormField>
          <FormField label={t('promotionWizard.applyLimit')} hint={t('promotionWizard.applyLimitHint')}>
            <Input type="number" min={0} value={draft.applyLimit} onChange={(e) => patch({ applyLimit: Number(e.target.value) || 0 })} />
          </FormField>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────── Шаг 4 · F-06-035, F-06-047 ───────────────────────────

export function Section4Rules({ draft, patch, errors = {} }: { draft: PromotionDraft; patch: Patch; errors?: Errors }) {
  const t = useT('loyalty');

  return (
    <div data-f="F-06-035" className="flex flex-col gap-5">
      <FormField label={t('promotionWizard.serviceLimitLabel')}>
        <RadioGroup
          orientation="horizontal"
          value={draft.serviceLimitMode}
          onValueChange={(v) => patch({ serviceLimitMode: v as PromotionDraft['serviceLimitMode'] })}
          options={[
            {
              value: 'all',
              label: t('cardTypeForm.limitModeOptions.allServices'),
            },
            {
              value: 'none',
              label: t('cardTypeForm.limitModeOptions.noneServices'),
            },
            {
              value: 'some',
              label: t('cardTypeForm.limitModeOptions.someServices'),
            },
          ]}
        />
      </FormField>
      {draft.serviceLimitMode === 'some' && <ServiceScopePicker value={draft.serviceScope} onChange={(v) => patch({ serviceScope: v })} />}

      <FormField label={t('promotionWizard.productLimitLabel')}>
        <RadioGroup
          orientation="horizontal"
          value={draft.productLimitMode}
          onValueChange={(v) => patch({ productLimitMode: v as PromotionDraft['productLimitMode'] })}
          options={[
            {
              value: 'all',
              label: t('cardTypeForm.limitModeOptions.allProducts'),
            },
            {
              value: 'none',
              label: t('cardTypeForm.limitModeOptions.noneProducts'),
            },
            {
              value: 'some',
              label: t('cardTypeForm.limitModeOptions.someProducts'),
            },
          ]}
        />
      </FormField>

      {needsCancelBurn(draft.kind) && (
        <div data-f="F-06-047" className="flex flex-col gap-5 rounded-xl border border-border bg-surface-2 p-4">
          <Switch checked={draft.cancelEnabled} onCheckedChange={(v) => patch({ cancelEnabled: v })} label={t('promotionWizard.cancelEnabled')} description={t('promotionWizard.cancelHint')} />
          {draft.cancelEnabled && (
            <FormField label={t('promotionWizard.cancelDays')} error={errors.days && t(`promotionWizard.errors.${errors.days}` as 'promotionWizard.errors.percentRange')}>
              <Input type="number" min={1} value={draft.cancelDays} onChange={(e) => patch({ cancelDays: Number(e.target.value) || 1 })} />
            </FormField>
          )}
          <Switch checked={draft.burnEnabled} onCheckedChange={(v) => patch({ burnEnabled: v })} label={t('promotionWizard.burnEnabled')} description={t('promotionWizard.burnHint')} />
          {draft.burnEnabled && (
            <FormField label={t('promotionWizard.burnDaysLabel')} error={errors.days && t(`promotionWizard.errors.${errors.days}` as 'promotionWizard.errors.percentRange')}>
              <Input type="number" min={1} value={draft.burnDays} onChange={(e) => patch({ burnDays: Number(e.target.value) || 1 })} />
            </FormField>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────── Шаг 5 · F-06-036, F-06-082 ───────────────────────────

export function Section5Scope({ draft, patch, cardTypes, excludePromotionId, errors = {} }: { draft: PromotionDraft; patch: Patch; cardTypes: CardTypeRow[]; excludePromotionId?: Id; errors?: Errors }) {
  const t = useT('loyalty');
  const format = useFormat();
  const { ready, businessId } = useCurrent();
  const { lang } = useDemo();

  const locationsQ = useApiQuery(['loyalty', 'locations', businessId], () => coreList('locations', { businessId: businessId ?? '' }), {
    enabled: ready && Boolean(businessId),
  });
  const referralQ = useApiQuery(['loyalty', 'referral', businessId], () => getReferralSettings(businessId!), { enabled: ready && Boolean(businessId) });

  // F-06-082: акция, уже назначенная «бонусом пригласившему» в рефералке, не должна получать привязку к карте
  const isReferrerPromotion = referralQ.data?.referrerPromotionId != null && referralQ.data.referrerPromotionId === excludePromotionId;
  const isInviteePromotion = referralQ.data?.inviteePromotionId != null && referralQ.data.inviteePromotionId === excludePromotionId;
  const showReferralWarning = (isReferrerPromotion || isInviteePromotion) && draft.cardTypeIds.length > 0;

  const showNotify = isAccumulating(draft.kind) || draft.family === 'bonus';
  const locations = locationsQ.data ?? [];

  return (
    <div data-f="F-06-036" className="flex flex-col gap-5">
      <div data-f="F-06-082">
        <FormField label={t('promotionWizard.cardTypesLabel')}>
          {cardTypes.length === 0 ? (
            <EmptyState compact title={t('promotionWizard.noCardTypes')} />
          ) : (
            <div className="flex flex-col gap-1.5 rounded-xl border border-border-strong bg-surface p-3">
              {cardTypes.map((ct) => (
                <Checkbox
                  key={ct.id}
                  checked={draft.cardTypeIds.includes(ct.id)}
                  onCheckedChange={(checked) =>
                    patch({
                      cardTypeIds: checked ? [...draft.cardTypeIds, ct.id] : draft.cardTypeIds.filter((id) => id !== ct.id),
                    })
                  }
                  label={ct.name}
                />
              ))}
            </div>
          )}
        </FormField>
        {showReferralWarning && <p className="mt-2 rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning">{t(isReferrerPromotion ? 'promotionWizard.referralCardWarning' : 'promotionWizard.referralInviteeCardWarning')}</p>}
      </div>

      <FormField label={t('promotionWizard.locationsLabel')}>
        {locationsQ.isLoading ? (
          <Skeleton lines={2} />
        ) : locations.length === 0 ? (
          <EmptyState compact title={t('cardTypeForm.noLocations')} />
        ) : (
          <div className="flex flex-col gap-1.5 rounded-xl border border-border-strong bg-surface p-3">
            {locations.map((l) => (
              <Checkbox
                key={l.id}
                checked={draft.locationIds.includes(l.id)}
                onCheckedChange={(checked) =>
                  patch({
                    locationIds: checked ? [...draft.locationIds, l.id] : draft.locationIds.filter((id) => id !== l.id),
                  })
                }
                label={pickText(l.name, lang)}
              />
            ))}
          </div>
        )}
      </FormField>

      <div data-f="F-06-183" className="flex flex-col gap-3 rounded-xl border border-border-strong bg-surface p-3">
        <p className="text-sm font-medium text-fg">{t('promotionWizard.validRange.title')}</p>
        <p className="text-xs text-muted">{t('promotionWizard.validRange.hint')}</p>
        <div className="flex flex-wrap items-end gap-2">
          <FormField label={t('promotionWizard.validRange.from')} className="min-w-40">
            <DatePicker value={draft.validFrom || null} onValueChange={(v) => patch({ validFrom: v ?? '' })} max={draft.validTo || undefined} clearable />
          </FormField>
          <span className="pb-2.5 text-sm text-muted">{t('promotionWizard.schedule.until')}</span>
          <FormField label={t('promotionWizard.validRange.to')} className="min-w-40" error={errors.validTo && t(`promotionWizard.errors.${errors.validTo}` as 'promotionWizard.errors.percentRange')}>
            <DatePicker value={draft.validTo || null} onValueChange={(v) => patch({ validTo: v ?? '' })} min={draft.validFrom || undefined} clearable />
          </FormField>
        </div>
      </div>

      <div data-f="F-06-183" className="flex flex-col gap-3 rounded-xl border border-border-strong bg-surface p-3">
        <Switch checked={draft.schedule.enabled} onCheckedChange={(v) => patch({ schedule: { ...draft.schedule, enabled: v } })} label={t('promotionWizard.schedule.enable')} description={t('promotionWizard.schedule.hint')} />
        {draft.schedule.enabled && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-1.5">
              {format.weekdaysShort().map((label, i) => {
                // format.weekdaysShort() идёт с понедельника (ISO), а PromotionSchedule.days хранит JS
                // Date.getDay() (0 = воскресенье) — тот же формат, что читает isPromotionScheduleActiveNow.
                const dayValue = (i + 1) % 7;
                const on = draft.schedule.days.includes(dayValue);
                return (
                  <button
                    key={i}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      patch({
                        schedule: {
                          ...draft.schedule,
                          days: on ? draft.schedule.days.filter((d) => d !== dayValue) : [...draft.schedule.days, dayValue].sort(),
                        },
                      })
                    }
                    className={cn('flex size-9 items-center justify-center rounded-full border text-sm font-medium transition-colors', on ? 'border-primary bg-primary/10 text-primary-text' : 'border-border-strong text-muted hover:bg-surface-2')}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              <TimePicker value={draft.schedule.fromTime} onValueChange={(v) => patch({ schedule: { ...draft.schedule, fromTime: v } })} />
              <span className="text-sm text-muted">{t('promotionWizard.schedule.until')}</span>
              <TimePicker value={draft.schedule.toTime} onValueChange={(v) => patch({ schedule: { ...draft.schedule, toTime: v } })} />
            </div>
          </div>
        )}
      </div>

      {showNotify && (
        <div data-f="F-06-049" className="flex flex-col gap-4">
          <Switch checked={draft.notifyEnabled} onCheckedChange={(v) => patch({ notifyEnabled: v })} label={t('promotionWizard.notifyEnabled')} description={t('promotionWizard.notifyHint')} />
          {draft.notifyEnabled && (
            <div className="flex flex-col gap-3 rounded-xl border border-border-strong bg-surface-2 p-3">
              <p className="text-sm font-medium text-fg">{t('promotionWizard.notify.sectionTitle')}</p>
              {isDiscountKind(draft.kind) ? <NotifyTemplateField value={draft.notify.discountChange} onChange={(v) => patch({ notify: { ...draft.notify, discountChange: v } })} label={t('promotionWizard.notify.discountChange')} templates={t.raw('promotionWizard.notify.discountChangeTemplates') as [string, string, string]} /> : <NotifyTemplateField value={draft.notify.cashbackChange} onChange={(v) => patch({ notify: { ...draft.notify, cashbackChange: v } })} label={t('promotionWizard.notify.cashbackChange')} templates={t.raw('promotionWizard.notify.cashbackChangeTemplates') as [string, string, string]} />}
              {/* F-06-049: «о скорой отмене скидки» — только для накопительной скидки, «о скором обнулении
                  бонусов» — только для бонусных акций (текст обеих завязан на слово «скидка»/«бонусы»,
                  смешивать семьи нельзя, даже если общий переключатель cancelEnabled/burnEnabled у обеих). */}
              {isDiscountKind(draft.kind) && draft.cancelEnabled && <NotifyTemplateField value={draft.notify.cancelSoon} onChange={(v) => patch({ notify: { ...draft.notify, cancelSoon: v } })} label={t('promotionWizard.notify.cancelSoon')} description={t('promotionWizard.notify.cancelSoonHint')} templates={t.raw('promotionWizard.notify.cancelSoonTemplates') as [string, string, string]} />}
              {!isDiscountKind(draft.kind) && draft.burnEnabled && <NotifyTemplateField value={draft.notify.burnSoon} onChange={(v) => patch({ notify: { ...draft.notify, burnSoon: v } })} label={t('promotionWizard.notify.burnSoon')} description={t('promotionWizard.notify.burnSoonHint')} templates={t.raw('promotionWizard.notify.burnSoonTemplates') as [string, string, string]} />}
            </div>
          )}
        </div>
      )}

      {/* Итог перед сохранением — человеческим языком, а не «перечитай все 5 шагов» */}
      <div className="rounded-xl border border-border bg-surface-2 p-4">
        <p className="text-sm font-semibold text-fg">{t('promotionWizard.summaryTitle')}</p>
        <p className="mt-1 text-sm text-muted">
          {t(`promotions.kinds.${draft.kind}`)}
          {' · '}
          {draft.cardTypeIds.length === 0
            ? t('promotionWizard.summaryNoCards')
            : t('promotionWizard.summaryCards', {
                count: draft.cardTypeIds.length,
              })}
          {' · '}
          {draft.locationIds.length === 0
            ? t('promotionWizard.summaryAllLocations')
            : t('promotionWizard.summaryLocations', {
                count: draft.locationIds.length,
              })}
        </p>
        {draft.cardTypeIds.length === 0 && <p className="mt-2 rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning">{t('promotionWizard.summaryNoCardsWarning')}</p>}
      </div>
    </div>
  );
}

export function useCardTypesList(): CardTypeRow[] {
  const { ready, businessId } = useCurrent();
  const q = useApiQuery(['loyalty', 'cardTypes', businessId], () => listCardTypes(businessId!), { enabled: ready && Boolean(businessId) });
  return useMemo(() => q.data ?? [], [q.data]);
}
