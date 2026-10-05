'use client';

/**
 * «Приложение» → визит и оплата (F-14-092, F-14-094…098, F-14-102, F-14-074). Демо-симуляция мобильного
 * приложения для бизнеса (Altegio.me): открыть сегодняшний визит, продать товар/абонемент/сертификат,
 * принять оплату наличными/картой/лояльностью (частями), выдать карту лояльности, отправить клиенту пуш.
 * Деньги через нас не идут — только фиксируется способ и сумма (⭐ решение, F-00-126, F-00-194).
 */
import { useState } from 'react';
import { Banknote, CalendarClock, Check, CreditCard, Gift, MessageSquare, Receipt, Search, Sparkles, Trash2, Undo2 } from 'lucide-react';
import {
  addVisitPayment,
  addVisitSaleLine,
  buildVisitReceiptText,
  CARD_COMMISSION_PERCENT,
  countVisitLoyaltyOptions,
  findLoyaltyByCode,
  generateSaleCode,
  getVisitDetail,
  isVisitReceiptSent,
  issueLoyaltyCard,
  listCashDesks,
  listVisitCandidates,
  refundVisitPayment,
  removeVisitPayment,
  removeVisitSaleLine,
  sendOneOffPush,
  sendVisitReceipt,
  type LoyaltyCodeMatch,
} from '@/api/client';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import type { Id } from '@/domain/core';
import type { VisitPaymentMethod } from '@/domain/client';
import { useClientFormat } from '@/areas/client/useClientFormat';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { Modal } from '@/ui/Modal';
import { MoneyInput } from '@/ui/MoneyInput';
import { PageHeader } from '@/ui/PageHeader';
import { usePagedList } from '@/ui/Pagination';
import { Select } from '@/ui/Select';
import { SectionCard } from '@/ui/SectionCard';
import { Skeleton } from '@/ui/Skeleton';
import { Tabs } from '@/ui/Tabs';
import { Textarea } from '@/ui/Textarea';
import { useToast } from '@/ui/Toast';
import { ExitHold } from '@/ui/ExitHold';

export function VisitAppScreen() {
  const t = useT('client');
  const fmt = useClientFormat();
  const { ready, businessId, staffId } = useCurrent();
  const [openId, setOpenId] = useState<Id | undefined>(undefined);

  const list = useApiQuery(['visit-candidates', businessId, staffId], () => listVisitCandidates(businessId!, staffId), {
    enabled: ready && Boolean(businessId),
  });
  // Постранично, как во всех списках (DESIGN.md → Long lists)
  const { pageItems, pager } = usePagedList(list.data ?? []);

  return (
    <div data-f="F-14-092 F-14-094 F-14-095 F-14-096 F-14-097 F-14-098 F-14-102" className="flex flex-col gap-6">
      <PageHeader title={t('apps.visit.title')} description={t('apps.visit.subtitle')} />

      {!ready || list.isLoading ? (
        <Skeleton lines={4} />
      ) : list.isError ? (
        <ErrorState onRetry={() => void list.refetch()} />
      ) : !list.data?.length ? (
        <EmptyState icon={<CalendarClock aria-hidden className="size-8 text-muted" />} title={t('apps.visit.empty')} />
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {pageItems.map(({ booking, clientName }) => (
              <li key={booking.id}>
                <Card
                  interactive
                  padding="sm"
                  className="flex items-center justify-between gap-3"
                  onClick={() => setOpenId(booking.id)}
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-fg">{clientName || t('apps.visit.guest')}</p>
                    {/* Время — формат языка и 12/24 ч из настроек, не зашитый ru-RU */}
                    <p className="text-sm text-muted">{fmt.time(booking.start)}</p>
                  </div>
                  <Badge tone={booking.status === 'arrived' ? 'success' : 'neutral'} variant="soft">
                    {t(`apps.visit.status.${booking.status}` as 'apps.visit.status.arrived')}
                  </Badge>
                </Card>
              </li>
            ))}
          </ul>
          {pager}
        </>
      )}

      <ExitHold value={openId}>{(openId) => <VisitModal bookingId={openId} onClose={() => setOpenId(undefined)} onChanged={() => void list.refetch()} />}</ExitHold>
    </div>
  );
}

