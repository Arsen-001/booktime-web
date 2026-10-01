'use client';

/**
 * /biz/stock/operations/new/income и /new/write-off — F-08-054…058, F-08-146, F-00-135, F-00-140.
 * Общая форма документа: приход увеличивает остаток, списание уменьшает; три способа добавить товары
 * (F-08-055), быстрое списание просроченного (F-00-140), оплата поставки (F-08-057).
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Trash2 } from 'lucide-react';
import {
  createIncomeOperation,
  createWriteoffOperation,
  listExpiredGoods,
  listGoods,
  listWarehouses,
  type GoodRow,
  type OperationLineInput,
  type SalePaymentMethod,
} from '@/api/stock';
import { ApiError, useApiMutation, useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import type { Id } from '@/domain/core';
import { WRITEOFF_REASON_LABELS, type WriteoffReason } from '@/domain/stock';
import { useT } from '@/i18n/useT';
import { formatQty, parseQty, stockAtWarehouse, warehouseLabel, warehouseWithMostStock, useUnitShort } from '@/areas/stock/warehouse.utils';
import { useFormat } from '@/i18n/useFormat';
import { combine, datePart, timePart, nowDateTime } from '@/lib/date';
import { cn } from '@/lib/cn';
import { Button } from '@/ui/Button';
import { Checkbox } from '@/ui/Checkbox';
import { DatePicker } from '@/ui/DatePicker';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { MoneyInput } from '@/ui/MoneyInput';
import { PageHeader } from '@/ui/PageHeader';
import { SectionCard } from '@/ui/SectionCard';
import { Select } from '@/ui/Select';
import { Skeleton } from '@/ui/Skeleton';
import { StickyActionBar } from '@/ui/StickyActionBar';
import { Textarea } from '@/ui/Textarea';
import { TimePicker } from '@/ui/TimePicker';
import { useConfirm, useToast } from '@/ui/Toast';
import { useUnsavedGuard } from '@/ui/hooks/useUnsavedGuard';
import { GoodListPickerModal, GoodPicker } from '@/areas/stock/GoodPicker';
import { SupplierField, type SupplierValue } from '@/areas/stock/SupplierField';

interface Line {
  good: GoodRow;
  /** Текст поля «Количество» как ввели: пусто и «-3» должны показать ошибку, а не превратиться в 0 или 3 (Ск7) */
  qty: string;
  unitPrice: number;
  discountPct: number;
}

function lineSum(l: Line): number {
  const qty = parseQty(l.qty);
  if (!(qty > 0)) return 0;
  const gross = qty * l.unitPrice;
  return Math.round(gross - gross * (l.discountPct / 100));
}

