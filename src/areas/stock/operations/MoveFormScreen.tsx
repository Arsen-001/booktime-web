'use client';

/**
 * /biz/stock/operations/new/move — F-08-059 перемещение между складами (в т.ч. «выдача мастеру» —
 * перемещение на склад мастера, F-00-135), несколько товаров одной операцией.
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { createMoveOperationMulti, listGoods, listWarehouses, type GoodRow } from '@/api/stock';
import { ApiError, useApiMutation, useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import type { Id } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { formatQty, parseQty, stockAtWarehouse, warehouseLabel, warehouseWithMostStock, useUnitShort } from '@/areas/stock/warehouse.utils';
import { cn } from '@/lib/cn';
import { combine, datePart, nowDateTime, timePart } from '@/lib/date';
import { Button } from '@/ui/Button';
import { DatePicker } from '@/ui/DatePicker';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { PageHeader } from '@/ui/PageHeader';
import { SectionCard } from '@/ui/SectionCard';
import { Select } from '@/ui/Select';
import { Skeleton } from '@/ui/Skeleton';
import { StickyActionBar } from '@/ui/StickyActionBar';
import { Textarea } from '@/ui/Textarea';
import { TimePicker } from '@/ui/TimePicker';
import { useToast } from '@/ui/Toast';
import { useUnsavedGuard } from '@/ui/hooks/useUnsavedGuard';
import { GoodPicker } from '@/areas/stock/GoodPicker';

interface MoveLine {
  good: GoodRow;
  /** Текст поля как ввели (Ск7: пусто и минус — ошибка, а не 0) */
  qty: string;
}