function VisitModal({ bookingId, onClose, onChanged }: { bookingId: Id; onClose: () => void; onChanged: () => void }) {
  const t = useT('client');
  const fmt = useClientFormat();
  const toast = useToast();
  const { businessId } = useCurrent();
  const [tab, setTab] = useState<'sale' | 'pay' | 'loyalty'>('sale');

  const detail = useApiQuery(['visit-detail', bookingId], () => getVisitDetail(bookingId));

  const desks = useApiQuery(['cash-desks', businessId, bookingId], () => listCashDesks(businessId ?? undefined, bookingId));
  const loyaltyCount = useApiQuery(
    ['visit-loyalty-count', bookingId],
    () => countVisitLoyaltyOptions(detail.data?.booking.appUserId, businessId!),
    { enabled: Boolean(detail.data) && Boolean(businessId) },
  );

  const refetchAll = () => {
    void detail.refetch();
    onChanged();
  };

  if (detail.isLoading) {
    return (
      <Modal open onOpenChange={onClose} title={t('apps.visit.title')} size="lg">
        <Skeleton lines={5} />
      </Modal>
    );
  }
  if (detail.isError || !detail.data) {
    return (
      <Modal open onOpenChange={onClose} title={t('apps.visit.title')} size="lg">
        <ErrorState onRetry={() => void detail.refetch()} />
      </Modal>
    );
  }

  const { booking, clientName, saleLines, payments, dueTotal, paidTotal, remaining } = detail.data;
  const canPay = booking.status === 'arrived';

  return (
    <Modal open onOpenChange={onClose} title={clientName || t('apps.visit.guest')} description={fmt.dateTime(booking.start)} size="lg">
      <div className="flex flex-col gap-4">
        <Card padding="sm" className="flex items-center justify-between bg-surface-2">
          <span className="text-sm text-muted">{t('apps.visit.due')}</span>
          <span className="text-lg font-semibold text-fg">{fmt.money(dueTotal)}</span>
        </Card>

        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as typeof tab)}
          items={[
            { value: 'sale', label: t('apps.visit.tabSale') },
            { value: 'pay', label: t('apps.visit.tabPay') },
            { value: 'loyalty', label: `${t('apps.visit.tabLoyalty')}${loyaltyCount.data ? ` (${loyaltyCount.data})` : ''}` },
          ]}
        />

        {tab === 'sale' && (
          <SaleTab bookingId={bookingId} saleLines={saleLines} onChanged={refetchAll} />
        )}

        {tab === 'pay' && (
          <PayTab
            bookingId={bookingId}
            appUserId={booking.appUserId}
            businessId={businessId}
            canPay={canPay}
            remaining={remaining}
            paidTotal={paidTotal}
            payments={payments}
            desks={desks.data ?? []}
            onChanged={refetchAll}
          />
        )}

        {tab === 'loyalty' && (
          <LoyaltyTab
            appUserId={booking.appUserId}
            businessId={businessId}
            count={loyaltyCount.data ?? 0}
            onChanged={() => void loyaltyCount.refetch()}
          />
        )}

        <div data-f="F-14-074" className="border-t border-border pt-3">
          <PushComposer
            disabled={!booking.appUserId}
            onSend={async (text) => {
              if (!booking.appUserId || !businessId) return;
              await sendOneOffPush({ appUserId: booking.appUserId, businessId, bookingId: booking.id, text });
              toast.success(t('apps.visit.pushSent'));
            }}
          />
        </div>
      </div>
    </Modal>
  );
}

