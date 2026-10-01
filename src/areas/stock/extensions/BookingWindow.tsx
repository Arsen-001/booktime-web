'use client';

/**
 * Вклад раздела «stock» в окно записи (хост «bookingWindow»): вкладка «Списание расходников»
 * (F-08-043…045) — только в режиме edit (сохранённый визит), по техкартам мастеров услуг визита,
 * несколько одинаковых услуг — отдельными строками (F-08-044); можно докинуть расходник вручную.
 * Файл принадлежит разделу «stock». Посмотреть вклад без хозяина хоста: /dev/ext/bookingWindow/stock
 *
 * Ск13: всё — в единицах СПИСАНИЯ (мл, г): норма техкарты и ручная добавка («10 мл», а не «0.1» с подписью
 * «мл» и не «0.30000000000000004»). Ручному расходнику вводится количество; «Добавлено вручную» — это
 * документ минус норма, и убрать добавку — значит вернуть строку к норме, а не стереть и норму.
 */
import { useState } from 'react';
import { Droplet, Trash2 } from 'lucide-react';
import {
  addBookingConsumableLine,
  getBookingConsumables,
  getBookingConsumablesByService,
  setBookingConsumableQty,
  type GoodRow,
} from '@/api/stock';
import { ApiError, useApiMutation, useApiQuery } from '@/api/request';
import type { BookingWindowExtProps } from '@/extensions/types';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { useToast } from '@/ui/Toast';
import { GoodPicker } from '@/areas/stock/GoodPicker';
import { useStockPermissions } from '@/areas/stock/useStockPermissions';
import { formatQty, parseQty, useUnitShort } from '@/areas/stock/warehouse.utils';

const round = (n: number) => Math.round(n * 1e6) / 1e6;

