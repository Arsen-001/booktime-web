'use client';

/**
 * Блок «Оплата за лично оказанные услуги» (F-09-014, F-09-016, F-09-015, F-09-018…020, F-09-024/025,
 * F-09-028…030). Принадлежит разделу «payroll».
 */
import type { ConsumablesMode, PersonalServicesBlock as PersonalServicesBlockType, PayoutOverride } from '@/domain/payroll';
import { useState } from 'react';
import { computeAssistSplit, computeGroupEventPayout, defaultAssistRates } from '@/domain/payroll';
import { useT } from '@/i18n/useT';
import { Checkbox } from '@/ui/Checkbox';
import { ChoiceGroup } from '@/ui/ChoiceGroup';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { BlockCard } from '@/areas/payroll/scheme/BlockCard';
import { LoyaltyAdjustmentFields } from '@/areas/payroll/scheme/LoyaltyAdjustmentFields';
import { OverridesEditor, type OverrideTargetOption } from '@/areas/payroll/scheme/OverridesEditor';
import { PayoutValueField } from '@/areas/payroll/scheme/PayoutValueField';

export interface PersonalServicesBlockProps {
  value: PersonalServicesBlockType;
  onChange: (value: PersonalServicesBlockType) => void;
  targets: OverrideTargetOption[];
  /** F-09-008: три ставки ассистирования видны, только когда «Основные настройки» это включили */
  assistCompensationEnabled: boolean;
}

