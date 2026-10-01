'use client';

/** Поля карточки товара (F-08-017…025, F-00-134, F-00-140, F-00-144) — вынесены из GoodFormScreen. */
import { useState, type Dispatch, type SetStateAction } from 'react';
import { Camera } from 'lucide-react';
import { generateBarcode, type GoodInput } from '@/api/stock';
import { useSphere } from '@/demo/hooks';
import type { Id } from '@/domain/core';
import { UNIT_OPTIONS, type TaxRate, type TaxSystem } from '@/domain/stock';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { Checkbox } from '@/ui/Checkbox';
import { ColorPicker } from '@/ui/ColorPicker';
import { DatePicker } from '@/ui/DatePicker';
import { FormField } from '@/ui/FormField';
import { IconButton } from '@/ui/IconButton';
import { Input } from '@/ui/Input';
import { MoneyInput } from '@/ui/MoneyInput';
import { SectionCard } from '@/ui/SectionCard';
import { Select } from '@/ui/Select';
import { Textarea } from '@/ui/Textarea';
import { CameraScanner } from '@/areas/stock/CameraScanner';

export function GoodFormFields({
  form,
  setForm,
  categories,
  nameError,
}: {
  form: GoodInput;
  setForm: Dispatch<SetStateAction<GoodInput>>;
  categories: { id: Id; name: string }[];
  nameError?: string;
}) {
  const t = useT('stock');
  const { has } = useSphere();
  // ⭐ F-08-001: части склада показываются по сфере — у сфер без has('palette') (например, стоматология) оттенка/палитры нет
  const hasPalette = has('palette');
  const [scannerOpen, setScannerOpen] = useState(false);
  const set = <K extends keyof GoodInput>(key: K, value: GoodInput[K]) => setForm((f) => ({ ...f, [key]: value }));
  const unitOptions = UNIT_OPTIONS.map((u) => ({ value: u.id, label: u.label.ru }));

  return (
    <>
      <SectionCard title={t('goodForm.section.general')}>
        <div className="flex flex-col gap-5">
          <FormField label={t('goodForm.name')} required error={nameError}>
            <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder={t('goodForm.namePlaceholder')} autoFocus />
          </FormField>
          <FormField label={t('goodForm.receiptName')} hint={t('goodForm.receiptNameHint')} optional>
            <Input value={form.receiptName ?? ''} onChange={(e) => set('receiptName', e.target.value || undefined)} />
          </FormField>
          <FormField label={t('goodForm.category')} required>
            <Select options={categories.map((c) => ({ value: c.id, label: c.name }))} value={form.categoryId} onValueChange={(v) => set('categoryId', v)} />
          </FormField>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label={t('goodForm.brand')} optional>
              <Input value={form.brand ?? ''} onChange={(e) => set('brand', e.target.value || undefined)} />
            </FormField>
            {hasPalette && (
              <FormField label={t('goodForm.shade')} optional>
                <Input value={form.shade ?? ''} onChange={(e) => set('shade', e.target.value || undefined)} />
              </FormField>
            )}
          </div>
          {hasPalette && form.shade && (
            <FormField label={t('goodForm.shadeColor')} optional>
              <ColorPicker value={form.shadeColorIndex} onValueChange={(v) => set('shadeColorIndex', v)} />
            </FormField>
          )}
        </div>
      </SectionCard>

      <SectionCard title={t('goodForm.section.codes')}>
        <div className="flex flex-col gap-5">
          <FormField label={t('goodForm.sku')} optional>
            <Input value={form.sku ?? ''} onChange={(e) => set('sku', e.target.value || undefined)} />
          </FormField>
          <FormField label={t('goodForm.barcode')} hint={t('goodForm.barcodeHint')} optional>
            <div className="flex gap-2">
              <Input value={form.barcode ?? ''} onChange={(e) => set('barcode', e.target.value || undefined)} className="flex-1" />
              <IconButton icon={<Camera aria-hidden />} label={t('goodPicker.scan')} variant="outline" onClick={() => setScannerOpen(true)} />
              <Button type="button" variant="secondary" onClick={() => set('barcode', generateBarcode())}>
                {t('goodForm.generateBarcode')}
              </Button>
            </div>
          </FormField>
          <CameraScanner open={scannerOpen} onOpenChange={setScannerOpen} onDetected={(code) => { set('barcode', code); setScannerOpen(false); }} />
          <FormField label={t('goodForm.markingCode')} optional>
            <Input value={form.markingCode ?? ''} onChange={(e) => set('markingCode', e.target.value || undefined)} />
          </FormField>
        </div>
      </SectionCard>

      <SectionCard title={t('goodForm.section.units')} description={t('goodForm.unitsHint')}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FormField label={t('goodForm.saleUnit')}>
            <Select options={unitOptions} value={form.saleUnit} onValueChange={(v) => set('saleUnit', v)} />
          </FormField>
          <FormField label={t('goodForm.unitRatio')}>
            <Input type="number" min={0.001} step="any" value={form.unitRatio} onChange={(e) => set('unitRatio', Number(e.target.value) || 1)} />
          </FormField>
          <FormField label={t('goodForm.writeoffUnit')}>
            <Select options={unitOptions} value={form.writeoffUnit} onValueChange={(v) => set('writeoffUnit', v)} />
          </FormField>
        </div>
      </SectionCard>

      <SectionCard title={t('goodForm.section.mass')}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label={t('goodForm.massNet')} optional>
            <Input type="number" min={0} value={form.massNetG ?? ''} onChange={(e) => set('massNetG', e.target.value === '' ? undefined : Number(e.target.value))} />
          </FormField>
          <FormField label={t('goodForm.massGross')} optional>
            <Input type="number" min={0} value={form.massGrossG ?? ''} onChange={(e) => set('massGrossG', e.target.value === '' ? undefined : Number(e.target.value))} />
          </FormField>
        </div>
      </SectionCard>

      <SectionCard title={t('goodForm.section.price')}>
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label={t('goodForm.salePrice')}>
              <MoneyInput value={form.salePrice} onValueChange={(v) => set('salePrice', v ?? 0)} />
            </FormField>
            <FormField label={t('goodForm.costPrice')} hint={t('goodForm.costPriceHint')}>
              <MoneyInput value={form.costPrice} onValueChange={(v) => set('costPrice', v ?? 0)} />
            </FormField>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label={t('goodForm.taxSystem')}>
              <Select
                options={[{ value: 'default', label: t('goodForm.taxSystemDefault') }, { value: 'general', label: t('goodForm.taxSystemGeneral') }]}
                value={form.taxSystem}
                onValueChange={(v) => set('taxSystem', v as TaxSystem)}
              />
            </FormField>
            <FormField label={t('goodForm.taxRate')}>
              <Select
                options={[
                  { value: 'default', label: t('goodForm.taxRateDefault') },
                  { value: 'rate20', label: t('goodForm.taxRate20') },
                  { value: 'none', label: t('goodForm.taxRateNone') },
                ]}
                value={form.taxRate}
                onValueChange={(v) => set('taxRate', v as TaxRate)}
              />
            </FormField>
          </div>
        </div>
      </SectionCard>

      <SectionCard title={t('goodForm.section.stock')}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label={t('goodForm.criticalStock')} hint={t('goodForm.criticalStockHint')}>
            <Input type="number" min={0} value={form.criticalStock} onChange={(e) => set('criticalStock', Number(e.target.value) || 0)} />
          </FormField>
          <FormField label={t('goodForm.desiredStock')} hint={t('goodForm.desiredStockHint')}>
            <Input type="number" min={0} value={form.desiredStock} onChange={(e) => set('desiredStock', Number(e.target.value) || 0)} />
          </FormField>
        </div>
      </SectionCard>

      <SectionCard title={t('goodForm.section.expiry')} description={t('goodForm.expiryHint')}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label={t('goodForm.purchaseDate')} optional>
            <DatePicker value={form.purchaseDate ?? null} onValueChange={(v) => set('purchaseDate', v ?? undefined)} clearable />
          </FormField>
          <FormField label={t('goodForm.expiryDate')} optional>
            <DatePicker value={form.expiryDate ?? null} onValueChange={(v) => set('expiryDate', v ?? undefined)} clearable />
          </FormField>
        </div>
        <div className="mt-4">
          <FormField label={t('goodForm.shelfLifeAfterOpen')} optional>
            <Input type="number" min={0} value={form.shelfLifeAfterOpenDays ?? ''} onChange={(e) => set('shelfLifeAfterOpenDays', e.target.value === '' ? undefined : Number(e.target.value))} />
          </FormField>
        </div>
      </SectionCard>

      <SectionCard title={t('goodForm.section.clients')}>
        <div className="flex flex-col gap-4">
          <Checkbox checked={form.showToClients} onCheckedChange={(v) => set('showToClients', v)} label={t('goodForm.showToClients')} description={t('goodForm.showToClientsHint')} />
          {form.showToClients && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label={t('goodForm.clientNameRu')}>
                <Input value={form.clientName?.ru ?? form.name} onChange={(e) => set('clientName', { ru: e.target.value, en: form.clientName?.en })} />
              </FormField>
              <FormField label={t('goodForm.clientNameEn')} optional>
                <Input value={form.clientName?.en ?? ''} onChange={(e) => set('clientName', { ru: form.clientName?.ru ?? form.name, en: e.target.value || undefined })} />
              </FormField>
            </div>
          )}
        </div>
      </SectionCard>

      <SectionCard title={t('goodForm.section.comment')}>
        <Textarea value={form.comment ?? ''} onChange={(e) => set('comment', e.target.value || undefined)} rows={3} />
      </SectionCard>
    </>
  );
}
