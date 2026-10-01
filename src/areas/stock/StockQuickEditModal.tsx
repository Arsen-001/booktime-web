'use client';

/**
 * «Быстрое управление» над отмеченными товарами (F-08-015): меняет цену продажи и/или критичный/желаемый
 * остаток у всех выбранных сразу — поле оставили пустым, значение у товара не меняется.
 */
import { useState } from 'react';
import { quickUpdateGoods } from '@/api/stock';
import { useApiMutation } from '@/api/request';
import type { Id } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { Modal } from '@/ui/Modal';
import { useToast } from '@/ui/Toast';

export interface StockQuickEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessId: Id;
  goodIds: Id[];
  onApplied: () => void;
}

export function StockQuickEditModal({ open, onOpenChange, businessId, goodIds, onApplied }: StockQuickEditModalProps) {
  const t = useT('stock');
  const toast = useToast();
  const [salePrice, setSalePrice] = useState('');
  const [criticalStock, setCriticalStock] = useState('');
  const [desiredStock, setDesiredStock] = useState('');

  const mutation = useApiMutation((patch: { salePrice?: number; criticalStock?: number; desiredStock?: number }) => quickUpdateGoods(businessId, goodIds, patch));

  const reset = () => {
    setSalePrice('');
    setCriticalStock('');
    setDesiredStock('');
  };

  const apply = async () => {
    const patch: { salePrice?: number; criticalStock?: number; desiredStock?: number } = {};
    if (salePrice.trim()) patch.salePrice = Number(salePrice);
    if (criticalStock.trim()) patch.criticalStock = Number(criticalStock);
    if (desiredStock.trim()) patch.desiredStock = Number(desiredStock);
    if (Object.keys(patch).length === 0) {
      onOpenChange(false);
      return;
    }
    try {
      await mutation.mutate(patch);
      toast.success(t('catalog.bulk.quickEditApplied', { count: goodIds.length }));
      reset();
      onApplied();
    } catch {
      toast.error(t('catalog.bulk.quickEditFailed'));
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
      title={t('catalog.bulk.quickEditTitle', { count: goodIds.length })}
      description={t('catalog.bulk.quickEditHint')}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t('catalog.bulk.cancel')}
          </Button>
          <Button onClick={apply} loading={mutation.isPending}>
            {t('catalog.bulk.apply')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <FormField label={t('goodForm.salePrice')}>
          <Input type="number" min={0} value={salePrice} onChange={(e) => setSalePrice(e.target.value)} placeholder={t('catalog.bulk.keepUnchanged')} />
        </FormField>
        <FormField label={t('goodForm.criticalStock')}>
          <Input type="number" min={0} value={criticalStock} onChange={(e) => setCriticalStock(e.target.value)} placeholder={t('catalog.bulk.keepUnchanged')} />
        </FormField>
        <FormField label={t('goodForm.desiredStock')}>
          <Input type="number" min={0} value={desiredStock} onChange={(e) => setDesiredStock(e.target.value)} placeholder={t('catalog.bulk.keepUnchanged')} />
        </FormField>
      </div>
    </Modal>
  );
}
