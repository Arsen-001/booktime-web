'use client';

/**
 * «Корректировка для программ лояльности и скидок» — общий блок для услуг (F-09-018…020) и товаров
 * (F-09-033). Принадлежит разделу «payroll».
 */
import type { LoyaltyAdjustmentBlock } from '@/domain/payroll';
import { personalServiceLoyaltyPayout } from '@/domain/payroll';
import { useT } from '@/i18n/useT';
import { Checkbox } from '@/ui/Checkbox';
import { Switch } from '@/ui/Switch';
import { PayoutValueField } from '@/areas/payroll/scheme/PayoutValueField';

export interface LoyaltyAdjustmentFieldsProps {
  value: LoyaltyAdjustmentBlock;
  onChange: (value: LoyaltyAdjustmentBlock) => void;
  /**
   * Каждый вызывающий передаёт готовую строку своих F-id литералом (scripts/fids.mjs ищет
   * `data-f="F-…"` статическим текстом, не умеет проследить проп через файл): у услуг —
   * «F-09-018 F-09-021», у товаров — «F-09-033 F-09-021» (F-09-021 — формула лояльности,
   * общая для обоих мест, см. domain/payroll.ts personalServiceLoyaltyPayout).
   */
  dataF: string;
}

export function LoyaltyAdjustmentFields({
  value,
  onChange,
  dataF,
}: LoyaltyAdjustmentFieldsProps) {
  const t = useT('payroll');

  return (
    <div data-f={dataF} className="flex flex-col gap-3 border-t border-border pt-4">
      <Switch
        checked={value.enabled}
        onCheckedChange={(enabled) => onChange({ ...value, enabled })}
        label={t('scheme.loyalty.toggle')}
        description={t('scheme.loyalty.hint')}
      />
      {value.enabled && (
        <div
          data-f="F-09-019"
          className="flex flex-col gap-2 rounded-lg border border-border bg-surface-2/50 p-3"
        >
          <Checkbox
            checked={value.includeDiscount}
            onCheckedChange={(includeDiscount) =>
              onChange({ ...value, includeDiscount })
            }
            label={t('scheme.loyalty.includeDiscount')}
          />
          <Checkbox
            checked={value.includeBonus}
            onCheckedChange={(includeBonus) =>
              onChange({ ...value, includeBonus })
            }
            label={t('scheme.loyalty.includeBonus')}
          />
          <div data-f="F-09-023">
            <Checkbox
              checked={value.includeMembership}
              onCheckedChange={(includeMembership) =>
                onChange({ ...value, includeMembership })
              }
              label={t('scheme.loyalty.includeMembership')}
            />
          </div>
          <div data-f="F-09-022">
            <Checkbox
              checked={value.includeClientAccount}
              onCheckedChange={(includeClientAccount) =>
                onChange({ ...value, includeClientAccount })
              }
              label={t('scheme.loyalty.includeClientAccount')}
            />
          </div>
          <Checkbox
            checked={value.includeCertificate}
            onCheckedChange={(includeCertificate) =>
              onChange({ ...value, includeCertificate })
            }
            label={t('scheme.loyalty.includeCertificate')}
          />
          <Checkbox
            checked={value.includePromotion}
            onCheckedChange={(includePromotion) =>
              onChange({ ...value, includePromotion })
            }
            label={t('scheme.loyalty.includePromotion')}
          />

          {value.includePromotion && (
            <div data-f="F-09-020" className="pt-2">
              <PayoutValueField
                label={t('scheme.loyalty.promoLabel')}
                hint={t('scheme.loyalty.promoHint')}
                value={value.promoPayout}
                onValueChange={(promoPayout) =>
                  onChange({ ...value, promoPayout })
                }
              />
            </div>
          )}

          <div data-f="F-09-021 F-06-178" className="mt-1 rounded-lg border border-border bg-surface-2/50 p-3">
            <p className="text-xs font-medium text-muted">{t('scheme.loyalty.exampleTitle')}</p>
            <p className="mt-1 text-sm text-fg">
              {t('scheme.loyalty.exampleResult', {
                amount: personalServiceLoyaltyPayout(
                  1600,
                  80,
                  { unit: 'percent', value: 50 },
                  { unit: 'percent', value: 22 },
                  value.includeBonus,
                ),
              })}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