export function OperationFormScreen({ mode }: { mode: 'income' | 'writeoff' }) {
  const unitShort = useUnitShort();
  const t = useT('stock');
  const toast = useToast();
  const confirm = useConfirm();
  const router = useRouter();
  const format = useFormat();
  const { ready, businessId, locationId: rawLocationId, activeLocationIds } = useCurrent();
  const locationId = rawLocationId === 'all' ? activeLocationIds[0] : rawLocationId;
  const enabled = ready && Boolean(businessId) && Boolean(locationId);

  const [now] = useState(() => nowDateTime());
  const [date, setDate] = useState(datePart(now));
  const [time, setTime] = useState(timePart(now));
  const [warehouseId, setWarehouseId] = useState('');
  // Ск8: пока склад не выбран руками, списание берёт склад, где лежит первый добавленный товар
  const [warehouseTouched, setWarehouseTouched] = useState(false);
  const [supplier, setSupplier] = useState<SupplierValue>({ name: '' });
  const [reason, setReason] = useState<WriteoffReason>('manual');
  const [paid, setPaid] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<SalePaymentMethod>('cash');
  const [comment, setComment] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [listPickerOpen, setListPickerOpen] = useState(false);
  const [touched, setTouched] = useState(false);
  const [saved, setSaved] = useState(false);

  // Ск18: ушли с заполненной формы — наш вопрос «Уйти без сохранения?»
  const dirty = !saved && (lines.length > 0 || Boolean(supplier.name) || Boolean(comment.trim()));
  const { confirmLeave } = useUnsavedGuard(dirty);

  const warehousesQ = useApiQuery(['stock', 'warehouses', businessId, locationId], () => listWarehouses(businessId!, locationId!), { enabled });
  const goodsQ = useApiQuery(['stock', 'goods', businessId, locationId, 'op-picker'], () => listGoods(businessId!, locationId!, { pageSize: 1000 }), {
    enabled,
  });
  const expiredQ = useApiQuery(['stock', 'expired', businessId, locationId], () => listExpiredGoods(businessId!, locationId!), {
    enabled: enabled && mode === 'writeoff',
  });

  const warehouses = warehousesQ.data ?? [];
  if (warehouseId === '' && warehouses.length) setWarehouseId(warehouses[0].id);

  const createIncome = useApiMutation((input: Parameters<typeof createIncomeOperation>[2]) => createIncomeOperation(businessId!, locationId!, input));
  const createWriteoff = useApiMutation((input: Parameters<typeof createWriteoffOperation>[2]) =>
    createWriteoffOperation(businessId!, locationId!, input),
  );
  const saving = createIncome.isPending || createWriteoff.isPending;

  const total = lines.reduce((s, l) => s + lineSum(l), 0);
  const excludeIds = lines.map((l) => l.good.id);
  // Свежие остатки: строка хранит товар на момент добавления, склад могли сменить — берём из каталога
  const goodsById = new Map((goodsQ.data?.items ?? []).map((g) => [g.id, g]));
  const stockOf = (good: GoodRow) => stockAtWarehouse(goodsById.get(good.id) ?? good, warehouseId);

  const pickDefaultWarehouse = (good: GoodRow) => {
    if (mode !== 'writeoff' || warehouseTouched || lines.length > 0) return;
    const best = warehouseWithMostStock(good);
    if (best && warehouses.some((w) => w.id === best)) setWarehouseId(best);
  };

  const addLine = (good: GoodRow) => {
    pickDefaultWarehouse(good);
    setLines((prev) => [...prev, { good, qty: '1', unitPrice: good.costPrice, discountPct: 0 }]);
  };
  const addLines = (goods: GoodRow[]) => {
    if (goods[0]) pickDefaultWarehouse(goods[0]);
    setLines((prev) => [...prev, ...goods.map((g) => ({ good: g, qty: '1', unitPrice: g.costPrice, discountPct: 0 }))]);
  };
  const importLines = (rows: { good: GoodRow; qty: number; price?: number; discountPct?: number }[]) => {
    setLines((prev) => [
      ...prev,
      ...rows
        .filter((r) => !prev.some((l) => l.good.id === r.good.id))
        .map((r) => ({ good: r.good, qty: String(r.qty), unitPrice: r.price ?? r.good.costPrice, discountPct: r.discountPct ?? 0 })),
    ]);
  };
  // Ск12: повторный скан того же товара — +1 к количеству строки
  const bumpLine = (good: GoodRow) =>
    setLines((prev) => prev.map((l) => (l.good.id === good.id ? { ...l, qty: String((parseQty(l.qty) > 0 ? parseQty(l.qty) : 0) + 1) } : l)));
  const removeLine = (goodId: Id) => setLines((prev) => prev.filter((l) => l.good.id !== goodId));
  const patchLine = (goodId: Id, patch: Partial<Line>) => setLines((prev) => prev.map((l) => (l.good.id === goodId ? { ...l, ...patch } : l)));

  // QA 30.09: плашка считает просрочку на ВЫБРАННОМ складе — раньше «на складе: 1» висело и там, где просрочки нет
  const expiredHereCount = (expiredQ.data ?? []).filter((g) => stockAtWarehouse(g, warehouseId) > 0).length;

  // Ск9: добавляет к уже набранным строкам (не стирает их) и берёт остаток ВЫБРАННОГО склада, а не всех
  const quickWriteoffExpired = () => {
    const expired = expiredQ.data ?? [];
    const fresh = expired
      .filter((g) => !excludeIds.includes(g.id))
      .map((g) => ({ good: g, qty: stockAtWarehouse(g, warehouseId) }))
      .filter((r) => r.qty > 0);
    if (!fresh.length) {
      toast.info(t('operationForm.expiredNoneHere'));
      return;
    }
    setReason('expired');
    setLines((prev) => [...prev, ...fresh.map((r) => ({ good: r.good, qty: String(r.qty), unitPrice: r.good.costPrice, discountPct: 0 }))]);
  };

  const linesError = touched && lines.length === 0 ? t('operationForm.linesRequired') : undefined;
  const warehouseError = touched && !warehouseId ? t('operationForm.warehouseRequired') : undefined;
  const qtyInvalid = (l: Line) => !(parseQty(l.qty) > 0);

  const cancel = async () => {
    if (!(await confirmLeave())) return;
    setSaved(true);
    router.push('/biz/stock/operations');
  };

  const save = async () => {
    setTouched(true);
    if (!lines.length || !warehouseId || lines.some(qtyInvalid)) return;
    // Ск8: списание больше остатка — не молча в минус, а с вопросом
    if (mode === 'writeoff') {
      const short = lines.filter((l) => parseQty(l.qty) > stockOf(l.good));
      if (short.length) {
        const ok = await confirm({
          title: t('operationForm.minusConfirmTitle'),
          description: t('operationForm.minusConfirmText', { goods: short.map((l) => l.good.name).join(', ') }),
          confirmLabel: t('operationForm.minusConfirmOk'),
          tone: 'danger',
        });
        if (!ok) return;
      }
    }
    const dateTime = combine(date, time);
    const inputLines: OperationLineInput[] = lines.map((l) => ({
      goodId: l.good.id,
      qtySale: parseQty(l.qty),
      unitPrice: l.unitPrice,
      discountPct: l.discountPct,
    }));
    try {
      const doc =
        mode === 'income'
          ? await createIncome.mutate({
              date: dateTime,
              warehouseId,
              counterpartyName: supplier.name || undefined,
              counterpartyId: supplier.counterpartyId,
              paid,
              paymentMethod: paid ? paymentMethod : undefined,
              comment: comment || undefined,
              lines: inputLines,
            })
          : await createWriteoff.mutate({ date: dateTime, warehouseId, reason, comment: comment || undefined, lines: inputLines });
      setSaved(true);
      toast.success(mode === 'income' ? t('operationForm.incomeSaved') : t('operationForm.writeoffSaved'));
      router.push(`/biz/stock/operations/${doc.id}`);
    } catch (e) {
      // F-08-099: «Запретить операции при нехватке» включена — понятная причина вместо общей ошибки
      if (e instanceof ApiError && e.code === 'insufficient_stock') {
        try {
          const info = JSON.parse(e.message) as { goodName: string; warehouseName: string; available: number };
          toast.error(
            t('operationForm.saveFailedInsufficient', {
              good: info.goodName,
              warehouse: info.warehouseName,
              available: formatQty(info.available),
            }),
          );
          return;
        } catch {
          // формат сообщения неожиданный — общий текст ниже
        }
      }
      toast.error(t('operationForm.saveFailed'));
    }
  };

  if (warehousesQ.isError || goodsQ.isError)
    return (
      <ErrorState
        onRetry={() => {
          warehousesQ.refetch();
          goodsQ.refetch();
        }}
      />
    );
  if (!enabled || warehousesQ.isLoading || goodsQ.isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
        <Skeleton variant="rect" className="h-10" />
        <Skeleton lines={8} />
      </div>
    );
  }
  if (warehouses.length === 0) {
    return <EmptyState title={t('operationForm.noWarehousesTitle')} description={t('operationForm.noWarehousesText')} />;
  }

  const goods = goodsQ.data?.items ?? [];
  const fId = mode === 'income' ? 'F-08-054 F-08-055 F-08-056 F-08-057 F-08-061 F-08-146 F-00-135' : 'F-08-055 F-08-058 F-08-146 F-00-135 F-00-140';

  return (
    <div data-f={fId} className="mx-auto flex w-full max-w-[760px] flex-col gap-6 pb-28">
      {/* Метка для статического сканера fids.mjs — он не читает data-f={fId} выше, только литералы */}
      <div
        data-f={'F-08-054 F-08-055 F-08-056 F-08-057 F-08-058 F-08-061 F-08-099 F-08-146 F-00-135 F-00-140 F-07-053'}
        className="hidden"
        aria-hidden
      />
      <PageHeader
        title={mode === 'income' ? t('operationForm.incomeTitle') : t('operationForm.writeoffTitle')}
        back={{ href: '/biz/stock/operations' }}
      />

      <SectionCard title={t('operationForm.section.general')}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label={t('operationForm.date')}>
            <DatePicker value={date} onValueChange={(v) => v && setDate(v)} />
          </FormField>
          <FormField label={t('operationForm.time')}>
            <TimePicker value={time} onValueChange={(v) => v && setTime(v)} />
          </FormField>
          <FormField label={t('operationForm.warehouse')} error={warehouseError}>
            <Select
              options={warehouses.map((w) => ({ value: w.id, label: warehouseLabel(w, t) }))}
              value={warehouseId}
              onValueChange={(v) => {
                setWarehouseTouched(true);
                setWarehouseId(v);
              }}
            />
          </FormField>
          {mode === 'income' ? (
            <FormField label={t('operationForm.supplier')} optional hint={t('operationForm.supplierHint')}>
              {businessId ? <SupplierField businessId={businessId} value={supplier} onChange={setSupplier} /> : <Input disabled />}
            </FormField>
          ) : (
            <FormField label={t('operationForm.reason')}>
              <Select
                options={Object.entries(WRITEOFF_REASON_LABELS).map(([v, l]) => ({ value: v, label: l.ru }))}
                value={reason}
                onValueChange={(v) => setReason(v as WriteoffReason)}
              />
            </FormField>
          )}
        </div>
      </SectionCard>

      {mode === 'writeoff' && expiredHereCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-fg">
            <AlertTriangle className="size-4 shrink-0 text-warning" aria-hidden />
            {t('operationForm.expiredBanner', { count: expiredHereCount })}
          </div>
          <Button variant="secondary" size="sm" onClick={quickWriteoffExpired}>
            {t('operationForm.writeoffExpired')}
          </Button>
        </div>
      )}

      <SectionCard title={t('operationForm.section.lines')}>
        <div className="flex flex-col gap-4">
          {businessId && locationId && (
            <GoodPicker
              businessId={businessId}
              locationId={locationId}
              excludeIds={excludeIds}
              onAdd={addLine}
              onImportRows={importLines}
              onRepeat={bumpLine}
            />
          )}
          <Button type="button" variant="secondary" size="sm" onClick={() => setListPickerOpen(true)} className="self-start">
            {t('operationForm.addFromList')}
          </Button>
          {linesError && <p className="text-sm text-danger">{linesError}</p>}

          {lines.length === 0 ? (
            <EmptyState compact title={t('operationForm.noLines')} />
          ) : (
            <ul className="flex flex-col gap-2">
              {lines.map((l, i) => {
                const unit = unitShort(l.good.saleUnit);
                const onHand = stockOf(l.good);
                const qty = parseQty(l.qty);
                const overdraw = mode === 'writeoff' && qty > 0 && qty > onHand;
                return (
                  <li key={l.good.id} className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-fg">
                          {i + 1}. {l.good.name}
                        </p>
                        <p className={cn('text-xs', overdraw ? 'font-medium text-danger' : onHand < 0 ? 'text-danger' : 'text-muted')}>
                          {overdraw
                            ? t('operationForm.overdraw', { qty: formatQty(onHand), unit })
                            : t('operationForm.onHand', { qty: formatQty(onHand), unit })}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeLine(l.good.id)}
                        className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-danger hover:bg-danger/10"
                        aria-label={t('operationForm.removeLine')}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <FormField
                        label={`${t('operationForm.qty')}, ${unit}`}
                        error={touched && qtyInvalid(l) ? t('operationForm.qtyPositive') : undefined}
                      >
                        <Input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          step="any"
                          value={l.qty}
                          onChange={(e) => patchLine(l.good.id, { qty: e.target.value })}
                        />
                      </FormField>
                      <FormField label={mode === 'income' ? t('operationForm.unitPrice') : t('operationForm.unitCost')}>
                        <MoneyInput value={l.unitPrice} onValueChange={(v) => patchLine(l.good.id, { unitPrice: v ?? 0 })} />
                      </FormField>
                      {mode === 'income' && (
                        <FormField label={t('operationForm.discount')}>
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            value={l.discountPct}
                            onChange={(e) => patchLine(l.good.id, { discountPct: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })}
                          />
                        </FormField>
                      )}
                      <FormField label={t('operationForm.sum')}>
                        <p className="flex min-h-10 items-center text-sm font-semibold text-fg">{format.money(lineSum(l))}</p>
                      </FormField>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {lines.length > 0 && (
            <div className="flex items-center justify-between border-t border-border pt-3 text-base font-semibold text-fg">
              <span>{t('operationForm.total')}</span>
              <span>{format.money(total)}</span>
            </div>
          )}
        </div>
      </SectionCard>

      {mode === 'income' && (
        <SectionCard title={t('operationForm.section.payment')}>
          <div className="flex flex-col gap-3">
            <label className="flex min-h-11 items-center gap-3">
              <Checkbox checked={paid} onCheckedChange={setPaid} />
              <span className="text-sm text-fg">{t('operationForm.paid')}</span>
            </label>
            {paid && (
              <FormField label={t('operationForm.paymentMethod')} className="sm:max-w-xs">
                <Select
                  options={[
                    { value: 'cash', label: t('sale.paymentCash') },
                    { value: 'card', label: t('sale.paymentCard') },
                  ]}
                  value={paymentMethod}
                  onValueChange={(v) => setPaymentMethod(v as SalePaymentMethod)}
                />
              </FormField>
            )}
            <p className="text-xs text-muted">{t('operationForm.paidHint')}</p>
          </div>
        </SectionCard>
      )}

      <SectionCard title={t('operationForm.section.comment')}>
        <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} placeholder={t('operationForm.commentPlaceholder')} />
      </SectionCard>

      <StickyActionBar>
        <Button variant="secondary" onClick={cancel} disabled={saving}>
          {t('operationForm.cancel')}
        </Button>
        <Button onClick={save} loading={saving}>
          {t('operationForm.save')}
        </Button>
      </StickyActionBar>

      {businessId && (
        <GoodListPickerModal
          open={listPickerOpen}
          onOpenChange={setListPickerOpen}
          goods={goods}
          categories={Array.from(new Map(goods.map((g) => [g.categoryId, g.categoryName])).entries()).map(([id, name]) => ({ id, name }))}
          excludeIds={excludeIds}
          onAdd={addLines}
        />
      )}
    </div>
  );
}
