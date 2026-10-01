'use client';

/**
 * /biz/stock/order — ⭐ F-00-137: товары ниже критичного остатка, количество до желаемого, «Отправить
 * поставщику в WhatsApp» (wa.me с готовым текстом). Счётчик у пункта меню — countBelowCritical.
 * Ск15: галочки снимаются все (храним СНЯТЫЕ, а не отмеченные — рендер больше не «отмечает обратно»),
 * количество правится в строке, поставщик выбирается из контрагентов и запоминается.
 */
import { useState } from 'react';
import { MessageCircle, PackageSearch } from 'lucide-react';
import { buildOrderWhatsAppUrl, getOrderSupplier, listOrderCandidates, saveOrderSupplier } from '@/api/stock';
import { listCounterparties } from '@/api/finance';
import { useApiQuery } from '@/api/request';
import { useCurrent, useDemo } from '@/demo/hooks';
import type { LocaleCode } from '@/domain/core';
import type { Id } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { Checkbox } from '@/ui/Checkbox';
import { Combobox } from '@/ui/Combobox';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { PageHeader } from '@/ui/PageHeader';
import { PhoneInput } from '@/ui/PhoneInput';
import { SectionCard } from '@/ui/SectionCard';
import { Select } from '@/ui/Select';
import { SkeletonText } from '@/ui/Skeleton';
import { useSkeletonCount } from '@/ui/hooks/useSkeletonCount';
import { StickyActionBar } from '@/ui/StickyActionBar';
import { SupplierOfferCard } from '@/areas/stock/SupplierOfferCard';
import { formatQty, parseQty, useUnitShort } from '@/areas/stock/warehouse.utils';

/** Название языка на нём самом — как в настройках языка кабинета */
const LANG_LABEL: Record<LocaleCode, string> = { hy: 'Հայերեն', ru: 'Русский', en: 'English' };

/** Строка товара к заказу: на телефоне поле количества — второй строкой справа, название и остаток — по строке */
const ITEM_ROW = 'flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border bg-surface px-4 py-3';
const ITEM_TEXT = 'min-w-0 flex-1 basis-40';
const ITEM_QTY = 'ml-auto flex shrink-0 items-center gap-2';
/** Единица — постоянной ширины («шт.», «мл», «флак.»): поле количества не сдвигается, когда подпись приехала */
const ITEM_UNIT = 'w-10 text-sm text-muted';

/** Скелетон строки товара — та же разметка: галочка, название и остаток, поле количества с единицей */
function OrderItemSkeleton() {
  return (
    <li className="flex flex-col gap-2">
      <div className={ITEM_ROW}>
        <Checkbox checked disabled aria-hidden />
        <div className={ITEM_TEXT}>
          <p className="truncate text-sm font-medium text-fg">
            <SkeletonText width="22ch" />
          </p>
          <p className="truncate text-xs text-muted">
            <SkeletonText width="30ch" />
          </p>
        </div>
        <div className={ITEM_QTY}>
          <Input disabled value="" className="w-24" aria-hidden tabIndex={-1} readOnly />
          <span className={ITEM_UNIT}>
            <SkeletonText width="4ch" />
          </span>
        </div>
      </div>
    </li>
  );
}