function SaleTab({
  bookingId,
  saleLines,
  onChanged,
}: {
  bookingId: Id;
  saleLines: { id: Id; kind: 'product' | 'membership' | 'certificate'; title: string; price: number; discount: number; code?: string }[];
  onChanged: () => void;
}) {
  const t = useT('client');
  const fmt = useClientFormat();
  const toast = useToast();
  const [kind, setKind] = useState<'product' | 'membership' | 'certificate'>('product');
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState(0);
  const [code, setCode] = useState('');

  const add = useApiMutation(addVisitSaleLine);
  const remove = useApiMutation(removeVisitSaleLine);
  const genCode = useApiMutation(generateSaleCode);

  const handleAdd = async () => {
    if (!title.trim() || price <= 0) {
      toast.error(t('apps.visit.saleValidation'));
      return;
    }
    try {
      await add.mutate({ bookingId, kind, title: title.trim(), price, code: kind === 'product' ? undefined : code || undefined });
      setTitle('');
      setPrice(0);
      setCode('');
      onChanged();
      toast.success(t('apps.visit.saleAdded'));
    } catch {
      toast.error(t('apps.visit.saleValidation'));
    }
  };

  return (
    <div data-f="F-14-092" className="flex flex-col gap-4">
      {saleLines.length > 0 && (
        <ul className="flex flex-col gap-2">
          {saleLines.map((line) => (
            <li key={line.id}>
              <Card padding="sm" className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-fg">{line.title}</p>
                  <p className="text-xs text-muted">
                    {t(`apps.visit.kind.${line.kind}` as 'apps.visit.kind.product')}
                    {line.code ? ` · ${line.code}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-fg">{fmt.money(line.price - line.discount)}</span>
                  <button
                    type="button"
                    aria-label={t('apps.visit.removeSale')}
                    className="flex size-11 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-danger"
                    onClick={() => remove.mutate(line.id).then(onChanged).catch(() => toast.error(t('apps.visit.actionFailed')))}
                  >
                    <Trash2 aria-hidden className="size-4" />
                  </button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <SectionCard title={t('apps.visit.addSale')}>
        <div className="flex flex-col gap-3">
          <FormField label={t('apps.visit.kindLabel')}>
            <Select
              options={[
                { value: 'product', label: t('apps.visit.kind.product') },
                { value: 'membership', label: t('apps.visit.kind.membership') },
                { value: 'certificate', label: t('apps.visit.kind.certificate') },
              ]}
              value={kind}
              onValueChange={(v) => setKind(v as typeof kind)}
            />
          </FormField>
          <FormField label={t('apps.visit.titleLabel')}>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('apps.visit.titlePlaceholder')} />
          </FormField>
          <FormField label={t('apps.visit.priceLabel')}>
            <MoneyInput value={price} onValueChange={(v) => setPrice(v ?? 0)} />
          </FormField>
          {kind !== 'product' && (
            <FormField label={t('apps.visit.codeLabel')}>
              <div className="flex gap-2">
                <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder={t('apps.visit.codePlaceholder')} className="flex-1" />
                <Button
                  variant="secondary"
                  loading={genCode.isPending}
                  onClick={() => void genCode.mutate(undefined).then(setCode)}
                >
                  {t('apps.visit.generateCode')}
                </Button>
              </div>
            </FormField>
          )}
          <Button loading={add.isPending} onClick={() => void handleAdd()}>
            {t('apps.visit.addSaleCta')}
          </Button>
        </div>
      </SectionCard>
    </div>
  );
}

function PayTab({
  bookingId,
  appUserId,
  businessId,
  canPay,
  remaining,
  paidTotal,
  payments,
  desks,
  onChanged,
}: {
  bookingId: Id;
  appUserId?: Id;
  businessId?: Id;
  canPay: boolean;
  remaining: number;
  paidTotal: number;
  payments: { id: Id; method: VisitPaymentMethod; amount: number; cashDeskId?: Id; cardBrand?: 'visa' | 'mastercard' | 'arca'; commissionPercent?: number; refundedAt?: string }[];
  desks: { id: Id; name: string }[];
  onChanged: () => void;
}) {
  const t = useT('client');
  const fmt = useClientFormat();
  const toast = useToast();
  const [method, setMethod] = useState<VisitPaymentMethod>('cash');
  const [amount, setAmount] = useState(remaining);
  const [pickedDeskId, setDeskId] = useState('');
  // Кассы приходят с сервера позже окна: пока не выбрана — первая касса филиала («все кассы» — 'all')
  const deskId = pickedDeskId === 'all' || desks.some((d) => d.id === pickedDeskId) ? pickedDeskId : (desks[0]?.id ?? '');
  const [brand, setBrand] = useState<'visa' | 'mastercard' | 'arca'>('visa');

  const pay = useApiMutation(addVisitPayment);
  const remove = useApiMutation(removeVisitPayment);
  const refund = useApiMutation(refundVisitPayment);

  if (!canPay) {
    return (
      <EmptyState
        icon={<Banknote aria-hidden className="size-8 text-muted" />}
        title={t('apps.visit.payNotAvailable')}
        description={t('apps.visit.payNotAvailableHint')}
      />
    );
  }

  const fullyPaid = remaining <= 0;

  return (
    <div data-f="F-14-094 F-14-095 F-14-096 F-14-097" className="flex flex-col gap-4">
      {payments.length > 0 && (
        <ul className="flex flex-col gap-2">
          {payments.map((p) => (
            <li key={p.id}>
              <Card padding="sm" className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-fg">
                    {t(`apps.visit.method.${p.method}` as 'apps.visit.method.cash')}
                    {p.method === 'card' && p.cardBrand ? ` · ${p.cardBrand.toUpperCase()}` : ''}
                  </p>
                  <p className="text-xs text-muted">
                    {p.method === 'cash' ? desks.find((d) => d.id === p.cashDeskId)?.name : null}
                    {p.commissionPercent ? ` · ${t('apps.visit.commission', { percent: p.commissionPercent })}` : ''}
                    {p.refundedAt ? ` · ${t('apps.visit.refunded')}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={p.refundedAt ? 'text-sm font-medium text-muted line-through' : 'text-sm font-medium text-fg'}>{fmt.money(p.amount)}</span>
                  {!p.refundedAt && (
                    <>
                      <button
                        type="button"
                        aria-label={t('apps.visit.refundCta')}
                        className="flex size-11 items-center justify-center rounded-full text-muted hover:bg-surface-2"
                        onClick={() =>
                          void refund
                            .mutate(p.id)
                            .then(() => {
                              toast.success(t('apps.visit.refundDone'));
                              onChanged();
                            })
                            .catch(() => toast.error(t('apps.visit.actionFailed')))
                        }
                      >
                        <Undo2 aria-hidden className="size-4" />
                      </button>
                      <button
                        type="button"
                        aria-label={t('apps.visit.removeSale')}
                        className="flex size-11 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-danger"
                        onClick={() => void remove.mutate(p.id).then(onChanged).catch(() => toast.error(t('apps.visit.actionFailed')))}
                      >
                        <Trash2 aria-hidden className="size-4" />
                      </button>
                    </>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {fullyPaid ? (
        <div className="flex flex-col gap-3">
          <Card padding="sm" className="flex items-center gap-2 bg-success-soft text-success">
            <Check aria-hidden className="size-5 shrink-0" />
            <span className="text-sm font-medium">{t('apps.visit.paidInFull', { amount: fmt.money(paidTotal) })}</span>
          </Card>
          <ReceiptCard bookingId={bookingId} appUserId={appUserId} businessId={businessId} total={paidTotal} />
        </div>
      ) : (
        <SectionCard title={t('apps.visit.addPayment')}>
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-3 gap-2">
              {(['cash', 'card', 'loyalty'] as VisitPaymentMethod[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethod(m)}
                  className={`flex min-h-11 items-center justify-center gap-1.5 rounded-lg border px-2 text-sm font-medium transition-colors ${
                    method === m ? 'border-primary bg-primary-soft text-primary-text' : 'border-border bg-surface text-fg'
                  }`}
                >
                  {m === 'cash' && <Banknote aria-hidden className="size-4" />}
                  {m === 'card' && <CreditCard aria-hidden className="size-4" />}
                  {m === 'loyalty' && <Sparkles aria-hidden className="size-4" />}
                  {t(`apps.visit.method.${m}`)}
                </button>
              ))}
            </div>

            {method === 'card' && (
              <FormField
                label={t('apps.visit.cardBrandLabel')}
                hint={t('apps.visit.commissionHint', { percent: CARD_COMMISSION_PERCENT[brand] })}
              >
                <Select
                  options={(['visa', 'mastercard', 'arca'] as const).map((b) => ({ value: b, label: b.toUpperCase() }))}
                  value={brand}
                  onValueChange={(v) => setBrand(v as typeof brand)}
                />
              </FormField>
            )}

            {method === 'cash' && desks.length > 1 && (
              <FormField label={t('apps.visit.cashDeskLabel')}>
                <Select
                  options={[{ value: 'all', label: t('apps.visit.allCashDesks') }, ...desks.map((d) => ({ value: d.id, label: d.name }))]}
                  value={deskId}
                  onValueChange={setDeskId}
                />
              </FormField>
            )}

            <FormField label={t('apps.visit.amountLabel')}>
              <MoneyInput value={amount} onValueChange={(v) => setAmount(v ?? 0)} />
            </FormField>

            <div className="flex gap-2">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setAmount(remaining)}
              >
                {t('apps.visit.fullAmount')}
              </Button>
              <Button
                className="flex-1"
                loading={pay.isPending}
                onClick={() =>
                  void pay
                    .mutate({
                      bookingId,
                      method,
                      amount,
                      cashDeskId: deskId === 'all' || !deskId ? undefined : deskId,
                      cardBrand: method === 'card' ? brand : undefined,
                    })
                    .then(() => {
                      onChanged();
                      setAmount(0);
                      toast.success(t('apps.visit.paymentAdded'));
                    })
                    .catch(() => toast.error(t('apps.visit.actionFailed')))
                }
              >
                {t('apps.visit.payCta')}
              </Button>
            </div>
          </div>
        </SectionCard>
      )}
    </div>
  );
}

/** Квитанция об оплате визита — скачать и отправить клиенту (F-14-095) */
function ReceiptCard({ bookingId, appUserId, businessId, total }: { bookingId: Id; appUserId?: Id; businessId?: Id; total: number }) {
  const t = useT('client');
  const toast = useToast();
  const fmt = useClientFormat();
  const detail = useApiQuery(['visit-detail-receipt', bookingId], () => getVisitDetail(bookingId));
  const sentQ = useApiQuery(['visit-receipt-sent', bookingId], () => isVisitReceiptSent(bookingId));
  const send = useApiMutation(sendVisitReceipt);

  const download = () => {
    if (!detail.data) return;
    const text = buildVisitReceiptText(detail.data);
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `receipt-${bookingId.slice(-6)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t('apps.visit.receiptDownloaded'));
  };

  return (
    <div data-f="F-14-095">
      <SectionCard title={t('apps.visit.receiptTitle')} description={t('apps.visit.receiptHint', { amount: fmt.money(total) })}>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" leftIcon={<Receipt aria-hidden />} onClick={download} disabled={!detail.data}>
            {t('apps.visit.downloadReceiptCta')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<MessageSquare aria-hidden />}
            loading={send.isPending}
            disabled={!appUserId || !businessId || sentQ.data === true}
            onClick={() =>
              appUserId &&
              businessId &&
              void send
                .mutate({ bookingId, appUserId, businessId, total })
                .then(() => {
                  toast.success(t('apps.visit.receiptSent'));
                  void sentQ.refetch();
                })
                .catch(() => toast.error(t('apps.visit.actionFailed')))
            }
          >
            {sentQ.data ? t('apps.visit.receiptAlreadySent') : t('apps.visit.sendReceiptCta')}
          </Button>
        </div>
        {!appUserId && <p className="mt-2 text-xs text-muted">{t('apps.visit.receiptNeedsApp')}</p>}
      </SectionCard>
    </div>
  );
}

function LoyaltyTab({ appUserId, businessId, count, onChanged }: { appUserId?: Id; businessId?: Id; count: number; onChanged: () => void }) {
  const t = useT('client');
  const toast = useToast();
  const [cardNumber, setCardNumber] = useState('');
  const [code, setCode] = useState('');
  const [codeResult, setCodeResult] = useState<LoyaltyCodeMatch | 'not_found' | undefined>(undefined);
  const issue = useApiMutation(({ appUserId, businessId, cardNumber }: { appUserId: Id; businessId: Id; cardNumber?: string }) =>
    issueLoyaltyCard(appUserId, businessId, cardNumber),
  );
  const searchCode = useApiMutation(({ businessId, code }: { businessId: Id; code: string }) => findLoyaltyByCode(businessId, code));

  return (
    <div data-f="F-14-098 F-14-102" className="flex flex-col gap-4">
      {appUserId && <p className="text-sm text-muted">{t('apps.visit.loyaltyCount', { count })}</p>}

      {/* Поиск по коду работает всегда — для лояльности, не привязанной к этому клиенту визита (F-14-098) */}
      <SectionCard title={t('apps.visit.codeSearchTitle')} description={t('apps.visit.codeSearchHint')}>
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <Input
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setCodeResult(undefined);
              }}
              placeholder={t('apps.visit.codeSearchPlaceholder')}
              className="flex-1"
            />
            <Button
              variant="secondary"
              leftIcon={<Search aria-hidden />}
              loading={searchCode.isPending}
              disabled={!code.trim() || !businessId}
              onClick={() =>
                businessId &&
                void searchCode.mutate({ businessId, code }).then((res) => setCodeResult(res ?? 'not_found'))
              }
            >
              {t('apps.visit.codeSearchCta')}
            </Button>
          </div>
          {codeResult === 'not_found' && <p className="text-sm text-danger">{t('apps.visit.codeNotFound')}</p>}
          {codeResult && codeResult !== 'not_found' && (
            <Card padding="sm" className="flex items-center justify-between bg-surface-2">
              <div>
                <p className="text-sm font-medium text-fg">{codeResult.code}</p>
                <p className="text-xs text-muted">
                  {t(`apps.visit.kind.${codeResult.kind === 'certificate' ? 'certificate' : 'membership'}` as 'apps.visit.kind.certificate')} ·{' '}
                  {codeResult.clientName}
                </p>
              </div>
              <Badge tone="success" variant="soft">
                {codeResult.balance} ֏
              </Badge>
            </Card>
          )}
        </div>
      </SectionCard>

      {appUserId ? (
        <SectionCard title={t('apps.visit.issueCardTitle')} description={t('apps.visit.issueCardHint')}>
          <div className="flex flex-col gap-3">
            <FormField label={t('apps.visit.cardNumberLabel')}>
              <Input value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} placeholder={t('apps.visit.cardNumberPlaceholder')} />
            </FormField>
            <Button
              loading={issue.isPending}
              onClick={() =>
                businessId &&
                void issue
                  .mutate({ appUserId, businessId, cardNumber: cardNumber || undefined })
                  .then((card) => {
                    toast.success(t('apps.visit.cardIssued', { number: card.cardNumber }));
                    setCardNumber('');
                    onChanged();
                  })
                  .catch(() => toast.error(t('apps.visit.actionFailed')))
              }
            >
              {t('apps.visit.issueCardCta')}
            </Button>
          </div>
        </SectionCard>
      ) : (
        <EmptyState icon={<Gift aria-hidden className="size-8 text-muted" />} title={t('apps.visit.loyaltyNoClient')} compact />
      )}
    </div>
  );
}

function PushComposer({ disabled, onSend }: { disabled: boolean; onSend: (text: string) => Promise<void> }) {
  const t = useT('client');
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  if (disabled) {
    return <p className="text-sm text-muted">{t('apps.visit.pushNeedsApp')}</p>;
  }

  if (!open) {
    return (
      <Button variant="ghost" leftIcon={<MessageSquare aria-hidden />} onClick={() => setOpen(true)}>
        {t('apps.visit.sendPushCta')}
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder={t('apps.visit.pushPlaceholder')} />
      <div className="flex gap-2">
        <Button
          variant="secondary"
          className="flex-1"
          onClick={() => {
            setOpen(false);
            setText('');
          }}
        >
          {t('apps.visit.pushCancelCta')}
        </Button>
        <Button
          className="flex-1"
          loading={sending}
          disabled={!text.trim()}
          onClick={async () => {
            setSending(true);
            try {
              await onSend(text.trim());
              setOpen(false);
              setText('');
            } catch {
              toast.error(t('apps.visit.actionFailed'));
            } finally {
              setSending(false);
            }
          }}
        >
          {t('apps.visit.pushSendCta')}
        </Button>
      </div>
    </div>
  );
}