export function MoveFormScreen() {
  const unitShort = useUnitShort();
  const t = useT('stock');
  const toast = useToast();
  const router = useRouter();
  const { ready, businessId, locationId: rawLocationId, activeLocationIds } = useCurrent();
  const locationId = rawLocationId === 'all' ? activeLocationIds[0] : rawLocationId;
  const enabled = ready && Boolean(businessId) && Boolean(locationId);

  const [now] = useState(() => nowDateTime());
  const [date, setDate] = useState(datePart(now));
  const [time, setTime] = useState(timePart(now));
  const [fromId, setFromId] = useState('');
  const [fromTouched, setFromTouched] = useState(false);
  const [toId, setToId] = useState('');
  const [comment, setComment] = useState('');
  const [lines, setLines] = useState<MoveLine[]>([]);
  const [touched, setTouched] = useState(false);
  const [saved, setSaved] = useState(false);

  const dirty = !saved && (lines.length > 0 || Boolean(comment.trim()));
  const { confirmLeave } = useUnsavedGuard(dirty);

  const warehousesQ = useApiQuery(['stock', 'warehouses', businessId, locationId], () => listWarehouses(businessId!, locationId!), { enabled });
  const goodsQ = useApiQuery(['stock', 'goods', businessId, locationId, 'move-picker'], () => listGoods(businessId!, locationId!, { pageSize: 1000 }), { enabled });
  const warehouses = warehousesQ.data ?? [];
  if (fromId === '' && warehouses.length) setFromId(warehouses[0].id);

  const mutation = useApiMutation((input: Parameters<typeof createMoveOperationMulti>[2]) => createMoveOperationMulti(businessId!, locationId!, input));

  // Остаток — из свежего каталога (там остатки по складам), а не из строки на момент добавления
  const goodsById = new Map((goodsQ.data?.items ?? []).map((g) => [g.id, g]));
  const availableOf = (good: GoodRow) => stockAtWarehouse(goodsById.get(good.id) ?? good, fromId);

  const excludeIds = lines.map((l) => l.good.id);
  const addLine = (good: GoodRow) => {
    // Первый товар, склад ещё не выбирали руками — источником становится склад, где товар реально лежит (F-08-059)
    if (!fromTouched && lines.length === 0) {
      const best = warehouseWithMostStock(good);
      if (best && warehouses.some((w) => w.id === best)) {
        setFromId(best);
        if (toId === best) setToId('');
      }
    }
    setLines((prev) => [...prev, { good, qty: '1' }]);
  };
  const bumpLine = (good: GoodRow) =>
    setLines((prev) => prev.map((l) => (l.good.id === good.id ? { ...l, qty: String((parseQty(l.qty) > 0 ? parseQty(l.qty) : 0) + 1) } : l)));
  const removeLine = (id: Id) => setLines((prev) => prev.filter((l) => l.good.id !== id));
  const patchQty = (id: Id, qty: string) => setLines((prev) => prev.map((l) => (l.good.id === id ? { ...l, qty } : l)));

  // Ск10: смена склада-источника строки НЕ стирает — остаток каждой строки просто пересчитывается под новый склад
  const changeFrom = (v: string) => {
    setFromId(v);
    setFromTouched(true);
    if (toId === v) setToId('');
  };

  const toError = touched && (!toId || toId === fromId) ? t('moveForm.toRequired') : undefined;
  const linesError = touched && lines.length === 0 ? t('moveForm.linesRequired') : undefined;
  const qtyInvalid = (l: MoveLine) => !(parseQty(l.qty) > 0);

  const cancel = async () => {
    if (!(await confirmLeave())) return;
    setSaved(true);
    router.push('/biz/stock/operations');
  };

  const save = async () => {
    setTouched(true);
    if (!fromId || !toId || toId === fromId || !lines.length) return;
    if (lines.some(qtyInvalid)) return;
    if (lines.some((l) => parseQty(l.qty) > availableOf(l.good))) {
      toast.error(t('moveForm.qtyInvalid'));
      return;
    }
    try {
      const doc = await mutation.mutate({
        date: combine(date, time),
        fromWarehouseId: fromId,
        toWarehouseId: toId,
        lines: lines.map((l) => ({ goodId: l.good.id, qty: parseQty(l.qty) })),
        comment: comment || undefined,
      });
      setSaved(true);
      toast.success(t('moveForm.saved'));
      router.push(`/biz/stock/operations/${doc.id}`);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'insufficient_stock') {
        try {
          const info = JSON.parse(e.message) as { goodName: string; warehouseName: string };
          toast.error(t('moveForm.saveFailedInsufficient', { good: info.goodName, warehouse: info.warehouseName }));
          return;
        } catch {
          // сообщение не в ожидаемом формате — падаем на общий текст ниже
        }
      }
      toast.error(t('moveForm.saveFailed'));
    }
  };

  if (warehousesQ.isError || goodsQ.isError) return <ErrorState onRetry={() => { warehousesQ.refetch(); goodsQ.refetch(); }} />;
  if (!enabled || warehousesQ.isLoading || goodsQ.isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
        <Skeleton variant="rect" className="h-10" />
        <Skeleton lines={8} />
      </div>
    );
  }
  if (warehouses.length < 2) {
    return <EmptyState title={t('moveForm.needTwoTitle')} description={t('moveForm.needTwoText')} />;
  }

  return (
    <div data-f="F-08-059 F-08-099 F-08-146 F-00-135" className="mx-auto flex w-full max-w-[760px] flex-col gap-6 pb-28">
      <PageHeader title={t('moveForm.title')} back={{ href: '/biz/stock/warehouses' }} />

      <SectionCard title={t('operationForm.section.general')}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label={t('operationForm.date')}>
            <DatePicker value={date} onValueChange={(v) => v && setDate(v)} />
          </FormField>
          <FormField label={t('operationForm.time')}>
            <TimePicker value={time} onValueChange={(v) => v && setTime(v)} />
          </FormField>
          <FormField label={t('moveGoods.from')}>
            <Select options={warehouses.map((w) => ({ value: w.id, label: warehouseLabel(w, t) }))} value={fromId} onValueChange={changeFrom} />
          </FormField>
          <FormField label={t('moveGoods.to')} error={toError}>
            <Select options={warehouses.filter((w) => w.id !== fromId).map((w) => ({ value: w.id, label: warehouseLabel(w, t) }))} value={toId} onValueChange={setToId} placeholder={t('moveGoods.toPlaceholder')} />
          </FormField>
        </div>
      </SectionCard>

      <SectionCard title={t('operationForm.section.lines')}>
        <div className="flex flex-col gap-4">
          {businessId && locationId && <GoodPicker businessId={businessId} locationId={locationId} excludeIds={excludeIds} onAdd={addLine} onRepeat={bumpLine} />}
          {linesError && <p className="text-sm text-danger">{linesError}</p>}
          {lines.length === 0 ? (
            <EmptyState compact title={t('operationForm.noLines')} />
          ) : (
            <ul className="flex flex-col gap-2">
              {lines.map((l) => {
                // Остаток именно на выбранном складе-источнике, не суммарно по всем складам (F-08-059)
                const available = availableOf(l.good);
                const qty = parseQty(l.qty);
                const exceeds = qty > available;
                const invalid = touched && qtyInvalid(l);
                return (
                  <li key={l.good.id} className="flex flex-col gap-1 rounded-xl border border-border bg-surface p-3">
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-fg">{l.good.name}</p>
                        <p className={cn('text-xs', exceeds ? 'text-danger' : 'text-muted')}>
                          {t('moveGoods.available', { qty: formatQty(available), unit: unitShort(l.good.saleUnit) })}
                        </p>
                      </div>
                      <Input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="any"
                        invalid={exceeds || invalid}
                        value={l.qty}
                        onChange={(e) => patchQty(l.good.id, e.target.value)}
                        className="w-24"
                        aria-label={t('operationForm.qty')}
                      />
                      <button type="button" onClick={() => removeLine(l.good.id)} className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-danger hover:bg-danger/10" aria-label={t('operationForm.removeLine')}>
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    </div>
                    {invalid && <p className="text-xs text-danger">{t('operationForm.qtyPositive')}</p>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </SectionCard>

      <SectionCard title={t('operationForm.section.comment')}>
        <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} />
      </SectionCard>

      <StickyActionBar>
        <Button variant="secondary" onClick={cancel} disabled={mutation.isPending}>
          {t('operationForm.cancel')}
        </Button>
        <Button onClick={save} loading={mutation.isPending}>
          {t('moveForm.submit')}
        </Button>
      </StickyActionBar>
    </div>
  );
}
