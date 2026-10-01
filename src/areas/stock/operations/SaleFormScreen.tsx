'use client';

/**
 * /biz/stock/operations/new/sale — F-08-062…077, F-08-092, F-00-138: панель «Продажа товара» —
 * дата, сотрудник, склад, клиент, комментарий, строки товаров + абонементов/сертификатов (продаются
 * через api loyalty — sellCertificate/sellMembership), окно оплаты, «Сохранить без оплаты» / «и оплатить».
 * Открывается и напрямую (/biz/stock/operations/new/sale), и ссылкой с ?clientId=&bookingId= из журнала.
 */
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Ticket, Trash2, Wallet } from 'lucide-react';
import { createSaleOperation, listGoods, listWarehouses, type GoodRow, type SaleExtraLine } from '@/api/stock';
import {
  listCertificateTypes,
  listMembershipTypes,
  deleteMembershipSale,
  sellCertificate,
  sellMembership,
  voidCertificateSale,
  type CertificateTypeRow,
  type MembershipTypeRow,
} from '@/api/loyalty';
import { getClientRow, listClients } from '@/api/clients';
import { newId } from '@/lib/id';
import { ApiError, useApiMutation, useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import type { Id } from '@/domain/core';
import type { SalePaymentMethod } from '@/domain/stock';
import { useT } from '@/i18n/useT';
import { formatQty, parseQty, stockAtWarehouse, warehouseLabel, useUnitShort } from '@/areas/stock/warehouse.utils';
import { cn } from '@/lib/cn';
import { useUnsavedGuard } from '@/ui/hooks/useUnsavedGuard';
import { useFormat } from '@/i18n/useFormat';
import { combine, datePart, timePart, nowDateTime } from '@/lib/date';
import { Button } from '@/ui/Button';
import { Combobox, type ComboboxOption } from '@/ui/Combobox';
import { DatePicker } from '@/ui/DatePicker';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { MoneyInput } from '@/ui/MoneyInput';
import { Modal } from '@/ui/Modal';
import { PageHeader } from '@/ui/PageHeader';
import { SectionCard } from '@/ui/SectionCard';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { Select } from '@/ui/Select';
import { Skeleton } from '@/ui/Skeleton';
import { StickyActionBar } from '@/ui/StickyActionBar';
import { Tabs } from '@/ui/Tabs';
import { Textarea } from '@/ui/Textarea';
import { TimePicker } from '@/ui/TimePicker';
import { useToast } from '@/ui/Toast';
import { GoodListPickerModal, GoodPicker } from '@/areas/stock/GoodPicker';

interface ProductLine {
  good: GoodRow;
  /** Текст поля как ввели (Ск7) */
  qty: string;
  unitPrice: number;
  discountPct: number;
}

interface ExtraDraft {
  key: string;
  kind: 'certificate' | 'membership';
  typeId: Id;
  typeName: string;
  price: number;
  code: string;
}

function lineSum(l: ProductLine): number {
  const qty = parseQty(l.qty);
  if (!(qty > 0)) return 0;
  const gross = qty * l.unitPrice;
  return Math.round(gross - gross * (l.discountPct / 100));
}

function randomCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export function SaleFormScreen() {
  const unitShort = useUnitShort();
  const t = useT('stock');
  const toast = useToast();
  const router = useRouter();
  const format = useFormat();
  const params = useSearchParams();
  const presetClientId = params.get('clientId') ?? undefined;
  const presetBookingId = params.get('bookingId') ?? undefined;
  const { ready, businessId, locationId: rawLocationId, activeLocationIds } = useCurrent();
  const locationId = rawLocationId === 'all' ? activeLocationIds[0] : rawLocationId;
  const enabled = ready && Boolean(businessId) && Boolean(locationId);

  const [now] = useState(() => nowDateTime());
  const [date, setDate] = useState(datePart(now));
  const [time, setTime] = useState(timePart(now));
  const [warehouseId, setWarehouseId] = useState('');
  const [clientId, setClientId] = useState<Id | undefined>(presetClientId);
  const [selectedClient, setSelectedClient] = useState<{ name: string; phone: string } | undefined>();
  const [clientQuery, setClientQuery] = useState('');
  const [comment, setComment] = useState('');
  const [lines, setLines] = useState<ProductLine[]>([]);
  const [extras, setExtras] = useState<ExtraDraft[]>([]);
  const [listPickerOpen, setListPickerOpen] = useState(false);
  const [extraModalOpen, setExtraModalOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [touched, setTouched] = useState(false);
  const [saved, setSaved] = useState(false);

  const dirty = !saved && (lines.length > 0 || extras.length > 0 || Boolean(comment.trim()));
  const { confirmLeave } = useUnsavedGuard(dirty);

  const warehousesQ = useApiQuery(['stock', 'warehouses', businessId, locationId], () => listWarehouses(businessId!, locationId!), { enabled });
  const goodsQ = useApiQuery(
    ['stock', 'goods', businessId, locationId, 'sale-picker'],
    () => listGoods(businessId!, locationId!, { pageSize: 1000 }),
    { enabled },
  );
  const clientsQ = useApiQuery(
    ['clients', 'list', businessId, locationId, clientQuery],
    () => listClients({ businessId: businessId!, locationIds: locationId ? [locationId] : undefined, search: clientQuery, page: 1, pageSize: 8 }),
    { enabled: enabled && clientQuery.trim().length > 1 },
  );
  const presetClientQ = useApiQuery(['clients', 'row', businessId, presetClientId], () => getClientRow(businessId!, presetClientId!), {
    enabled: enabled && Boolean(presetClientId) && !selectedClient,
  });
  if (presetClientQ.data && !selectedClient) setSelectedClient({ name: presetClientQ.data.name, phone: presetClientQ.data.phone });

  const saleWarehouses = (warehousesQ.data ?? []).filter((w) => w.type === 'sale');
  if (warehouseId === '' && saleWarehouses.length) setWarehouseId(saleWarehouses[0].id);

  const create = useApiMutation((input: Parameters<typeof createSaleOperation>[2]) => createSaleOperation(businessId!, locationId!, input));
  const sellCert = useApiMutation((input: Parameters<typeof sellCertificate>[1]) => sellCertificate(businessId!, input));
  const sellMember = useApiMutation((input: Parameters<typeof sellMembership>[1]) => sellMembership(businessId!, input));
  const saving = create.isPending || sellCert.isPending || sellMember.isPending;

  const productsTotal = lines.reduce((s, l) => s + lineSum(l), 0);
  const extrasTotal = extras.reduce((s, e) => s + e.price, 0);
  const total = productsTotal + extrasTotal;
  const excludeIds = lines.map((l) => l.good.id);

  const addLine = (good: GoodRow) => setLines((prev) => [...prev, { good, qty: '1', unitPrice: good.salePrice, discountPct: 0 }]);
  const addLines = (goods: GoodRow[]) =>
    setLines((prev) => [...prev, ...goods.map((g) => ({ good: g, qty: '1', unitPrice: g.salePrice, discountPct: 0 }))]);
  const bumpLine = (good: GoodRow) =>
    setLines((prev) => prev.map((l) => (l.good.id === good.id ? { ...l, qty: String((parseQty(l.qty) > 0 ? parseQty(l.qty) : 0) + 1) } : l)));
  const goodsById = new Map((goodsQ.data?.items ?? []).map((g) => [g.id, g]));
  const stockOf = (good: GoodRow) => stockAtWarehouse(goodsById.get(good.id) ?? good, warehouseId);
  const importLines = (rows: { good: GoodRow; qty: number; price?: number; discountPct?: number }[]) => {
    setLines((prev) => [
      ...prev,
      ...rows
        .filter((r) => !prev.some((l) => l.good.id === r.good.id))
        .map((r) => ({ good: r.good, qty: String(r.qty), unitPrice: r.price ?? r.good.salePrice, discountPct: r.discountPct ?? 0 })),
    ]);
  };
  const removeLine = (goodId: Id) => setLines((prev) => prev.filter((l) => l.good.id !== goodId));
  const patchLine = (goodId: Id, patch: Partial<ProductLine>) => setLines((prev) => prev.map((l) => (l.good.id === goodId ? { ...l, ...patch } : l)));
  const removeExtra = (key: string) => setExtras((prev) => prev.filter((e) => e.key !== key));

  const linesError = touched && lines.length === 0 && extras.length === 0 ? t('sale.needAtLeastOne') : undefined;
  const warehouseError = touched && !warehouseId ? t('operationForm.warehouseRequired') : undefined;

  const qtyInvalid = (l: ProductLine) => !(parseQty(l.qty) > 0);
  const formValid = () => (lines.length > 0 || extras.length > 0) && Boolean(warehouseId) && !lines.some(qtyInvalid);

  const cancel = async () => {
    if (!(await confirmLeave())) return;
    setSaved(true);
    router.push('/biz/stock/operations');
  };

  /** Ск20: откат уже проданных абонементов/сертификатов, если продажа целиком не состоялась */
  const rollbackExtras = async (sold: SaleExtraLine[]) => {
    for (const line of sold) {
      try {
        if (line.kind === 'certificate') await voidCertificateSale(businessId!, line.refId);
        else await deleteMembershipSale(businessId!, line.refId);
      } catch {
        // откат не удался — продажа всё равно не записана; сообщение ниже общее
      }
    }
  };

  const doSave = async (method: SalePaymentMethod, paid: boolean) => {
    setTouched(true);
    if (!formValid()) return;
    // Ск20: всё, что может отказать, проверяем ДО продажи сертификатов — иначе сертификат оставался
    // проданным, а документа продажи не было
    if (extras.some((e) => e.kind === 'membership') && !clientId) {
      toast.error(t('sale.membershipNeedsClient'));
      return;
    }
    const sold: SaleExtraLine[] = [];
    try {
      for (const extra of extras) {
        if (extra.kind === 'certificate') {
          const cert = await sellCert.mutate({
            certTypeId: extra.typeId,
            clientId,
            locationId: locationId!,
            code: extra.code || undefined,
            price: extra.price,
          });
          sold.push({ kind: 'certificate', refId: cert.id, typeName: extra.typeName, code: cert.code || undefined, price: extra.price });
        } else {
          const membership = await sellMember.mutate({
            membershipTypeId: extra.typeId,
            clientId: clientId!,
            locationId: locationId!,
            code: extra.code || undefined,
            price: extra.price,
          });
          sold.push({ kind: 'membership', refId: membership.id, typeName: extra.typeName, code: membership.code || undefined, price: extra.price });
        }
      }
      const dateTime = combine(date, time);
      const doc = await create.mutate({
        date: dateTime,
        warehouseId,
        clientId,
        bookingId: presetBookingId,
        comment: comment || undefined,
        paymentMethod: method,
        paid,
        lines: lines.map((l) => ({ goodId: l.good.id, qtySale: parseQty(l.qty), unitPrice: l.unitPrice, discountPct: l.discountPct })),
        extraLines: sold,
      });
      setSaved(true);
      toast.success(t('sale.saved'));
      router.push(`/biz/stock/operations/${doc.id}`);
    } catch (e) {
      await rollbackExtras(sold);
      if (e instanceof ApiError && e.code === 'insufficient_stock') {
        // F-08-099: «Запретить операции при нехватке» включена
        try {
          const info = JSON.parse(e.message) as { goodName: string; warehouseName: string };
          toast.error(t('sale.saveFailedInsufficient', { good: info.goodName, warehouse: info.warehouseName }));
        } catch {
          toast.error(t('sale.saveFailed'));
        }
      } else toast.error(t('sale.saveFailed'));
    }
  };

  if (warehousesQ.isError || goodsQ.isError) {
    return (
      <ErrorState
        onRetry={() => {
          warehousesQ.refetch();
          goodsQ.refetch();
        }}
      />
    );
  }
  if (!enabled || warehousesQ.isLoading || goodsQ.isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
        <Skeleton variant="rect" className="h-10" />
        <Skeleton lines={8} />
      </div>
    );
  }
  if (saleWarehouses.length === 0) {
    return <EmptyState title={t('sale.noSaleWarehouseTitle')} description={t('sale.noSaleWarehouseText')} />;
  }

  const goods = goodsQ.data?.items ?? [];
  const clientOptions: ComboboxOption[] = (clientsQ.data?.rows ?? []).map((c) => ({ value: c.id, label: c.name, description: c.phone }));

  return (
    <div
      data-f="F-08-062 F-08-063 F-08-064 F-08-065 F-08-066 F-08-067 F-08-070 F-08-071 F-08-073 F-08-075 F-08-076 F-08-077 F-08-099 F-00-138 F-07-051 F-07-052 F-07-054 F-06-071 F-06-094"
      className="mx-auto flex w-full max-w-[760px] flex-col gap-6 pb-28"
    >
      <PageHeader title={t('sale.title')} description={t('sale.subtitle')} back={{ href: '/biz/stock/operations' }} />

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
              options={saleWarehouses.map((w) => ({ value: w.id, label: warehouseLabel(w, t) }))}
              value={warehouseId}
              onValueChange={setWarehouseId}
            />
          </FormField>
          <FormField label={t('sale.client')} optional hint={t('sale.clientHint')}>
            {clientId && selectedClient ? (
              <div className="flex min-h-11 items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3">
                <span className="text-sm text-fg">
                  {selectedClient.name} · {format.phone(selectedClient.phone)}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setClientId(undefined);
                    setSelectedClient(undefined);
                  }}
                  className="text-xs text-muted underline"
                >
                  {t('sale.clientClear')}
                </button>
              </div>
            ) : (
              <Combobox
                options={clientOptions}
                value={null}
                onInputChange={setClientQuery}
                onValueChange={(v, option) => {
                  if (!v) return;
                  setClientId(v);
                  setSelectedClient(option ? { name: option.label, phone: option.description ?? '' } : undefined);
                }}
                loading={clientsQ.isFetching}
                placeholder={t('sale.clientPlaceholder')}
                emptyText={clientQuery.trim().length > 1 ? t('sale.clientNoResults') : t('sale.clientTypeToSearch')}
              />
            )}
          </FormField>
        </div>
      </SectionCard>

      <SectionCard title={t('operationForm.section.lines')}>
        <div className="flex flex-col gap-4">
          {businessId && locationId && (
            <GoodPicker businessId={businessId} locationId={locationId} excludeIds={excludeIds} onAdd={addLine} onImportRows={importLines} onRepeat={bumpLine} />
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setListPickerOpen(true)}>
              {t('operationForm.addFromList')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              leftIcon={<Ticket className="size-4" aria-hidden />}
              onClick={() => setExtraModalOpen(true)}
            >
              {t('sale.addMembershipOrCert')}
            </Button>
          </div>
          {linesError && <p className="text-sm text-danger">{linesError}</p>}

          {lines.length === 0 && extras.length === 0 ? (
            <EmptyState compact title={t('operationForm.noLines')} />
          ) : (
            <ul className="flex flex-col gap-2">
              {lines.map((l, i) => {
                const unit = unitShort(l.good.saleUnit);
                const onHand = stockOf(l.good);
                const over = parseQty(l.qty) > onHand;
                return (
                <li key={l.good.id} className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-fg">
                        {i + 1}. {l.good.name}
                      </p>
                      <p className={cn('text-xs', over ? 'font-medium text-danger' : 'text-muted')}>
                        {over ? t('operationForm.overdraw', { qty: formatQty(onHand), unit }) : t('operationForm.onHand', { qty: formatQty(onHand), unit })}
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
                    <FormField label={`${t('operationForm.qty')}, ${unit}`} error={touched && qtyInvalid(l) ? t('operationForm.qtyPositive') : undefined}>
                      <Input type="number" inputMode="decimal" min={0} step="any" value={l.qty} onChange={(e) => patchLine(l.good.id, { qty: e.target.value })} />
                    </FormField>
                    <FormField label={t('sale.unitPrice')}>
                      <MoneyInput value={l.unitPrice} onValueChange={(v) => patchLine(l.good.id, { unitPrice: v ?? 0 })} />
                    </FormField>
                    <FormField label={t('operationForm.discount')}>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={l.discountPct}
                        onChange={(e) => patchLine(l.good.id, { discountPct: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })}
                      />
                    </FormField>
                    <FormField label={t('operationForm.sum')}>
                      <p className="flex min-h-10 items-center text-sm font-semibold text-fg">{format.money(lineSum(l))}</p>
                    </FormField>
                  </div>
                </li>
                );
              })}
              {extras.map((e) => (
                <li key={e.key} className="flex items-center justify-between gap-2 rounded-xl border border-border bg-surface p-3">
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
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-fg">{format.money(e.price)}</span>
                    <button
                      type="button"
                      onClick={() => removeExtra(e.key)}
                      className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-danger hover:bg-danger/10"
                      aria-label={t('operationForm.removeLine')}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {(lines.length > 0 || extras.length > 0) && (
            <div className="flex items-center justify-between border-t border-border pt-3 text-base font-semibold text-fg">
              <span>{t('operationForm.total')}</span>
              <span>{format.money(total)}</span>
            </div>
          )}
        </div>
      </SectionCard>

      <SectionCard title={t('operationForm.section.comment')}>
        <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} placeholder={t('operationForm.commentPlaceholder')} />
      </SectionCard>

      <StickyActionBar>
        <div className="flex w-full flex-col gap-2 sm:flex-row">
          <Button variant="ghost" onClick={cancel} disabled={saving}>
            {t('operationForm.cancel')}
          </Button>
          <Button variant="secondary" className="sm:flex-1" onClick={() => doSave('unpaid', false)} loading={saving}>
            {t('sale.saveUnpaid')}
          </Button>
          <Button
            className="sm:flex-1"
            leftIcon={<Wallet className="size-4" aria-hidden />}
            onClick={() => {
              setTouched(true);
              if (formValid()) setPaymentOpen(true);
            }}
            loading={saving}
          >
            {t('sale.saveAndPay')}
          </Button>
        </div>
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

      {businessId && (
        <AddExtraModal
          open={extraModalOpen}
          onOpenChange={setExtraModalOpen}
          businessId={businessId}
          onAdd={(draft) => setExtras((prev) => [...prev, draft])}
        />
      )}

      <PaymentModal
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        total={total}
        onConfirm={(method) => {
          setPaymentOpen(false);
          doSave(method, true);
        }}
      />
    </div>
  );
}

function AddExtraModal({
  open,
  onOpenChange,
  businessId,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  businessId: Id;
  onAdd: (draft: ExtraDraft) => void;
}) {
  const t = useT('stock');
  const [tab, setTab] = useState<'certificate' | 'membership'>('certificate');
  const [code, setCode] = useState('');

  const certsQ = useApiQuery(['loyalty', 'certificateTypes', businessId], () => listCertificateTypes(businessId), { enabled: open });
  const membersQ = useApiQuery(['loyalty', 'membershipTypes', businessId], () => listMembershipTypes(businessId), { enabled: open });

  const pick = (kind: 'certificate' | 'membership', type: CertificateTypeRow | MembershipTypeRow) => {
    // F-08-092/F-08-076: поле подписано «необязательно» — держим это правдой. Когда код нужен (сертификат без
    // allowNoCode) и продавец его не ввёл, генерируем сами, а не отказываем продажу.
    const needsCode = kind === 'certificate' && !(type as CertificateTypeRow).allowNoCode;
    const finalCode = code.trim() || (needsCode ? randomCode() : '');
    onAdd({
      key: newId(`ext-${kind}`),
      kind,
      typeId: type.id,
      typeName: type.name,
      price: kind === 'certificate' ? (type as CertificateTypeRow).nominal : (type as MembershipTypeRow).price,
      code: finalCode,
    });
    setCode('');
    onOpenChange(false);
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={t('sale.addMembershipOrCert')} size="md">
      <div className="flex flex-col gap-4">
        <Tabs
          items={[
            { value: 'certificate', label: t('sale.kindCertificate') },
            { value: 'membership', label: t('sale.kindMembership') },
          ]}
          value={tab}
          onValueChange={(v) => setTab(v as 'certificate' | 'membership')}
        />
        <FormField label={t('sale.code')} optional hint={t('sale.codeHint')}>
          <div className="flex gap-2">
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder={t('sale.codePlaceholder')} />
            <Button type="button" variant="secondary" onClick={() => setCode(randomCode())}>
              {t('sale.codeGenerate')}
            </Button>
          </div>
        </FormField>
        {tab === 'certificate' ? (
          certsQ.isLoading ? (
            <Skeleton lines={3} />
          ) : !certsQ.data?.length ? (
            <EmptyState compact title={t('sale.noCertificateTypes')} />
          ) : (
            <ul className="flex flex-col gap-2">
              {certsQ.data.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => pick('certificate', c)}
                    className="flex min-h-11 w-full items-center justify-between rounded-lg border border-border bg-surface px-3 py-2 text-left hover:border-primary"
                  >
                    <span className="text-sm text-fg">{c.name}</span>
                    <span className="text-sm font-semibold text-fg">{c.nominal.toLocaleString('ru')} ֏</span>
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : membersQ.isLoading ? (
          <Skeleton lines={3} />
        ) : !membersQ.data?.filter((m) => !m.archived).length ? (
          <EmptyState compact title={t('sale.noMembershipTypes')} />
        ) : (
          <ul className="flex flex-col gap-2">
            {membersQ.data
              .filter((m) => !m.archived)
              .map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => pick('membership', m)}
                    className="flex min-h-11 w-full items-center justify-between rounded-lg border border-border bg-surface px-3 py-2 text-left hover:border-primary"
                  >
                    <span className="text-sm text-fg">{m.name}</span>
                    <span className="text-sm font-semibold text-fg">{m.price.toLocaleString('ru')} ֏</span>
                  </button>
                </li>
              ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}

function PaymentModal({
  open,
  onOpenChange,
  total,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  total: number;
  onConfirm: (method: SalePaymentMethod) => void;
}) {
  const t = useT('stock');
  const format = useFormat();
  const [method, setMethod] = useState<Exclude<SalePaymentMethod, 'unpaid'>>('cash');
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t('sale.paymentTitle')}
      size="sm"
      footer={
        <Button className="w-full" onClick={() => onConfirm(method)}>
          {t('sale.paymentConfirm', { sum: format.money(total) })}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-2xl font-semibold text-fg">{format.money(total)}</p>
        <SegmentedControl
          fullWidth
          options={[
            { value: 'cash', label: t('sale.paymentCash') },
            { value: 'card', label: t('sale.paymentCard') },
            { value: 'loyalty', label: t('sale.paymentLoyalty') },
          ]}
          value={method}
          onValueChange={(v) => setMethod(v as Exclude<SalePaymentMethod, 'unpaid'>)}
        />
      </div>
    </Modal>
  );
}
