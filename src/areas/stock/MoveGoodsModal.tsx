'use client';

/**
 * «Переместить товары» — F-08-005/F-08-048/F-08-059: со страницы «Склады» перемещает товар с одного
 * склада на другой (документ типа move). Раньше эта операция была недостижима: пункт меню «Перемещение»
 * в «Операциях с товарами» вёл на страницу «Склады», а там самой кнопки не было — теперь есть.
 */
import { useState } from 'react';
import { createMoveOperation, goodStockAt, listGoods } from '@/api/stock';
import { useApiMutation, useApiQuery } from '@/api/request';
import type { Id } from '@/domain/core';
import { type Warehouse } from '@/domain/stock';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { Modal } from '@/ui/Modal';
import { Select } from '@/ui/Select';
import { Textarea } from '@/ui/Textarea';
import { useToast } from '@/ui/Toast';
import { formatQty, useUnitShort } from '@/areas/stock/warehouse.utils';

export interface MoveGoodsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessId: Id;
  locationId: Id;
  warehouses: (Warehouse & { goodsCount: number })[];
  /** Предзаполненный склад-источник, если открыли из строки конкретного склада */
  defaultFromWarehouseId?: Id;
  onMoved?: () => void;
}

export function MoveGoodsModal({ open, onOpenChange, businessId, locationId, warehouses, defaultFromWarehouseId, onMoved }: MoveGoodsModalProps) {
  const unitShort = useUnitShort();
  const t = useT('stock');
  const toast = useToast();
  const [fromId, setFromId] = useState(defaultFromWarehouseId ?? warehouses[0]?.id ?? '');
  const [toId, setToId] = useState('');
  const [goodId, setGoodId] = useState('');
  const [qty, setQty] = useState('');
  const [comment, setComment] = useState('');
  const [touched, setTouched] = useState(false);

  const goodsQ = useApiQuery(['stock', 'goods', businessId, locationId, 'move-picker'], () => listGoods(businessId, locationId, { pageSize: 500 }), { enabled: open });
  const availableQ = useApiQuery(['stock', 'goodStockAt', businessId, goodId, fromId], () => goodStockAt(businessId, goodId, fromId), { enabled: open && Boolean(goodId) && Boolean(fromId) });
  const mutation = useApiMutation((input: { fromWarehouseId: Id; toWarehouseId: Id; goodId: Id; qty: number; comment?: string }) => createMoveOperation(businessId, locationId, input));

  const reset = () => {
    setFromId(defaultFromWarehouseId ?? warehouses[0]?.id ?? '');
    setToId('');
    setGoodId('');
    setQty('');
    setComment('');
    setTouched(false);
  };

  const good = (goodsQ.data?.items ?? []).find((g) => g.id === goodId);
  const available = availableQ.data ?? 0;
  const qtyNum = Number(qty);
  const qtyError = touched && (!qty.trim() || !(qtyNum > 0)) ? t('moveGoods.qtyRequired') : touched && qtyNum > available ? t('moveGoods.qtyExceeds', { available: formatQty(available) }) : undefined;
  const toError = touched && (!toId || toId === fromId) ? t('moveGoods.toRequired') : undefined;
  const goodError = touched && !goodId ? t('moveGoods.goodRequired') : undefined;

  const submit = async () => {
    setTouched(true);
    if (!goodId || !toId || toId === fromId || !(qtyNum > 0) || qtyNum > available) return;
    try {
      await mutation.mutate({ fromWarehouseId: fromId, toWarehouseId: toId, goodId, qty: qtyNum, comment: comment.trim() || undefined });
      toast.success(t('moveGoods.moved'));
      reset();
      onOpenChange(false);
      onMoved?.();
    } catch {
      toast.error(t('moveGoods.moveFailed'));
    }
  };

  const warehouseOptions = warehouses.map((w) => ({ value: w.id, label: w.name }));

  return (
    <Modal
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
      title={t('moveGoods.title')}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t('moveGoods.cancel')}
          </Button>
          <Button onClick={submit} loading={mutation.isPending}>
            {t('moveGoods.submit')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <FormField label={t('moveGoods.from')}>
          <Select options={warehouseOptions} value={fromId} onValueChange={setFromId} />
        </FormField>
        <FormField label={t('moveGoods.to')} error={toError}>
          <Select options={warehouseOptions.filter((o) => o.value !== fromId)} value={toId} onValueChange={setToId} placeholder={t('moveGoods.toPlaceholder')} />
        </FormField>
        <FormField label={t('moveGoods.good')} error={goodError}>
          <Select
            options={(goodsQ.data?.items ?? []).map((g) => ({ value: g.id, label: g.name }))}
            value={goodId}
            onValueChange={(v) => { setGoodId(v); setQty(''); setTouched(false); }}
            placeholder={t('moveGoods.goodPlaceholder')}
            searchable
          />
        </FormField>
        {good && (
          <p className="text-sm text-muted">{t('moveGoods.available', { qty: formatQty(available), unit: unitShort(good.saleUnit) })}</p>
        )}
        <FormField label={t('moveGoods.qty')} error={qtyError}>
          <Input type="number" min={0} value={qty} onChange={(e) => setQty(e.target.value)} disabled={!goodId} />
        </FormField>
        <FormField label={t('moveGoods.comment')}>
          <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} />
        </FormField>
      </div>
    </Modal>
  );
}