export function OrderScreen() {
  const unitShort = useUnitShort();
  const t = useT('stock');
  const { ready, businessId, locationId: rawLocationId, activeLocationIds } = useCurrent();
  const locationId = rawLocationId === 'all' ? activeLocationIds[0] : rawLocationId;
  const enabled = ready && Boolean(businessId) && Boolean(locationId);
  const q = useApiQuery(['stock', 'orderCandidates', businessId, locationId], () => listOrderCandidates(businessId!, locationId!), { enabled });
  const supplierQ = useApiQuery(['stock', 'orderSupplier', businessId], () => getOrderSupplier(businessId!), { enabled: ready && Boolean(businessId) });
  const counterpartiesQ = useApiQuery(['finance', 'counterparties', businessId], () => listCounterparties(businessId!), { enabled: ready && Boolean(businessId) });

  const [unchecked, setUnchecked] = useState<Set<Id>>(new Set());
  const [qtyDraft, setQtyDraft] = useState<Record<Id, string>>({});
  // null — ещё не трогали: показываем запомненного поставщика
  const [supplierId, setSupplierId] = useState<Id | null>(null);
  const [phoneDraft, setPhoneDraft] = useState<string | null>(null);
  // Владелец 01.10.2026: язык сообщения — из карточки поставщика (Counterparty.messageLang), по умолчанию язык кабинета
  const [langDraft, setLangDraft] = useState<LocaleCode | null>(null);
  const { lang: cabinetLang } = useDemo();

  const skeletonRows = useSkeletonCount('orderItems', { loading: q.isLoading, count: q.data?.length, fallback: 1, max: 10 });

  if (q.isError) return <ErrorState onRetry={q.refetch} />;
  const items = q.data ?? [];
  const remembered = supplierQ.data ?? null;
  const counterparties = counterpartiesQ.data ?? [];
  const effectiveSupplierId = supplierId ?? remembered?.counterpartyId ?? '';
  const phone = phoneDraft ?? remembered?.phone ?? '';

  const toggle = (id: Id) =>
    setUnchecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allChecked = items.length > 0 && unchecked.size === 0;
  const toggleAll = () => setUnchecked(allChecked ? new Set(items.map((i) => i.goodId)) : new Set());

  const qtyOf = (goodId: Id, fallback: number) => {
    const text = qtyDraft[goodId];
    if (text === undefined) return fallback;
    const n = parseQty(text);
    return n > 0 ? n : 0;
  };
  const selected = items
    .filter((i) => !unchecked.has(i.goodId))
    .map((i) => ({ ...i, toOrder: qtyOf(i.goodId, i.toOrder) }))
    .filter((i) => i.toOrder > 0);
  const supplierLang = counterparties.find((c) => c.id === effectiveSupplierId)?.messageLang;
  const messageLang: LocaleCode = langDraft ?? supplierLang ?? cabinetLang;
  const waUrl = phone.trim() ? buildOrderWhatsAppUrl(phone, selected, messageLang) : undefined;

  const pickSupplier = (id: string | null) => {
    setSupplierId(id ?? '');
    setLangDraft(null);
    const cp = counterparties.find((c) => c.id === id);
    if (cp?.phone) setPhoneDraft(cp.phone);
  };

  const send = () => {
    if (!waUrl || !businessId) return;
    const cp = counterparties.find((c) => c.id === effectiveSupplierId);
    void saveOrderSupplier(businessId, { counterpartyId: cp?.id, name: cp?.name, phone }).catch(() => {});
    window.open(waUrl, '_blank', 'noopener');
  };

  return (
    <div data-f="F-00-137 F-08-103" className="mx-auto flex w-full max-w-[760px] flex-col gap-6 pb-28">
      <PageHeader title={t('order.title')} description={t('order.subtitle')} />

      {!q.isLoading && items.length === 0 ? (
        <EmptyState icon={<PackageSearch aria-hidden />} title={t('order.emptyTitle')} description={t('order.emptyText')} />
      ) : (
        <>
          <SectionCard
            title={t('order.listTitle')}
            actions={
              // Все отмечены сразу после загрузки — пока грузится, та же «Снять все» (неактивна)
              <Button variant="ghost" size="sm" onClick={toggleAll} disabled={q.isLoading}>
                {allChecked || q.isLoading ? t('order.uncheckAll') : t('order.checkAll')}
              </Button>
            }
          >
            <ul className="flex flex-col gap-2" aria-hidden={q.isLoading || undefined}>
              {q.isLoading && Array.from({ length: skeletonRows }, (_, i) => <OrderItemSkeleton key={i} />)}
              {items.map((i) => {
                const unit = unitShort(i.unit);
                const off = unchecked.has(i.goodId);
                const text = qtyDraft[i.goodId] ?? String(i.toOrder);
                const invalid = !off && !(parseQty(text) > 0);
                return (
                  <li key={i.goodId} className="flex flex-col gap-2">
                    <div className={ITEM_ROW}>
                      <Checkbox checked={!off} onCheckedChange={() => toggle(i.goodId)} aria-label={i.name} />
                      <div className={ITEM_TEXT}>
                        <p className="truncate text-sm font-medium text-fg">{i.name}</p>
                        <p className="truncate text-xs text-muted">
                          {t('order.stockLine', { stock: formatQty(i.totalStock), critical: formatQty(i.criticalStock), unit })}
                        </p>
                      </div>
                      <div className={ITEM_QTY}>
                        <Input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          step="any"
                          value={text}
                          invalid={invalid}
                          disabled={off}
                          onChange={(e) => setQtyDraft((prev) => ({ ...prev, [i.goodId]: e.target.value }))}
                          className="w-24"
                          aria-label={t('order.qtyLabel', { name: i.name })}
                        />
                        <span className={ITEM_UNIT}>{unit}</span>
                      </div>
                    </div>
                    {/* F-00-165: предложение поставщика рядом с товаром на исходе — только у мастеров, включивших приём предложений */}
                    {businessId && <SupplierOfferCard businessId={businessId} productName={i.name} />}
                  </li>
                );
              })}
            </ul>
          </SectionCard>

          <SectionCard title={t('order.supplierTitle')}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label={t('operationForm.supplier')} optional>
                <Combobox
                  options={counterparties.map((c) => ({ value: c.id, label: c.name, description: c.phone }))}
                  value={effectiveSupplierId || null}
                  onValueChange={(v) => pickSupplier(v)}
                  loading={counterpartiesQ.isLoading}
                  placeholder={t('order.supplierPlaceholder')}
                  emptyText={t('supplier.empty')}
                />
              </FormField>
              <FormField label={t('order.supplierPhone')} hint={t('order.supplierPhoneHint')}>
                <PhoneInput value={phone} onValueChange={setPhoneDraft} />
              </FormField>
              <FormField label={t('order.messageLang')} hint={t('order.messageLangHint')}>
                <Select
                  options={(['hy', 'ru', 'en'] as const).map((l) => ({ value: l, label: LANG_LABEL[l] }))}
                  value={messageLang}
                  onValueChange={(v) => setLangDraft(v as LocaleCode)}
                />
              </FormField>
            </div>
          </SectionCard>

          <StickyActionBar>
            <Button leftIcon={<MessageCircle aria-hidden />} disabled={q.isLoading || !waUrl || selected.length === 0} onClick={send}>
              {t('order.sendWhatsApp', { count: selected.length })}
            </Button>
          </StickyActionBar>
        </>
      )}
    </div>
  );
}