export default function StockBookingWindow({ mode, bookingId, businessId, locationId }: BookingWindowExtProps) {
  const unitShort = useUnitShort();
  const t = useT('stock');
  // F-08-117: без права «Редактирование расходников» мастер видит расходники, но не правит их
  const perm = useStockPermissions();
  const toast = useToast();
  const [pending, setPending] = useState<GoodRow | null>(null);
  const [pendingQty, setPendingQty] = useState('');
  const [qtyTouched, setQtyTouched] = useState(false);

  const byServiceQ = useApiQuery(
    ['stock', 'bookingConsumablesByService', businessId, bookingId],
    () => getBookingConsumablesByService(businessId, bookingId!),
    { enabled: mode === 'edit' && Boolean(bookingId) },
  );
  const docQ = useApiQuery(['stock', 'bookingConsumables', businessId, bookingId], () => getBookingConsumables(businessId, bookingId!), {
    enabled: mode === 'edit' && Boolean(bookingId),
  });

  const addLineMutation = useApiMutation((input: { goodId: string; qty: number }) =>
    addBookingConsumableLine(businessId, locationId, bookingId!, input.goodId, input.qty),
  );
  const setQtyMutation = useApiMutation((input: { goodId: string; qty: number }) => setBookingConsumableQty(businessId, bookingId!, input.goodId, input.qty));

  if (mode !== 'edit' || !bookingId) {
    return (
      <div data-f="F-08-043">
        <EmptyState variant="section" title={t('bookingWindowExt.saveFirst')} />
      </div>
    );
  }
  if (byServiceQ.isLoading || docQ.isLoading) {
    // Скелетон = тот же блок: подсказка и (как чаще всего у визита без техкарт) «Расходников нет» — ничего не прыгает
    return (
      <div aria-hidden className="flex flex-col gap-4">
        <p className="text-xs text-muted">{t('bookingWindowExt.hint')}</p>
        <EmptyState compact icon={<Droplet aria-hidden />} title={t('bookingWindowExt.emptyTitle')} description={t('bookingWindowExt.emptyText')} />
      </div>
    );
  }

  const services = byServiceQ.data ?? [];
  const docLines = docQ.data?.lines ?? [];
  const arrived = docQ.data?.arrived ?? false;
  // Норма по товару (сумма по всем услугам визита), в единицах списания
  const normByGood = new Map<string, number>();
  services.forEach((s) => s.goods.forEach((g) => normByGood.set(g.goodId, (normByGood.get(g.goodId) ?? 0) + g.qtyWriteoff)));
  const manual = docLines
    .map((l) => ({ ...l, extra: round(l.qtyWriteoff - (normByGood.get(l.goodId) ?? 0)) }))
    .filter((l) => l.extra > 0);

  const pickGood = (good: GoodRow) => {
    setPending(good);
    setPendingQty('');
    setQtyTouched(false);
  };

  const addManual = async () => {
    if (!pending) return;
    setQtyTouched(true);
    const qty = parseQty(pendingQty);
    if (!(qty > 0)) return;
    try {
      await addLineMutation.mutate({ goodId: pending.id, qty });
      toast.success(t('bookingWindowExt.added'));
      setPending(null);
      setPendingQty('');
    } catch (e) {
      toast.error(e instanceof ApiError && e.code === 'not_arrived' ? t('bookingWindowExt.notArrived') : t('operationDoc.actionFailed'));
    }
  };
  const removeManual = async (goodId: string) => {
    try {
      await setQtyMutation.mutate({ goodId, qty: normByGood.get(goodId) ?? 0 });
    } catch {
      toast.error(t('operationDoc.actionFailed'));
    }
  };

  const hasAnything = services.some((s) => s.goods.length > 0) || manual.length > 0;
  const qtyText = (qty: number, unit: string) => `${formatQty(round(qty))} ${unit}`;

  return (
    <div data-f="F-08-041 F-08-042 F-08-043 F-08-044 F-08-045 F-08-117 F-08-136 F-00-136 F-14-091" className="flex flex-col gap-4">
      <p className="text-xs text-muted">{t('bookingWindowExt.hint')}</p>

      {!hasAnything ? (
        <EmptyState compact icon={<Droplet aria-hidden />} title={t('bookingWindowExt.emptyTitle')} description={t('bookingWindowExt.emptyText')} />
      ) : (
        <div className="flex flex-col gap-3">
          {services
            .filter((s) => s.goods.length > 0)
            .map((s) => (
              <div key={`${s.serviceId}-${s.lineIndex}`} className="rounded-xl border border-border bg-surface p-3">
                <p className="mb-2 text-sm font-medium text-fg">{s.serviceName || t('bookingWindowExt.unknownService')}</p>
                <ul className="flex flex-col gap-1">
                  {s.goods.map((g) => (
                    <li key={g.goodId} className="flex items-center justify-between text-sm text-muted">
                      <span>{g.goodName}</span>
                      <span className="tabular-nums">{qtyText(g.qtyWriteoff, g.unitShort)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          {manual.length > 0 && (
            <div className="rounded-xl border border-border bg-surface p-3">
              <p className="mb-2 text-sm font-medium text-fg">{t('bookingWindowExt.manualTitle')}</p>
              <ul className="flex flex-col gap-1">
                {manual.map((l) => (
                  <li key={l.goodId} className="flex items-center justify-between gap-2 text-sm text-muted">
                    <span>{l.goodName}</span>
                    <div className="flex items-center gap-2">
                      <span className="tabular-nums">{qtyText(l.extra, l.unitShort)}</span>
                      {perm.bookingWindowEdit && (
                        <button
                          type="button"
                          onClick={() => removeManual(l.goodId)}
                          className="flex min-h-9 min-w-9 items-center justify-center rounded-lg text-danger hover:bg-danger/10"
                          aria-label={t('operationForm.removeLine')}
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {perm.bookingWindowEdit &&
        (arrived ? (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">{t('bookingWindowExt.addManual')}</p>
            {pending ? (
              <div className="flex flex-wrap items-end gap-2 rounded-xl border border-border bg-surface p-3">
                <p className="w-full text-sm font-medium text-fg">{pending.name}</p>
                <FormField
                  label={`${t('operationForm.qty')}, ${unitShort(pending.writeoffUnit)}`}
                  error={qtyTouched && !(parseQty(pendingQty) > 0) ? t('operationForm.qtyPositive') : undefined}
                  className="w-40"
                >
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    autoFocus
                    value={pendingQty}
                    onChange={(e) => setPendingQty(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void addManual();
                      }
                    }}
                  />
                </FormField>
                <Button onClick={addManual} loading={addLineMutation.isPending}>
                  {t('bookingWindowExt.addButton')}
                </Button>
                <Button variant="ghost" onClick={() => setPending(null)} disabled={addLineMutation.isPending}>
                  {t('operationForm.cancel')}
                </Button>
              </div>
            ) : (
              <GoodPicker businessId={businessId} locationId={locationId} excludeIds={[]} onAdd={pickGood} />
            )}
          </div>
        ) : (
          <p className="text-xs text-muted">{t('bookingWindowExt.notArrived')}</p>
        ))}
    </div>
  );
}