export function PersonalServicesBlockCard({ value, onChange, targets, assistCompensationEnabled }: PersonalServicesBlockProps) {
  const t = useT('payroll');
  // F-09-016: переключатель — своё состояние, а не «есть ли уже хоть одно значение»: иначе включение
  // без немедленного добавления значения (обычный порядок работы) тут же гасло бы обратно (major,
  // qa/measure/payroll/b03-m0.md → F-09-105/тот же баг в этом блоке).
  const [overridesOn, setOverridesOnState] = useState(value.overrides.length > 0);
  const consumablesOn = (value.demoConsumablesPercent ?? 0) > 0;
  const assistRates = value.assistRates ?? defaultAssistRates();

  function setOverridesOn(on: boolean) {
    setOverridesOnState(on);
    if (!on) onChange({ ...value, overrides: [] });
  }

  function setConsumablesOn(on: boolean) {
    onChange({
      ...value,
      demoConsumablesPercent: on ? value.demoConsumablesPercent || 10 : 0,
      consumables: on
        ? { ...value.consumables, mode: value.consumables.mode === 'off' ? 'full' : value.consumables.mode }
        : { mode: 'off', applyClientDiscount: false },
    });
  }

  const consumablesModeOptions: { value: ConsumablesMode; title: string; description?: string }[] = [
    { value: 'full', title: t('scheme.blocks.personalServices.consumablesMode.full') },
    { value: 'proportional', title: t('scheme.blocks.personalServices.consumablesMode.proportional') },
    { value: 'off', title: t('scheme.blocks.personalServices.consumablesMode.off') },
  ];

  return (
    <div data-f="F-09-014 F-00-193">
      <BlockCard
        dataF="F-09-011 F-09-014"
        title={t('scheme.blocks.personalServices.title')}
        description={t('scheme.blocks.personalServices.description')}
        enabled={value.enabled}
        onEnabledChange={(enabled) => onChange({ ...value, enabled })}
      >
        <PayoutValueField
          label={t('scheme.blocks.personalServices.defaultLabel')}
          value={value.defaultPayout}
          onValueChange={(defaultPayout) => onChange({ ...value, defaultPayout })}
        />

        {assistCompensationEnabled && (
          <div data-f="F-09-015 F-09-047 F-16-145" className="flex flex-col gap-3 border-t border-border pt-4">
            <p className="text-sm font-medium text-fg">{t('scheme.blocks.personalServices.assistTitle')}</p>
            <PayoutValueField
              label={t('scheme.blocks.personalServices.assistWithout')}
              value={assistRates.withoutAssistant}
              onValueChange={(withoutAssistant) => onChange({ ...value, assistRates: { ...assistRates, withoutAssistant } })}
            />
            <PayoutValueField
              label={t('scheme.blocks.personalServices.assistWith')}
              hint={t('scheme.blocks.personalServices.assistWithHint')}
              value={assistRates.withAssistant ?? { unit: 'percent', value: 0 }}
              onValueChange={(withAssistant) => onChange({ ...value, assistRates: { ...assistRates, withAssistant } })}
            />
            <PayoutValueField
              label={t('scheme.blocks.personalServices.assistAs')}
              value={assistRates.asAssistant}
              onValueChange={(asAssistant) => onChange({ ...value, assistRates: { ...assistRates, asAssistant } })}
            />
            {(() => {
              // F-09-047: пример из справки — «без ассистента» и «как ассистент» текущей схемы, два ассистента
              const split = computeAssistSplit(1000, assistRates, [
                { staffId: 'demo-1', sharePct: 100 },
                { staffId: 'demo-2', sharePct: 100 },
              ]);
              return (
                <div className="rounded-lg border border-border bg-surface-2/50 p-3">
                  <p className="text-xs font-medium text-muted">{t('scheme.blocks.personalServices.assistExampleTitle')}</p>
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-fg">
                    <span>
                      {t('scheme.blocks.personalServices.assistExampleMaster')}: {split.masterAmount} ֏
                    </span>
                    {split.assistants.map((a, i) => (
                      <span key={a.staffId}>
                        {t('scheme.blocks.personalServices.assistExampleAssistant', { n: i + 1 })}: {a.amount} ֏
                      </span>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        <div data-f="F-09-016" className="flex flex-col gap-3 border-t border-border pt-4">
          <Checkbox checked={overridesOn} onCheckedChange={setOverridesOn} label={t('scheme.blocks.personalServices.overridesToggle')} />
          {overridesOn && (
            <OverridesEditor overrides={value.overrides} onChange={(overrides) => onChange({ ...value, overrides })} targets={targets} />
          )}
        </div>

        {/* data-f у LoyaltyAdjustmentFields рендерится динамически из пропа dataF — scripts/fids.mjs
            ищет только литеральный текст, поэтому те же id продублированы здесь литералом */}
        <div data-f="F-09-018 F-09-021">
          <LoyaltyAdjustmentFields
            dataF="F-09-018 F-09-021"
            value={value.loyaltyAdjustment}
            onChange={(loyaltyAdjustment) => onChange({ ...value, loyaltyAdjustment })}
          />
        </div>

        <div data-f="F-09-024 F-09-110 F-08-123" className="flex flex-col gap-3 border-t border-border pt-4">
          <Checkbox
            checked={consumablesOn}
            onCheckedChange={setConsumablesOn}
            label={t('scheme.blocks.personalServices.consumablesToggle')}
            description={t('scheme.blocks.personalServices.consumablesHint')}
          />
          {consumablesOn && (
            <>
              <FormField
                label={t('scheme.blocks.personalServices.consumablesLabel')}
                error={(value.demoConsumablesPercent ?? 0) < 0 || (value.demoConsumablesPercent ?? 0) > 100 ? t('scheme.errors.percentRange') : undefined}
              >
                <Input
                  type="number"
                  min={0}
                  max={100}
                  inputMode="decimal"
                  value={value.demoConsumablesPercent ?? 0}
                  onChange={(e) => onChange({ ...value, demoConsumablesPercent: Number(e.target.value) || 0 })}
                  rightSlot={<span className="text-sm text-muted">%</span>}
                  className="max-w-40"
                />
              </FormField>
              <ChoiceGroup
                options={consumablesModeOptions}
                value={value.consumables.mode}
                onValueChange={(mode) => onChange({ ...value, consumables: { ...value.consumables, mode: mode as ConsumablesMode } })}
                aria-label={t('scheme.blocks.personalServices.consumablesModeAriaLabel')}
                columns={1}
              />
              {value.consumables.mode !== 'off' && (
                <div data-f="F-09-025">
                  <Checkbox
                    checked={value.consumables.applyClientDiscount}
                    onCheckedChange={(applyClientDiscount) => onChange({ ...value, consumables: { ...value.consumables, applyClientDiscount } })}
                    label={t('scheme.blocks.personalServices.consumablesDiscount')}
                    description={t('scheme.blocks.personalServices.consumablesDiscountHint')}
                  />
                </div>
              )}
            </>
          )}
        </div>

        <div data-f="F-09-028 F-16-106 F-16-147" className="flex flex-col gap-3 border-t border-border pt-4">
          <p className="text-sm font-medium text-fg">{t('scheme.blocks.personalServices.groupTitle')}</p>
          <p className="text-sm text-muted">{t('scheme.blocks.personalServices.groupDescription')}</p>
          <Checkbox
            checked={value.groupEvents.enabled}
            onCheckedChange={(enabled) => onChange({ ...value, groupEvents: { ...value.groupEvents, enabled } })}
            label={t('scheme.blocks.personalServices.groupToggle')}
          />
          {value.groupEvents.enabled && (
            <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface-2/50 p-3">
              <Checkbox
                checked={value.groupEvents.minPayoutOn}
                onCheckedChange={(minPayoutOn) => onChange({ ...value, groupEvents: { ...value.groupEvents, minPayoutOn } })}
                label={t('scheme.blocks.personalServices.groupMinToggle')}
                description={t('scheme.blocks.personalServices.groupMinHint')}
              />
              {value.groupEvents.minPayoutOn && (
                <PayoutValueField
                  label={t('scheme.blocks.personalServices.groupMinLabel')}
                  value={value.groupEvents.minPayout}
                  onValueChange={(minPayout) => onChange({ ...value, groupEvents: { ...value.groupEvents, minPayout } })}
                />
              )}

              <div data-f="F-09-029" className="border-t border-border pt-3">
                <Checkbox
                  checked={value.groupEvents.atLeastOneOn}
                  onCheckedChange={(atLeastOneOn) => onChange({ ...value, groupEvents: { ...value.groupEvents, atLeastOneOn } })}
                  label={t('scheme.blocks.personalServices.groupAtLeastOneToggle')}
                />
                {value.groupEvents.atLeastOneOn && (
                  <div className="pt-2">
                    <PayoutValueField
                      label={t('scheme.blocks.personalServices.groupAtLeastOneLabel')}
                      value={value.groupEvents.atLeastOnePayout}
                      onValueChange={(atLeastOnePayout) => onChange({ ...value, groupEvents: { ...value.groupEvents, atLeastOnePayout } })}
                    />
                  </div>
                )}
              </div>

              <div data-f="F-09-030" className="border-t border-border pt-3">
                <ChoiceGroup
                  columns={1}
                  aria-label={t('scheme.blocks.personalServices.groupAttendeeAriaLabel')}
                  options={[
                    { value: 'none', title: t('scheme.blocks.personalServices.groupAttendee.none') },
                    { value: 'each', title: t('scheme.blocks.personalServices.groupAttendee.each') },
                    { value: 'aboveThreshold', title: t('scheme.blocks.personalServices.groupAttendee.aboveThreshold') },
                  ]}
                  value={value.groupEvents.perAttendeeMode}
                  onValueChange={(m) =>
                    onChange({ ...value, groupEvents: { ...value.groupEvents, perAttendeeMode: m as typeof value.groupEvents.perAttendeeMode } })
                  }
                />
                {value.groupEvents.perAttendeeMode === 'aboveThreshold' && (
                  <FormField label={t('scheme.blocks.personalServices.groupThresholdLabel')} className="pt-2">
                    <Input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={value.groupEvents.threshold}
                      onChange={(e) =>
                        onChange({ ...value, groupEvents: { ...value.groupEvents, threshold: Math.max(0, Number(e.target.value) || 0) } })
                      }
                      className="max-w-32"
                    />
                  </FormField>
                )}
              </div>

              {(() => {
                // F-09-028…030: пример из справки — цена услуги 1 000, 0 участников
                const zero = computeGroupEventPayout(0, 1000, value.groupEvents, value.defaultPayout);
                const three = computeGroupEventPayout(3, 1000, value.groupEvents, value.defaultPayout);
                return (
                  <div className="rounded-lg border border-border bg-surface-2/50 p-3">
                    <p className="text-xs font-medium text-muted">{t('scheme.blocks.personalServices.groupExampleTitle')}</p>
                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-fg">
                      <span>
                        {t('scheme.blocks.personalServices.groupExampleZero')}: {zero} ֏
                      </span>
                      <span>
                        {t('scheme.blocks.personalServices.groupExampleThree')}: {three} ֏
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </BlockCard>
    </div>
  );
}

export function pickPersonalOverride(list: PayoutOverride[], targetId: string, categoryId?: string): PayoutOverride | undefined {
  return list.find((o) => (o.targetType === 'item' && o.targetId === targetId) || (o.targetType === 'category' && o.targetId === categoryId));
}
