'use client';

/**
 * Блок «Оплата за работу с записями» (F-09-039, F-09-040, F-09-041). Принадлежит разделу «payroll».
 */
import type { RecordsBlock as RecordsBlockType } from '@/domain/payroll';
import { useT } from '@/i18n/useT';
import { Checkbox } from '@/ui/Checkbox';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { BlockCard } from '@/areas/payroll/scheme/BlockCard';
import {
  OverridesEditor,
  type OverrideTargetOption,
} from '@/areas/payroll/scheme/OverridesEditor';
import { PayoutValueField } from '@/areas/payroll/scheme/PayoutValueField';

export interface RecordsBlockProps {
  value: RecordsBlockType;
  onChange: (value: RecordsBlockType) => void;
  targets: OverrideTargetOption[];
}

export function RecordsBlockCard({
  value,
  onChange,
  targets,
}: RecordsBlockProps) {
  const t = useT('payroll');
  const overridesOn = value.perServiceOverrides.length > 0;

  return (
    <div data-f="F-09-039">
      <BlockCard
        dataF="F-09-039"
        title={t('scheme.blocks.records.title')}
        description={t('scheme.blocks.records.description')}
        enabled={value.enabled}
        onEnabledChange={(enabled) => onChange({ ...value, enabled })}
      >
        {/* F-09-039: фиксированная сумма за саму созданную запись (только ֏), один раз за запись */}
        <FormField
          label={t('scheme.blocks.records.perBookingLabel')}
          hint={t('scheme.blocks.records.perBookingHint')}
          error={(value.perRecordAmount ?? 0) < 0 ? t('scheme.errors.amountNegative') : undefined}
        >
          <Input
            type="number"
            min={0}
            inputMode="decimal"
            value={value.perRecordAmount ?? 0}
            invalid={(value.perRecordAmount ?? 0) < 0}
            onChange={(e) => onChange({ ...value, perRecordAmount: Number(e.target.value) || 0 })}
            rightSlot={<span className="text-sm text-muted">֏</span>}
          />
        </FormField>
        <div data-f="F-09-040" className="border-t border-border pt-4">
          <PayoutValueField
            label={t('scheme.blocks.records.perServiceLabel')}
            hint={t('scheme.blocks.records.perServiceHint')}
            value={value.perServicePayout}
            onValueChange={(perServicePayout) =>
              onChange({ ...value, perServicePayout })
            }
          />
          <div className="flex flex-col gap-3 pt-3">
            <Checkbox
              checked={overridesOn}
              onCheckedChange={(on) =>
                onChange({
                  ...value,
                  perServiceOverrides: on ? value.perServiceOverrides : [],
                })
              }
              label={t('scheme.blocks.records.overridesToggle')}
            />
            {overridesOn && (
              <OverridesEditor
                overrides={value.perServiceOverrides}
                onChange={(perServiceOverrides) =>
                  onChange({ ...value, perServiceOverrides })
                }
                targets={targets}
              />
            )}
          </div>
        </div>

        <div
          data-f="F-09-041 F-03-128"
          className="flex flex-col gap-3 border-t border-border pt-4"
        >
          <Checkbox
            checked={value.onlineWidgetEnabled}
            onCheckedChange={(onlineWidgetEnabled) =>
              onChange({ ...value, onlineWidgetEnabled })
            }
            label={t('scheme.blocks.records.onlineWidgetToggle')}
            description={t('scheme.blocks.records.onlineWidgetHint')}
          />
          {value.onlineWidgetEnabled && (
            <PayoutValueField
              label={t('scheme.blocks.records.onlineWidgetLabel')}
              value={value.onlineWidgetPayout}
              onValueChange={(onlineWidgetPayout) =>
                onChange({ ...value, onlineWidgetPayout })
              }
            />
          )}
        </div>
      </BlockCard>
    </div>
  );
}
