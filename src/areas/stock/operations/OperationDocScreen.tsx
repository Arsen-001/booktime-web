'use client';

/**
 * /biz/stock/operations/[docId] — F-08-049…052, F-08-060, F-08-146. Документ операции: просмотр, правка
 * (кроме перемещения — только отмена), удаление строки/документа, вкладка «История изменений».
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ClipboardX, Printer, Ticket, Trash2, Undo2 } from 'lucide-react';
import {
  cancelMoveOperation,
  cancelSaleOperation,
  deleteOperationDoc,
  deleteOperationLine,
  getOperationDoc,
  type OperationDocDetail,
  listOperationHistory,
  listWarehouses,
  updateOperationDoc,
  type SalePaymentMethod,
} from '@/api/stock';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import type { Id } from '@/domain/core';
import { OPERATION_TYPE_LABELS, WRITEOFF_REASON_LABELS, type WriteoffReason } from '@/domain/stock';
import { useT } from '@/i18n/useT';
import { parseQty, warehouseLabel, useUnitShort } from '@/areas/stock/warehouse.utils';
import { SupplierField, type SupplierValue } from '@/areas/stock/SupplierField';
import { useUnsavedGuard } from '@/ui/hooks/useUnsavedGuard';
import { useFormat } from '@/i18n/useFormat';
import { combine, datePart, timePart } from '@/lib/date';
import { Badge } from '@/ui/Badge';
import { Button, LinkButton } from '@/ui/Button';
import { Checkbox } from '@/ui/Checkbox';
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import { DatePicker } from '@/ui/DatePicker';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { MoneyInput } from '@/ui/MoneyInput';
import { PageHeader } from '@/ui/PageHeader';
import { usePagedList } from '@/ui/Pagination';
import { SectionCard } from '@/ui/SectionCard';
import { Select } from '@/ui/Select';
import { Skeleton } from '@/ui/Skeleton';
import { StickyActionBar } from '@/ui/StickyActionBar';
import { Tabs } from '@/ui/Tabs';
import { Textarea } from '@/ui/Textarea';
import { TimePicker } from '@/ui/TimePicker';
import { useToast } from '@/ui/Toast';

const EDITABLE_TYPES = new Set(['income', 'writeoffProduct', 'writeoffService', 'sale']);

export function OperationDocScreen({ docId }: { docId: Id }) {
  const unitShort = useUnitShort();
  const t = useT('stock');
  const toast = useToast();
  const router = useRouter();
  const format = useFormat();
  const { ready, businessId, locationId: rawLocationId, activeLocationIds } = useCurrent();
  const locationId = rawLocationId === 'all' ? activeLocationIds[0] : rawLocationId;
  const [tab, setTab] = useState<'lines' | 'history'>('lines');
  const [deleteDocOpen, setDeleteDocOpen] = useState(false);
  const [cancelMoveOpen, setCancelMoveOpen] = useState(false);
  const [cancelSaleOpen, setCancelSaleOpen] = useState(false);
  const [deleted, setDeleted] = useState(false);
  // Последний показанный документ: после удаления страница держит его до ухода, а не мигает «не найден»
  const [lastDoc, setLastDoc] = useState<OperationDocDetail | undefined>(undefined);

  const docQ = useApiQuery(['stock', 'operationDoc', businessId, docId], () => getOperationDoc(businessId!, docId), { enabled: ready && Boolean(businessId) && !deleted });
  const warehousesQ = useApiQuery(['stock', 'warehouses', businessId, locationId], () => listWarehouses(businessId!, locationId!), { enabled: ready && Boolean(businessId) && Boolean(locationId) });
  const historyQ = useApiQuery(['stock', 'operationHistory', businessId, docId], () => listOperationHistory(businessId!, docId), { enabled: tab === 'history' && Boolean(businessId) });

  const updateMutation = useApiMutation((patch: Parameters<typeof updateOperationDoc>[2]) => updateOperationDoc(businessId!, docId, patch));
  const deleteLineMutation = useApiMutation((goodId: Id) => deleteOperationLine(businessId!, docId, goodId));
  const cancelMoveMutation = useApiMutation(() => cancelMoveOperation(businessId!, docId));
  const cancelSaleMutation = useApiMutation(() => cancelSaleOperation(businessId!, docId));

  const [editedLines, setEditedLines] = useState<Record<Id, { qty: string; unitPrice: number; discountPct: number }> | null>(null);
  const [warehouseId, setWarehouseId] = useState<Id | null>(null);
  const [dateVal, setDateVal] = useState<string | null>(null);
  const [timeVal, setTimeVal] = useState<string | null>(null);
  const [supplier, setSupplier] = useState<SupplierValue | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<SalePaymentMethod | null>(null);
  const [touched, setTouched] = useState(false);
  const [paid, setPaid] = useState<boolean | null>(null);
  const [reason, setReason] = useState<WriteoffReason | null>(null);
  const [comment, setComment] = useState<string | null>(null);

  // Ск18: правки документа не теряются молча при уходе со страницы
  const dirty =
    editedLines !== null || warehouseId !== null || dateVal !== null || timeVal !== null || supplier !== null || paid !== null || paymentMethod !== null || reason !== null || comment !== null;
  const { confirmLeave } = useUnsavedGuard(dirty && !deleted);
  const resetEdits = () => {
    setEditedLines(null);
    setWarehouseId(null);
    setDateVal(null);
    setTimeVal(null);
    setSupplier(null);
    setPaid(null);
    setPaymentMethod(null);
    setReason(null);
    setComment(null);
    setTouched(false);
  };

  // Постранично, как во всех списках (DESIGN.md → Long lists)
  const { pageItems: historyPage, pager: historyPager } = usePagedList(historyQ.data ?? []);

  if (docQ.isError) return <ErrorState onRetry={docQ.refetch} />;
  if (!ready || (docQ.isLoading && !deleted)) {
    return (
      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
        <Skeleton variant="rect" className="h-10" />
        <Skeleton lines={8} />
      </div>
    );
  }
  const doc = deleted ? (docQ.data ?? lastDoc) : docQ.data;
  if (!doc) {
    return <EmptyState icon={<ClipboardX aria-hidden />} title={t('operationDoc.notFound')} description={t('operationDoc.notFoundText')} />;
  }

  const editable = EDITABLE_TYPES.has(doc.type) && !doc.cancelledByDocId && !doc.cancelledAt;
  const baseLines = () => Object.fromEntries(doc.lineDetails.map((l) => [l.goodId, { qty: String(Math.abs(l.qtySale)), unitPrice: l.unitPrice, discountPct: l.discountPct ?? 0 }]));
  const lines = editedLines ?? baseLines();
  const patchLine = (goodId: Id, patch: Partial<{ qty: string; unitPrice: number; discountPct: number }>) => {
    setEditedLines((prev) => {
      const current = prev ?? baseLines();
      return { ...current, [goodId]: { ...current[goodId], ...patch } };
    });
  };
  const qtyInvalid = (goodId: Id) => !(parseQty(lines[goodId]?.qty ?? '') > 0);
  const hasDiscount = doc.type === 'income' || doc.type === 'sale';

  const removeLine = async (goodId: Id) => {
    try {
      setLastDoc(doc);
      const gone = await deleteLineMutation.mutate(goodId);
      toast.success(gone ? t('operationDoc.docDeleted') : t('operationDoc.lineDeleted'));
      if (gone) {
        // Ск6: убрана последняя строка — документа больше нет, уходим с его адреса
        setDeleted(true);
        router.replace('/biz/stock/operations');
        return;
      }
      if (editedLines) {
        const next = { ...editedLines };
        delete next[goodId];
        setEditedLines(next);
      }
    } catch {
      toast.error(t('operationDoc.actionFailed'));
    }
  };

  const lineTotalOf = (goodId: Id) => {
    const line = lines[goodId];
    const qty = parseQty(line?.qty ?? '');
    if (!line || !(qty > 0)) return 0;
    const gross = qty * line.unitPrice;
    return Math.round(gross - gross * ((hasDiscount ? line.discountPct : 0) / 100));
  };
  const total = doc.lineDetails.reduce((s, l) => s + lineTotalOf(l.goodId), 0) + (doc.extraLines ?? []).reduce((s, e) => s + e.price, 0);
  const effectiveSupplier: SupplierValue = supplier ?? { counterpartyId: doc.counterpartyId, name: doc.counterpartyName ?? '' };
  const effectivePaid = paid ?? doc.paid;

  const save = async () => {
    setTouched(true);
    if (doc.lineDetails.some((l) => lines[l.goodId] && qtyInvalid(l.goodId))) return;
    try {
      await updateMutation.mutate({
        date: dateVal && timeVal ? combine(dateVal, timeVal) : doc.date,
        warehouseId: warehouseId ?? doc.warehouseId,
        counterpartyName: effectiveSupplier.name || undefined,
        counterpartyId: effectiveSupplier.counterpartyId,
        paid: effectivePaid,
        paymentMethod: paymentMethod ?? doc.paymentMethod,
        reason: (reason ?? doc.reason) ?? undefined,
        comment: comment ?? doc.comment,
        lines: doc.lineDetails
          .filter((l) => lines[l.goodId])
          .map((l) => ({ goodId: l.goodId, qtySale: parseQty(lines[l.goodId].qty), unitPrice: lines[l.goodId].unitPrice, discountPct: hasDiscount ? lines[l.goodId].discountPct : undefined })),
      });
      toast.success(t('operationDoc.saved'));
      resetEdits();
    } catch {
      toast.error(t('operationDoc.actionFailed'));
    }
  };

  const confirmDeleteDoc = async () => {
    try {
      setLastDoc(doc);
      await deleteOperationDoc(businessId!, docId);
      setDeleted(true);
      toast.success(t('operationDoc.docDeleted'));
      // Ск6: replace, а не push — «Назад» не должен возвращать на адрес удалённого документа
      router.replace('/biz/stock/operations');
    } catch {
      toast.error(t('operationDoc.actionFailed'));
    }
  };

  const cancelEdits = async () => {
    if (!(await confirmLeave())) return;
    resetEdits();
  };

  const confirmCancelMove = async () => {
    try {
      await cancelMoveMutation.mutate(undefined);
      toast.success(t('operationDoc.moveCancelled'));
    } catch {
      toast.error(t('operationDoc.actionFailed'));
    }
  };

  const confirmCancelSale = async () => {
    try {
      await cancelSaleMutation.mutate(undefined);
      toast.success(t('operationDoc.saleCancelled'));
    } catch {
      toast.error(t('operationDoc.actionFailed'));
    }
  };

  return (
    <div data-f="F-08-049 F-08-050 F-08-051 F-08-052 F-08-060 F-08-146 F-08-072 F-08-073 F-08-075 F-08-076 F-08-077 F-08-092" className="mx-auto flex w-full max-w-[760px] flex-col gap-6 pb-28">
      <PageHeader
        title={t('operationDoc.title', { number: doc.number })}
        back={{ href: '/biz/stock/operations' }}
        actions={
          <div className="flex items-center gap-2">
            {doc.type === 'sale' && (
              <LinkButton href={`/biz/stock/operations/${docId}/receipt`} variant="secondary" size="sm" leftIcon={<Printer className="size-4" aria-hidden />}>
                {t('operationDoc.receipt')}
              </LinkButton>
            )}
            <Badge tone="neutral">{OPERATION_TYPE_LABELS[doc.type].ru}</Badge>
          </div>
        }
      />

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as 'lines' | 'history')}
        items={[
          { value: 'lines', label: t('operationDoc.tabLines') },
          { value: 'history', label: t('operationDoc.tabHistory') },
        ]}
      />

      {tab === 'lines' ? (
        <>
          {doc.cancelledAt && doc.type === 'sale' && <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-fg">{t('operationDoc.saleWasCancelled')}</div>}
          {doc.cancelledByDocId && doc.type !== 'sale' && <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-fg">{t('operationDoc.wasCancelled')}</div>}
          {doc.cancelsDocId && <div className="rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm text-muted">{t('operationDoc.isCancelReverse')}</div>}

          <SectionCard title={t('operationForm.section.general')}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label={t('operationForm.date')}>
                <DatePicker value={dateVal ?? datePart(doc.date)} onValueChange={(v) => { if (v) { setDateVal(v); if (!timeVal) setTimeVal(timePart(doc.date)); } }} disabled={!editable} />
              </FormField>
              <FormField label={t('operationForm.time')}>
                <TimePicker value={timeVal ?? timePart(doc.date)} onValueChange={(v) => { if (v) { setTimeVal(v); if (!dateVal) setDateVal(datePart(doc.date)); } }} disabled={!editable} />
              </FormField>
              <FormField label={t('operationForm.warehouse')}>
                <Select
                  options={(warehousesQ.data ?? []).map((w) => ({ value: w.id, label: warehouseLabel(w, t) }))}
                  value={warehouseId ?? doc.warehouseId}
                  onValueChange={setWarehouseId}
                  disabled={!editable}
                />
              </FormField>
              {doc.toWarehouseName && (
                <FormField label={t('moveGoods.to')}>
                  <Input value={doc.toWarehouseName} disabled />
                </FormField>
              )}
              {doc.type === 'income' && !doc.inventoryId && !doc.cancelsDocId && businessId && (
                <FormField label={t('operationForm.supplier')} optional>
                  <SupplierField businessId={businessId} value={effectiveSupplier} onChange={setSupplier} disabled={!editable} />
                </FormField>
              )}
              {doc.reason && (
                <FormField label={t('operationForm.reason')}>
                  <Select options={Object.entries(WRITEOFF_REASON_LABELS).map(([v, l]) => ({ value: v, label: l.ru }))} value={reason ?? doc.reason} onValueChange={(v) => setReason(v as WriteoffReason)} disabled={!editable} />
                </FormField>
              )}
            </div>
          </SectionCard>

          <SectionCard title={t('operationForm.section.lines')}>
            {doc.lineDetails.length === 0 ? (
              <EmptyState compact title={t('operationDoc.noLinesLeft')} />
            ) : (
              <ul className="flex flex-col gap-2">
                {doc.lineDetails.map((l, i) => {
                  const line = lines[l.goodId];
                  return (
                    <li key={l.goodId} className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-3">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-medium text-fg">
                          {i + 1}. {l.goodName}
                        </span>
                        {editable && (
                          <button type="button" onClick={() => removeLine(l.goodId)} className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-danger hover:bg-danger/10" aria-label={t('operationForm.removeLine')}>
                            <Trash2 className="size-4" aria-hidden />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <FormField
                          label={`${t('operationForm.qty')}, ${unitShort(l.saleUnit)}`}
                          error={touched && qtyInvalid(l.goodId) ? t('operationForm.qtyPositive') : undefined}
                        >
                          <Input type="number" inputMode="decimal" min={0} step="any" value={line.qty} disabled={!editable} onChange={(e) => patchLine(l.goodId, { qty: e.target.value })} />
                        </FormField>
                        <FormField label={doc.type === 'income' ? t('operationForm.unitPrice') : doc.type === 'sale' ? t('sale.unitPrice') : t('operationForm.unitCost')}>
                          <MoneyInput value={line.unitPrice} disabled={!editable} onValueChange={(v) => patchLine(l.goodId, { unitPrice: v ?? 0 })} />
                        </FormField>
                        {hasDiscount && (
                          <FormField label={t('operationForm.discount')}>
                            <Input type="number" min={0} max={100} value={line.discountPct} disabled={!editable} onChange={(e) => patchLine(l.goodId, { discountPct: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })} />
                          </FormField>
                        )}
                        <FormField label={t('operationForm.sum')}>
                          <p className="flex min-h-10 items-center text-sm font-semibold text-fg">{format.money(lineTotalOf(l.goodId))}</p>
                        </FormField>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            {(doc.extraLines ?? []).length > 0 && (
              <ul className="mt-2 flex flex-col gap-2">
                {(doc.extraLines ?? []).map((e, i) => (
                  <li key={`${e.refId}-${i}`} className="flex items-center justify-between gap-2 rounded-xl border border-border bg-surface p-3">
                    <div className="flex items-center gap-2">
                      <Ticket className="size-4 shrink-0 text-primary-text" aria-hidden />
                      <div>
                        <p className="text-sm font-medium text-fg">{e.typeName}</p>
                        <p className="text-xs text-muted">
                          {e.kind === 'certificate' ? t('sale.kindCertificate') : t('sale.kindMembership')}
                          {e.code ? ` · ${t('sale.codeShort')} ${e.code}` : ''}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-fg">{format.money(e.price)}</span>
                  </li>
                ))}
              </ul>
            )}
            {(doc.lineDetails.length > 0 || (doc.extraLines ?? []).length > 0) && (
              <div data-f="F-08-100" className="mt-3 flex items-center justify-between border-t border-border pt-3 text-base font-semibold text-fg">
                <span>{t('operationForm.total')}</span>
                <span>{format.money(total)}</span>
              </div>
            )}
          </SectionCard>

          {doc.type === 'income' && !doc.inventoryId && !doc.cancelsDocId && (
            <SectionCard title={t('operationForm.section.payment')}>
              <div className="flex flex-col gap-3">
                <label className="flex min-h-11 items-center gap-3">
                  <Checkbox checked={effectivePaid} onCheckedChange={setPaid} disabled={!editable} />
                  <span className="text-sm text-fg">{t('operationForm.paid')}</span>
                </label>
                {effectivePaid && (
                  <FormField label={t('operationForm.paymentMethod')} className="sm:max-w-xs">
                    <Select
                      options={[
                        { value: 'cash', label: t('sale.paymentCash') },
                        { value: 'card', label: t('sale.paymentCard') },
                      ]}
                      value={paymentMethod ?? doc.paymentMethod ?? 'cash'}
                      onValueChange={(v) => setPaymentMethod(v as SalePaymentMethod)}
                      disabled={!editable}
                    />
                  </FormField>
                )}
              </div>
            </SectionCard>
          )}

          <SectionCard title={t('operationForm.section.comment')}>
            <Textarea value={comment ?? doc.comment ?? ''} onChange={(e) => setComment(e.target.value)} rows={3} disabled={!editable} />
          </SectionCard>

          <StickyActionBar>
            {editable && doc.type === 'sale' ? (
              <>
                <Button variant="danger" leftIcon={<Undo2 className="size-4" aria-hidden />} onClick={() => setCancelSaleOpen(true)}>
                  {t('operationDoc.cancelSale')}
                </Button>
                <Button variant="secondary" onClick={cancelEdits} disabled={!dirty || updateMutation.isPending}>
                  {t('operationForm.cancel')}
                </Button>
                <Button onClick={save} loading={updateMutation.isPending}>
                  {t('operationDoc.saveChanges')}
                </Button>
              </>
            ) : editable ? (
              <>
                <Button variant="danger" onClick={() => setDeleteDocOpen(true)}>
                  {t('operationDoc.deleteDoc')}
                </Button>
                <Button variant="secondary" onClick={cancelEdits} disabled={!dirty || updateMutation.isPending}>
                  {t('operationForm.cancel')}
                </Button>
                <Button onClick={save} loading={updateMutation.isPending}>
                  {t('operationDoc.saveChanges')}
                </Button>
              </>
            ) : doc.type === 'move' && !doc.cancelledByDocId && !doc.cancelsDocId ? (
              <Button variant="danger" onClick={() => setCancelMoveOpen(true)}>
                {t('operationDoc.cancelMove')}
              </Button>
            ) : null}
          </StickyActionBar>
        </>
      ) : (
        <SectionCard title={t('operationDoc.tabHistory')}>
          {historyQ.isLoading ? (
            <Skeleton lines={3} />
          ) : (historyQ.data ?? []).length === 0 ? (
            <EmptyState compact title={t('operations.history.empty')} />
          ) : (
            <ul className="flex flex-col gap-3">
              {historyPage.map((h) => (
                <li key={h.id} className="text-sm">
                  <p className="text-fg">{h.summary}</p>
                  <p className="text-xs text-muted">
                    {h.staffName} · {format.dateTime(h.at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {historyPager && <div className="mt-4">{historyPager}</div>}
        </SectionCard>
      )}

      <ConfirmDialog
        open={deleteDocOpen}
        onOpenChange={setDeleteDocOpen}
        tone="danger"
        title={t('operationDoc.deleteDocConfirmTitle')}
        description={t('operationDoc.deleteDocConfirmText')}
        confirmLabel={t('operationDoc.deleteDoc')}
        onConfirm={confirmDeleteDoc}
      />
      <ConfirmDialog
        open={cancelMoveOpen}
        onOpenChange={setCancelMoveOpen}
        tone="danger"
        title={t('operationDoc.cancelMoveConfirmTitle')}
        description={t('operationDoc.cancelMoveConfirmText')}
        confirmLabel={t('operationDoc.cancelMove')}
        onConfirm={confirmCancelMove}
      />
      <ConfirmDialog
        open={cancelSaleOpen}
        onOpenChange={setCancelSaleOpen}
        tone="danger"
        title={t('operationDoc.cancelSaleConfirmTitle')}
        description={t('operationDoc.cancelSaleConfirmText')}
        confirmLabel={t('operationDoc.cancelSale')}
        onConfirm={confirmCancelSale}
      />
    </div>
  );
}
