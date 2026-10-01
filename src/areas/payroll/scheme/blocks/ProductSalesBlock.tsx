'use client';

/**
 * Блок «Оплата за продажу товаров» (F-09-031, F-09-032, F-09-033, F-09-034, F-09-105). Принадлежит
 * разделу «payroll». Категорий товаров у нас пока нет (владелец каталога — раздел stock, не построен) —
 * индивидуальные значения на отдельный товар, плюс наши синтетические «категории» «Абонементы» /
 * «Сертификаты» (F-09-105, targets их уже содержит — см. SchemeEditor).
 */
import { useState } from 'react';
import type { ProductCostOrder, ProductSalesBlock as ProductSalesBlockType } from '@/domain/payroll';
import { useT } from '@/i18n/useT';
import { Checkbox } from '@/ui/Checkbox';
import { ChoiceGroup } from '@/ui/ChoiceGroup';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { BlockCard } from '@/areas/payroll/scheme/BlockCard';
import { LoyaltyAdjustmentFields } from '@/areas/payroll/scheme/LoyaltyAdjustmentFields';
import { OverridesEditor, type OverrideTargetOption } from '@/areas/payroll/scheme/OverridesEditor';
import { PayoutValueField } from '@/areas/payroll/scheme/PayoutValueField';

export interface ProductSalesBlockProps {
  value: ProductSalesBlockType;
  onChange: (value: ProductSalesBlockType) => void;
  targets: OverrideTargetOption[];
}

export function ProductSalesBlockCard({ value, onChange, targets }: ProductSalesBlockProps) {
  const t = useT('payroll');
  // F-09-105/F-09-032: переключатель — своё состояние, а не «есть ли уже хоть одно значение», иначе
  // включение (без значения сразу после) гасло бы обратно и «Выбрать из списка» было бы недоступимо
  // кликом (major, qa/measure/payroll/b03-m0.md).
  const [overridesOn, setOverridesOn] = useState(value.overrides.length > 0);
  const costOn = (value.demoCostPercent ?? 0) > 0;

  return (
    <div data-f="F-09-031 F-08-124">
      <BlockCard
        dataF="F-09-031"
        title={t('scheme.blocks.productSales.title')}
        description={t('scheme.blocks.productSales.description')}
        enabled={value.enabled}
        onEnabledChange={(enabled) => onChange({ ...value, enabled })}
      >
        {/* З9: продажа товара пока не хранит продавца — честно говорим, что начислится 0 */}
        <p data-f="F-09-031" className="rounded-lg border border-warning/50 bg-warning/10 px-3 py-2 text-sm text-fg">
          {t('scheme.productsNotLinked')}
        </p>
        <PayoutValueField
          label={t('scheme.blocks.productSales.defaultLabel')}
          value={value.defaultPayout}
          onValueChange={(defaultPayout) => onChange({ ...value, defaultPayout })}
        />
        {/* F-09-035: архивный товар выпадает из расчёта — targets собирает SchemeEditor из живого каталога
            (listProductCatalog), архивные туда не попадают, поэтому их индивидуальные значения сами
            перестают применяться; архива в демо-каталоге пока нет (qa/requests/payroll.md) */}
        <div data-f="F-09-032 F-09-105 F-09-035" className="flex flex-col gap-3 border-t border-border pt-4">
          <Checkbox
            checked={overridesOn}
            onCheckedChange={(on) => {
              setOverridesOn(on);
              if (!on) onChange({ ...value, overrides: [] });
            }}
            label={t('scheme.blocks.productSales.overridesToggle')}
          />
          {overridesOn && (
            <OverridesEditor overrides={value.overrides} onChange={(overrides) => onChange({ ...value, overrides })} targets={targets} />
          )}
        </div>

        {/* data-f у LoyaltyAdjustmentFields рендерится динамически из пропа dataF — scripts/fids.mjs
            ищет только литеральный текст, поэтому те же id продублированы здесь литералом */}
        <div data-f="F-09-033 F-09-021">
          <LoyaltyAdjustmentFields
            dataF="F-09-033 F-09-021"
            value={value.loyaltyAdjustment}
            onChange={(loyaltyAdjustment) => onChange({ ...value, loyaltyAdjustment })}
          />
        </div>

        <div data-f="F-09-034 F-08-125" className="flex flex-col gap-3 border-t border-border pt-4">
          <Checkbox
            checked={costOn}
            onCheckedChange={(on) =>
              onChange({ ...value, demoCostPercent: on ? value.demoCostPercent || 50 : 0, costBasis: { ...value.costBasis, enabled: on } })
            }
            label={t('scheme.blocks.productSales.costToggle')}
            description={t('scheme.blocks.productSales.costHint')}
          />
          {costOn && (
            <>
              <FormField label={t('scheme.blocks.productSales.costLabel')} error={(value.demoCostPercent ?? 0) < 0 || (value.demoCostPercent ?? 0) > 100 ? t('scheme.errors.percentRange') : undefined}>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  inputMode="decimal"
                  value={value.demoCostPercent ?? 0}
                  onChange={(e) => onChange({ ...value, demoCostPercent: Number(e.target.value) || 0 })}
                  rightSlot={<span className="text-sm text-muted">%</span>}
                  className="max-w-40"
                />
              </FormField>
              <ChoiceGroup
                columns={1}
                aria-label={t('scheme.blocks.productSales.costOrderAriaLabel')}
                options={[
                  {
                    value: 'discountFirst',
                    title: t('scheme.blocks.productSales.costOrder.discountFirst'),
                    description: t('scheme.blocks.productSales.costOrder.discountFirstHint'),
                  },
                  {
                    value: 'costFirst',
                    title: t('scheme.blocks.productSales.costOrder.costFirst'),
                    description: t('scheme.blocks.productSales.costOrder.costFirstHint'),
                  },
                ]}
                value={value.costBasis.order}
                onValueChange={(order) => onChange({ ...value, costBasis: { ...value.costBasis, order: order as ProductCostOrder } })}
              />
            </>
          )}
        </div>
      </BlockCard>
    </div>
  );
}
