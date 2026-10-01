'use client';

/**
 * Вклад раздела «finance» в окно записи (хост «bookingWindow», F-01-037) — вкладка «Оплата».
 * F-07-036 (кнопка «Оплатить» и смена статуса визита при первой оплате), F-07-037/038 (быстрая и
 * раздельная оплата), F-07-039/181 (итог и платежи по строкам визита), F-07-040/041 (лояльность первой,
 * скидка по акции строкой), F-07-042/043 (отмена и детали платежа), F-07-045 (статус оплаты визита),
 * F-07-047 (примечание к оплате), F-07-061/062 (⭐ демо-минимум оплаты со счёта клиента, включая долг —
 * полный учёт типов счетов и лимитов строит b03), F-07-066/067 (полный/частичный возврат — ОТДЕЛЬНОЙ операцией
 * «Возврат», исходная оплата остаётся, fin-review Ф7/Ф8), F-07-074 (напоминание вернуть предоплату при отменённой записи).
 * b04: F-07-079…081 (ссылка на оплату визита в вкладке «Оплата»: создать/скопировать/QR/«Я оплатил»/отменить,
 * частичная сумма). Фискальный чек — армянский ՀԴՄ (e-HDM), подсказкой (fin-review Ф4).
 * fin-review 27.09: подтверждение быстрой оплаты с «получено/сдача» (Ф9), «за что платят» (Ф10), один платёж —
 * одна строка (Ф11), раздельная оплата со счётом — одна транзакция (Ф12), телефон (Ф13), примечание (Ф14).
 * Смотреть без хозяина хоста: /dev/ext/bookingWindow/finance
 */
import { useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Banknote, Check, Copy, CreditCard, Printer, QrCode, Receipt, RotateCcw, Tag, Wallet, X } from 'lucide-react';
import {
  addBookingPromoDiscount,
  cancelPaymentLink,
  createPaymentLink,
  getBookingPaymentSummary,
  getFinanceRights,
  getFiscalSettings,
  getPaymentLinkForBooking,
  listBookingPaymentTiles,
  markPaymentLinkPaid,
  payBookingFromClientAccount,
  payBookingQuick,
  payBookingSplit,
  refundBookingFull,
  refundBookingPayment,
  removeBookingPaymentLine,
  setBookingPaymentNote,
  type SplitPaymentPart,
} from '@/api/finance';
import { copyText } from '@/areas/finance/copyText';
import { PaymentHistory } from '@/areas/finance/extensions/payment/PaymentHistory';
import { QuickPayModal } from '@/areas/finance/extensions/payment/QuickPayModal';
import { RefundModal, type RefundTarget } from '@/areas/finance/extensions/payment/RefundModal';
import { VisitLines } from '@/areas/finance/extensions/payment/VisitLines';
import { useLoyaltyBridge } from '@/areas/finance/extensions/payment/useLoyaltyBridge';
import { PolicyBookingBlock } from '@/areas/finance/policy/PolicyBookingBlock';
import { syncVisitGoodsSale } from '@/api/journal';
import { ApiError } from '@/api/request';
import { calcAcquiringFee, groupBookingPayments, paymentLinkIsLive, type BookingPaymentGroup, type PaymentMethodTile } from '@/domain/finance';
import { useCurrent } from '@/demo/hooks';
import { useApiMutation, useApiQuery } from '@/api/request';
import type { BookingWindowExtProps } from '@/extensions/types';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { IconButton } from '@/ui/IconButton';
import { Input } from '@/ui/Input';
import { Modal } from '@/ui/Modal';
import { MoneyInput } from '@/ui/MoneyInput';
import { SectionCard } from '@/ui/SectionCard';
import { Skeleton, SkeletonText } from '@/ui/Skeleton';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { useConfirm, useToast } from '@/ui/Toast';
import { cn } from '@/lib/cn';

const METHOD_ICON: Record<string, typeof Banknote> = { cash: Banknote, card: CreditCard };

function demoQrCells(seed: string): boolean[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return Array.from({ length: 81 }, (_, i) => {
    h = (h * 1103515245 + 12345) >>> 0;
    return ((h >> (i % 24)) & 1) === 1;
  });
}

export default function FinanceBookingWindow({ mode, bookingId, businessId }: BookingWindowExtProps) {
  const t = useT('finance');
  const format = useFormat();
  const toast = useToast();
  const confirm = useConfirm();

  const [payTab, setPayTab] = useState<'quick' | 'split' | 'link'>('quick');
  const [linkAmount, setLinkAmount] = useState<number | undefined>(undefined);
  const [linkQrOpen, setLinkQrOpen] = useState(false);
  const [splitParts, setSplitParts] = useState<Record<string, number | undefined>>({});
  const [promoOpen, setPromoOpen] = useState(false);
  const [promoLabel, setPromoLabel] = useState('');
  const [promoAmount, setPromoAmount] = useState<number | undefined>(undefined);
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountAmount, setAccountAmount] = useState<number | undefined>(undefined);
  const [note, setNote] = useState<string | null>(null);
  const [quickTile, setQuickTile] = useState<PaymentMethodTile | null>(null);
  const [refundTarget, setRefundTarget] = useState<RefundTarget | null>(null);

  const { staffId } = useCurrent();
  const rightsQ = useApiQuery(['finance', 'rights', businessId, staffId], () => getFinanceRights(businessId, staffId!), {
    enabled: Boolean(staffId),
  });
  const rights = rightsQ.data;

  const summaryQ = useApiQuery(['finance', 'bookingPayment', businessId, bookingId], () => getBookingPaymentSummary(businessId, bookingId!), {
    enabled: mode === 'edit' && Boolean(bookingId),
  });
  // Ф4: напоминание пробить чек ՀԴՄ на своём аппарате (интеграции нет) — включается в «Фискализации»
  const fiscalQ = useApiQuery(['finance', 'fiscalSettings', businessId], () => getFiscalSettings(businessId), { enabled: Boolean(businessId) && mode === 'edit' });
  const tilesQ = useApiQuery(['finance', 'paymentTiles', businessId], () => listBookingPaymentTiles(businessId), { enabled: Boolean(businessId) });
  const clientId = summaryQ.data?.booking.clientId;
  // loyalty-review: «Личный счёт клиента» — счета раздела «Лояльность» (один источник), кэшбэк — сверка после оплаты
  const loyalty = useLoyaltyBridge(businessId, clientId, staffId, bookingId);

  const quickM = useApiMutation((args: { methodKey: string }) => payBookingQuick(businessId, bookingId!, args.methodKey));
  const splitM = useApiMutation((parts: SplitPaymentPart[]) => payBookingSplit(businessId, bookingId!, parts));
  const promoM = useApiMutation((args: { label: string; amount: number }) =>
    addBookingPromoDiscount(businessId, bookingId!, args.label, args.amount),
  );
  const accountM = useApiMutation((args: { amount: number; accountId: string; debt: boolean }) =>
    payBookingFromClientAccount(businessId, bookingId!, clientId!, args.amount, { accountId: args.accountId, debt: args.debt }),
  );
  const removeM = useApiMutation((paymentLineId: string) => removeBookingPaymentLine(businessId, paymentLineId));
  const noteM = useApiMutation((text: string) => setBookingPaymentNote(businessId, bookingId!, text));
  const refundFullM = useApiMutation((reason: string) => refundBookingFull(businessId, bookingId!, reason));
  const refundPartM = useApiMutation((args: { lineId: string; amount: number; reason: string }) => refundBookingPayment(businessId, args.lineId, args.amount, args.reason));

  // F-07-079…081 — ссылка на оплату визита: создать/скопировать/QR/«Я оплатил»/отменить, частичная сумма
  const linkQ = useApiQuery(['finance', 'paymentLink', businessId, bookingId], () => getPaymentLinkForBooking(businessId, bookingId!), {
    enabled: mode === 'edit' && Boolean(bookingId),
  });
  const createLinkM = useApiMutation((amount: number) =>
    createPaymentLink(businessId, { targetKind: 'booking', bookingId: bookingId!, amount, remainingBefore: summaryQ.data?.due ?? amount }),
  );
  // Не `linkQ.data!.id`: React Compiler по «!» считает linkQ.data не-null и выносит чтение поля в рендер.
  const linkId = linkQ.data?.id;
  const markPaidM = useApiMutation(() => {
    if (!linkId) throw new Error('payment link is not loaded');
    return markPaymentLinkPaid(businessId, linkId);
  });
  const cancelLinkM = useApiMutation(() => {
    if (!linkId) throw new Error('payment link is not loaded');
    return cancelPaymentLink(businessId, linkId);
  });

  const refetchAll = () => {
    summaryQ.refetch();
    loyalty.refetch();
  };
  // После денег — сверка кэшбэка визита с новой оплатой (раздел «Лояльность» сам не узнаёт об оплате здесь)
  // Товары визита продаёт склад: после оплаты/отмены/возврата сводим его документ продажи (в фоне, окно не ждёт)
  const afterMoney = async () => {
    if (bookingId) void syncVisitGoodsSale(bookingId);
    refetchAll();
    await loyalty.syncCashback(summaryQ.data?.booking);
  };

  // Ф9: плитка открывает подтверждение (для наличных — «получено/сдача»), деньги проводит только «Принять оплату»
  const handleQuickPay = async (methodKey: string) => {
    try {
      const next = await quickM.mutate({ methodKey });
      setQuickTile(null);
      toast.success(t('bookingPayment.paidInFull'));
      if (bookingId) void syncVisitGoodsSale(bookingId);
      refetchAll();
      await loyalty.syncCashback(next.booking);
    } catch {
      toast.error(t('bookingPayment.payFailed'));
    }
  };

  const handleCreateLink = async () => {
    const amount = linkAmount ?? due;
    if (amount <= 0 || amount > due) return;
    try {
      await createLinkM.mutate(amount);
      toast.success(t('bookingPayment.link.created'));
      linkQ.refetch();
    } catch {
      toast.error(t('bookingPayment.payFailed'));
    }
  };

  const handleCopyLink = async () => {
    if (!linkQ.data) return;
    const text = `${t('bookingPayment.link.textPrefix', { amount: format.money(linkQ.data.amount) })}\n${linkQ.data.requisitesText}`;
    if (await copyText(text)) toast.success(t('bookingPayment.link.copied'));
  };

  const handleMarkPaid = async () => {
    try {
      await markPaidM.mutate(undefined);
      toast.success(t('bookingPayment.link.markedPaid'));
      linkQ.refetch();
      await afterMoney();
    } catch {
      toast.error(t('bookingPayment.payFailed'));
    }
  };

  const handleCancelLink = async () => {
    const ok = await confirm({
      title: t('bookingPayment.link.cancelConfirmTitle'),
      description: t('bookingPayment.link.cancelConfirmText'),
      tone: 'danger',
      confirmLabel: t('bookingPayment.link.cancel'),
    });
    if (!ok) return;
    try {
      await cancelLinkM.mutate(undefined);
      toast.success(t('bookingPayment.link.cancelled'));
      linkQ.refetch();
    } catch {
      toast.error(t('bookingPayment.payFailed'));
    }
  };

  const splitTotal = Object.values(splitParts).reduce((sum: number, v) => sum + (v ?? 0), 0);

  const due = summaryQ.data?.due ?? 0;
  const prepaid = summaryQ.data?.prepaid ?? 0;
  const accountBalance = loyalty.balance;
  const debtAfter = (accountAmount ?? 0) - accountBalance;

  // Ф12: все части — и счёт клиента — одной транзакцией; уход счёта в минус — только после явного «да»
  const handleSplitPay = async () => {
    const accountAmt = splitParts.account ?? 0;
    const splitDebt = accountAmt - accountBalance;
    if (accountAmt > 0 && splitDebt > 0) {
      const ok = await confirm({
        title: t('bookingPayment.debtWarningTitle'),
        description: t('bookingPayment.debtWarningText', { amount: format.money(splitDebt) }),
        tone: 'danger',
        confirmLabel: t('bookingPayment.paySelected'),
      });
      if (!ok) return;
    }
    if (accountAmt > loyalty.maxCharge) {
      toast.error(t('bookingPayment.debtLimitExceeded'));
      return;
    }
    // Счёт лояльности списывается первым; не прошла оплата — деньги возвращаются на тот же счёт (компенсация)
    let charged: { accountId: string; debt: boolean } | null = null;
    try {
      if (accountAmt > 0) charged = await loyalty.charge(accountAmt);
      const parts: SplitPaymentPart[] = Object.entries(splitParts)
        .filter(([, amount]) => (amount ?? 0) > 0)
        .map(([methodKey, amount]) =>
          methodKey === 'account' && charged ? { methodKey, amount: amount ?? 0, loyaltyAccountId: charged.accountId, debt: charged.debt } : { methodKey, amount: amount ?? 0 },
        );
      await splitM.mutate(parts);
      toast.success(splitTotal >= due ? t('bookingPayment.paidInFull') : t('bookingPayment.paidPartially'));
      setSplitParts({});
      await afterMoney();
    } catch (e) {
      if (charged) await loyalty.giveBack(charged.accountId, accountAmt).catch(() => undefined);
      toast.error(e instanceof Error && (e.message === 'debt_limit_exceeded' || e.message === 'over_limit') ? t('bookingPayment.debtLimitExceeded') : t('bookingPayment.payFailed'));
    }
  };

  const handlePromo = async () => {
    if (!promoLabel.trim() || !promoAmount) return;
    try {
      await promoM.mutate({ label: promoLabel.trim(), amount: promoAmount });
      toast.success(t('bookingPayment.promoApply'));
      setPromoOpen(false);
      setPromoLabel('');
      setPromoAmount(undefined);
      refetchAll();
    } catch {
      toast.error(t('bookingPayment.payFailed'));
    }
  };

  const handleAccountPay = async () => {
    if (!accountAmount || accountAmount <= 0) return;
    if (debtAfter > 0) {
      const ok = await confirm({
        title: t('bookingPayment.debtWarningTitle'),
        description: t('bookingPayment.debtWarningText', { amount: format.money(debtAfter) }),
        tone: 'danger',
        confirmLabel: t('bookingPayment.payFromAccount'),
      });
      if (!ok) return;
    }
    if (accountAmount > loyalty.maxCharge) {
      toast.error(t('bookingPayment.debtLimitExceeded'));
      return;
    }
    let charged: { accountId: string; debt: boolean } | null = null;
    try {
      charged = await loyalty.charge(accountAmount);
      await accountM.mutate({ amount: accountAmount, accountId: charged.accountId, debt: charged.debt });
      toast.success(t('bookingPayment.payFromAccount'));
      setAccountOpen(false);
      setAccountAmount(undefined);
      await afterMoney();
    } catch (e) {
      if (charged) await loyalty.giveBack(charged.accountId, accountAmount).catch(() => undefined);
      toast.error(e instanceof Error && (e.message === 'debt_limit_exceeded' || e.message === 'over_limit') ? t('bookingPayment.debtLimitExceeded') : t('bookingPayment.payFailed'));
    }
  };

  const handleRemove = async (group: BookingPaymentGroup) => {
    const ok = await confirm({
      title: t('bookingPayment.removeConfirmTitle'),
      description: t('bookingPayment.removeConfirmText'),
      tone: 'danger',
      confirmLabel: t('bookingPayment.remove'),
    });
    if (!ok) return;
    try {
      await removeM.mutate(group.firstLineId);
      // Оплата со счёта лояльности — деньги возвращаются на тот же счёт
      if (group.kind === 'account' && group.loyaltyAccountId) await loyalty.giveBack(group.loyaltyAccountId, group.amount - group.refunded);
      toast.success(t('bookingPayment.removed'));
      await afterMoney();
    } catch (e) {
      toast.error(e instanceof ApiError && e.code === 'payment_has_refunds' ? t('bookingPayment.paymentHasRefunds') : t('bookingPayment.payFailed'));
    }
  };

  const handleSaveNote = async () => {
    if (note === null) return;
    try {
      await noteM.mutate(note);
      toast.success(t('bookingPayment.noteSaved'));
      setNote(null);
      refetchAll();
    } catch {
      toast.error(t('bookingPayment.payFailed'));
    }
  };

  const openPartialRefund = (g: BookingPaymentGroup) => {
    setRefundTarget({ mode: 'partial', lineId: g.firstLineId, key: g.key, label: g.methodLabel, paid: g.amount, refunded: g.refunded, toAccount: g.kind === 'account' });
  };

  // Ф7/Ф8: возврат — отдельная операция «Возврат», исходная оплата и примечание остаются
  const handleRefund = async (amount: number, reason: string) => {
    const target = refundTarget;
    if (!target) return;
    // Счета лояльности, которым вернутся деньги: до возврата — сколько по каждому ещё не возвращено
    const loyaltyBack = (summaryQ.data ? groupBookingPayments(summaryQ.data.payments) : [])
      .filter((g) => g.kind === 'account' && g.loyaltyAccountId && (target.mode === 'full' || g.key === target.key))
      .map((g) => ({ accountId: g.loyaltyAccountId!, net: g.amount - g.refunded }));
    try {
      if (target.mode === 'full') await refundFullM.mutate(reason);
      else await refundPartM.mutate({ lineId: target.lineId, amount, reason });
      for (const b of loyaltyBack) await loyalty.giveBack(b.accountId, target.mode === 'full' ? b.net : Math.min(amount, b.net));
      toast.success(t('bookingPayment.refundDone', { amount: format.money(amount) }));
      setRefundTarget(null);
      await afterMoney();
    } catch (e) {
      const code = e instanceof ApiError ? e.code : '';
      toast.error(code === 'insufficient_cash' ? t('bookingPayment.refundInsufficientCash') : t('bookingPayment.payFailed'));
    }
  };

  if (mode === 'create' || !bookingId) {
    return (
      <div data-f="F-07-036" className="px-1 py-6">
        <EmptyState
          icon={<Wallet aria-hidden className="size-8" />}
          title={t('bookingPayment.tabTitle')}
          description={t('bookingPayment.saveFirst')}
        />
      </div>
    );
  }

  if (summaryQ.isError || tilesQ.isError) {
    return (
      <div className="px-1 py-6">
        <ErrorState
          onRetry={() => {
            summaryQ.refetch();
            tilesQ.refetch();
          }}
        />
      </div>
    );
  }

  if (summaryQ.isLoading || tilesQ.isLoading || !summaryQ.data) {
    // М2: скелет — та же вкладка неоплаченного визита: «К оплате» + статус, строка услуги, «Оплата» с переключателем,
    // подсказкой и плитками способов (в тех же рамках и высотах), «Промокод»
    return (
      <div aria-busy data-f="F-07-036" className="flex flex-col gap-4 px-1 py-2">
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface-2 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <div className="flex min-w-0 flex-col">
              <span className="text-xs text-muted">{t('bookingPayment.due')}</span>
              <span className="text-xl font-semibold tabular-nums">
                <SkeletonText width="9ch" />
              </span>
            </div>
            {/* Статус длинный («Посещение не оплачено…») — той же ширины: на телефоне так же уходит на вторую строку */}
            <Badge tone="neutral">
              <SkeletonText width="30ch" />
            </Badge>
          </div>
          <ul className="flex flex-col gap-1 text-sm">
            <li className="flex min-h-6 items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-fg">
                <SkeletonText width="18ch" />
              </span>
              <span className="shrink-0 tabular-nums text-muted">
                <SkeletonText width="8ch" />
              </span>
            </li>
          </ul>
        </div>
        <SectionCard title={t('bookingPayment.tabTitle')} padding="sm">
          <SegmentedControl
            fullWidth
            size="sm"
            options={[
              { value: 'quick', label: t('bookingPayment.quickTab') },
              { value: 'split', label: t('bookingPayment.splitTab') },
              { value: 'link', label: t('bookingPayment.linkTab') },
            ]}
            value={payTab}
            onValueChange={(v) => setPayTab(v as 'quick' | 'split' | 'link')}
          />
          <p className="mt-3 text-xs text-muted">{clientId ? t('bookingPayment.loyaltyHint') : t('bookingPayment.emptyNoClient')}</p>
          <div className="mt-3 flex flex-col gap-2">
            {['8ch', '14ch', '6ch'].map((w) => (
              <div key={w} className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-border px-4">
                <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
                  <Wallet aria-hidden className="size-4 shrink-0 text-muted" />
                  <SkeletonText width={w} />
                </span>
                <span className="text-sm font-medium tabular-nums">
                  <SkeletonText width="8ch" />
                </span>
              </div>
            ))}
            <Button variant="ghost" size="sm" leftIcon={<Tag aria-hidden className="size-4" />} className="self-start" disabled>
              {t('bookingPayment.promoTitle')}
            </Button>
          </div>
        </SectionCard>
      </div>
    );
  }

  const { booking, payments, status, lineTotals, goods } = summaryQ.data;
  const visitTotal = summaryQ.data.total ?? booking.total;
  const activePayments = payments.filter((p) => !p.cancelled);
  const groups = groupBookingPayments(payments);
  const tiles = tilesQ.data ?? [];
  const noShow = booking.status === 'no_show';
  const alreadyPaid = status === 'paid';
  const refundState = summaryQ.data.refundState ?? 'none';
  const refunded = summaryQ.data.refunded ?? 0;
  // Возвращать можно то, что клиент заплатил деньгами и со счёта, за вычетом уже возвращённого
  const refundable = groups.reduce((sum, g) => (g.kind === 'discount' ? sum : sum + Math.max(0, g.amount - g.refunded)), 0);
  const statusLabel =
    refundState === 'full'
      ? t('bookingPayment.statusRefunded')
      : refundState === 'partial'
        ? t('bookingPayment.statusPartiallyRefunded')
        : alreadyPaid
          ? t('bookingPayment.paidInFull')
          : status === 'partial'
            ? t('bookingPayment.paidPartially')
            : t('bookingPayment.notPaid');
  const statusTone = refundState !== 'none' ? 'warning' : alreadyPaid ? 'success' : status === 'partial' ? 'warning' : 'neutral';
  // F-07-074 — предоплата (F-00-097, ручная по реквизитам) оплачена, а запись отменена: деньги сами не возвращаются.
  // ⭐ F-00-098/F-00-100: полный возврат — только при отмене МАСТЕРОМ. Отмена клиентом (в т.ч. поздняя,
  // booking.cancelledLate) засчитывается как неявка без возврата — напоминание тут не показываем.
  const showPrepaymentReminder = booking.status === 'cancelled_by_master' && Boolean(booking.prepayment?.paid) && activePayments.length > 0 && refundState !== 'full';
  const canDeletePaidBooking = rights ? rights.canDeletePaidBooking : true;
  const canEditPayments = booking.status !== 'arrived' || canDeletePaidBooking;
  const showPay = !alreadyPaid && !noShow;

  return (
    <div data-f="F-07-036" className="flex flex-col gap-4 px-1 py-2">
      {/* F-07-045 — статус оплаты визита; Ф10 — за что платят */}
      <div data-f="F-07-045" className="flex flex-col gap-3 rounded-xl border border-border bg-surface-2 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <div className="flex min-w-0 flex-col">
            <span className="text-xs text-muted">{alreadyPaid ? t('bookingPayment.visitTotal') : t('bookingPayment.due')}</span>
            <span className="text-xl font-semibold tabular-nums">{format.money(alreadyPaid ? visitTotal : due)}</span>
          </div>
          <Badge tone={statusTone}>{statusLabel}</Badge>
        </div>
        <VisitLines businessId={businessId} booking={booking} lineTotals={lineTotals} goods={goods} />
        {prepaid > 0 && (
          <p data-f="F-00-097" className="flex items-center justify-between gap-3 border-t border-border pt-2 text-sm">
            <span className="text-muted">{booking.prepayment?.full ? t('bookingPayment.prepaidFull') : t('bookingPayment.prepaid')}</span>
            <span className="font-medium tabular-nums">{format.money(prepaid)}</span>
          </p>
        )}
        {refunded > 0 && (
          <p className="flex items-center justify-between gap-3 border-t border-border pt-2 text-sm">
            <span className="flex items-center gap-1.5 text-muted">
              <RotateCcw aria-hidden className="size-3.5" />
              {t('bookingPayment.refundedTotal')}
            </span>
            <span className="font-medium tabular-nums">{format.money(refunded)}</span>
          </p>
        )}
      </div>

      {noShow && <p className="text-sm text-muted">{t('bookingPayment.noShowHint')}</p>}

      {/* F-07-074 — предоплата оплачена, запись отменена: сама не возвращается, напоминаем администратору */}
      {showPrepaymentReminder && (
        <div
          data-f="F-07-074 F-03-068"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/40 bg-warning-soft px-4 py-3"
        >
          <span className="flex items-center gap-2 text-sm text-warning-text">
            <AlertTriangle aria-hidden className="size-4 shrink-0" />
            {t('bookingPayment.prepaymentReminder')}
          </span>
          <Button size="sm" variant="secondary" onClick={() => setRefundTarget({ mode: 'full', amount: refundable })}>
            {t('bookingPayment.refundFull')}
          </Button>
        </div>
      )}

      {showPay && (
        <SectionCard title={t('bookingPayment.tabTitle')} padding="sm">
          {/* Ф13: короткие подписи в один ряд на всю ширину — на телефоне ничего не уезжает вбок */}
          <SegmentedControl
            fullWidth
            size="sm"
            options={[
              { value: 'quick', label: t('bookingPayment.quickTab') },
              { value: 'split', label: t('bookingPayment.splitTab') },
              { value: 'link', label: t('bookingPayment.linkTab') },
            ]}
            value={payTab}
            onValueChange={(v) => setPayTab(v as 'quick' | 'split' | 'link')}
          />

          {payTab !== 'link' &&
            (clientId ? (
              <p data-f="F-07-040" className="mt-3 text-xs text-muted">
                {t('bookingPayment.loyaltyHint')}
              </p>
            ) : (
              <p className="mt-3 text-xs text-muted">{t('bookingPayment.emptyNoClient')}</p>
            ))}

          {payTab !== 'link' && tiles.length === 0 && (
            <div className="mt-3">
              <EmptyState
                title={t('bookingPayment.emptyNoMethods')}
                icon={<Wallet aria-hidden className="size-7" />}
                action={
                  <Link href="/biz/finance/methods">
                    <Button size="sm" variant="secondary">
                      {t('bookingPayment.goToMethods')}
                    </Button>
                  </Link>
                }
              />
            </div>
          )}

          {payTab === 'link' ? (
            <div data-f="F-07-079 F-06-154" className="mt-3 flex flex-col gap-3">
              {linkQ.isLoading ? (
                <Skeleton lines={3} />
              ) : linkQ.data && paymentLinkIsLive(linkQ.data, new Date().toISOString()) ? (
                <>
                  <div data-f="F-07-080" className="flex items-center justify-between gap-2 rounded-lg bg-surface-2 px-3 py-2">
                    <Badge tone="warning">{t('bookingPayment.link.statusPending')}</Badge>
                    <span className="text-sm font-medium text-fg">{format.money(linkQ.data.amount)}</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg border border-border p-2.5">
                    <code className="flex-1 truncate text-xs text-fg">{linkQ.data.requisitesText}</code>
                    <IconButton
                      label={t('bookingPayment.link.copy')}
                      icon={<Copy aria-hidden />}
                      variant="outline"
                      size="sm"
                      onClick={handleCopyLink}
                    />
                    <IconButton
                      label={t('bookingPayment.link.showQr')}
                      icon={<QrCode aria-hidden />}
                      variant="outline"
                      size="sm"
                      onClick={() => setLinkQrOpen(true)}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" leftIcon={<Check aria-hidden className="size-4" />} loading={markPaidM.isPending} onClick={handleMarkPaid}>
                      {t('bookingPayment.link.markPaid')}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      leftIcon={<X aria-hidden className="size-4" />}
                      loading={cancelLinkM.isPending}
                      onClick={handleCancelLink}
                      className="text-danger hover:bg-danger-soft"
                    >
                      {t('bookingPayment.link.cancel')}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  {linkQ.data && (linkQ.data.status === 'expired' || linkQ.data.status === 'cancelled') && (
                    <div data-f="F-07-080" className="flex items-center justify-between gap-2 rounded-lg bg-surface-2 px-3 py-2">
                      <Badge tone="neutral">
                        {linkQ.data.status === 'expired' ? t('bookingPayment.link.statusExpired') : t('bookingPayment.link.statusCancelled')}
                      </Badge>
                      <span className="text-sm text-muted">{format.money(linkQ.data.amount)}</span>
                    </div>
                  )}
                  {/* F-07-081 — частичная оплата по ссылке: сумма может быть меньше остатка */}
                  <label data-f="F-07-081" className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium">{t('bookingPayment.link.amountLabel')}</span>
                    <MoneyInput value={linkAmount ?? due} onValueChange={setLinkAmount} />
                  </label>
                  {(linkAmount ?? due) > due && (
                    <p className="text-xs text-danger">{t('bookingPayment.amountExceedsDue', { amount: format.money(due) })}</p>
                  )}
                  {/* F-07-082 — остаток к оплате по ссылке уже включает товары/абонементы/сертификаты визита, не только услуги */}
                  <p data-f="F-07-082 F-08-074" className="text-xs text-muted">
                    {t('bookingPayment.link.coversGoods')}
                  </p>
                  <Button
                    size="sm"
                    leftIcon={<Copy aria-hidden className="size-4" />}
                    loading={createLinkM.isPending}
                    disabled={(linkAmount ?? due) <= 0 || (linkAmount ?? due) > due}
                    onClick={handleCreateLink}
                  >
                    {t('bookingPayment.link.create')}
                  </Button>
                </>
              )}
              {/* Ф4: фискальный чек в Армении — ՀԴՄ (e-HDM); интеграции нет, подсказка без обещаний о законе */}
              <p data-f="F-07-153 F-07-156" className="flex items-start gap-1.5 text-xs text-muted">
                <Receipt aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                {t('bookingPayment.link.fiscalHint')}
              </p>
              <Modal open={linkQrOpen} onOpenChange={setLinkQrOpen} title={t('bookingPayment.link.showQr')} size="sm">
                <div className="flex flex-col items-center gap-3 py-2">
                  <div className="grid grid-cols-9 gap-0.5 rounded-lg border border-border bg-surface p-3">
                    {demoQrCells(linkQ.data?.requisitesText ?? bookingId ?? '').map((on, i) => (
                      <span key={i} className={cn('block size-3 rounded-[2px]', on ? 'bg-fg' : 'bg-transparent')} />
                    ))}
                  </div>
                  <code className="text-xs text-muted">{linkQ.data?.requisitesText}</code>
                  <p className="text-center text-xs text-muted">{t('bookingPayment.link.qrDemoNote')}</p>
                </div>
              </Modal>
            </div>
          ) : payTab === 'quick' ? (
            <div data-f="F-07-037 F-07-049" className="mt-3 flex flex-col gap-2">
              {clientId && loyalty.hasAccounts && (
                <button
                  type="button"
                  onClick={() => {
                    // Сразу остаток к оплате (не больше, чем можно списать со счёта) — кнопка активна без ввода
                    setAccountAmount(loyalty.maxCharge > 0 ? Math.min(due, loyalty.maxCharge) : due);
                    setAccountOpen(true);
                  }}
                  className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-border px-4 text-left transition-colors duration-150 hover:border-primary/60 hover:bg-surface-2"
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <Wallet aria-hidden className="size-4 text-muted" />
                    {t('bookingPayment.clientAccount')}
                  </span>
                  <span className="text-xs text-muted">{t('bookingPayment.clientAccountBalance', { amount: format.money(accountBalance) })}</span>
                </button>
              )}
              {tiles.map((tile) => {
                const Icon = METHOD_ICON[tile.kind] ?? Wallet;
                // Ф10: сумма, которую примут этим способом; комиссия банка — мелко рядом, а не «1.5%» вместо суммы
                const fee = tile.feePct > 0 ? calcAcquiringFee(due, tile.feePct) : 0;
                return (
                  <button
                    key={tile.key}
                    type="button"
                    disabled={quickM.isPending}
                    onClick={() => setQuickTile(tile)}
                    className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-border px-4 text-left transition-colors duration-150 hover:border-primary/60 hover:bg-surface-2 disabled:opacity-60"
                  >
                    <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
                      <Icon aria-hidden className="size-4 shrink-0 text-muted" />
                      <span className="truncate">{tile.label}</span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end">
                      <span className="text-sm font-medium tabular-nums">{format.money(due)}</span>
                      {fee > 0 && <span className="text-xs text-muted">{t('bookingPayment.feeShort', { amount: format.money(fee) })}</span>}
                    </span>
                  </button>
                );
              })}
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<Tag aria-hidden className="size-4" />}
                onClick={() => setPromoOpen(true)}
                className="self-start"
              >
                {t('bookingPayment.promoTitle')}
              </Button>
            </div>
          ) : (
            <div data-f="F-07-038 F-07-049" className="mt-3 flex flex-col gap-3">
              {tiles.map((tile) => (
                <div key={tile.key} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 text-sm sm:w-36">{tile.label}</span>
                  <MoneyInput value={splitParts[tile.key]} onValueChange={(v) => setSplitParts((s) => ({ ...s, [tile.key]: v }))} />
                </div>
              ))}
              {clientId && loyalty.hasAccounts && (
                <div className="flex items-center gap-3">
                  <span className="w-28 shrink-0 text-sm sm:w-36">{t('bookingPayment.clientAccount')}</span>
                  <MoneyInput value={splitParts.account} onValueChange={(v) => setSplitParts((s) => ({ ...s, account: v }))} />
                </div>
              )}
              <div className="flex items-center justify-between text-sm text-muted">
                <span>{t('bookingPayment.amount')}</span>
                <span className={splitTotal > due ? 'font-medium text-danger' : 'font-medium'}>
                  {format.money(splitTotal)} / {format.money(due)}
                </span>
              </div>
              {splitTotal > due && <p className="text-xs text-danger">{t('bookingPayment.amountExceedsDue', { amount: format.money(due) })}</p>}
              <Button loading={splitM.isPending} disabled={splitTotal <= 0 || splitTotal > due} onClick={handleSplitPay}>
                {t('bookingPayment.paySelected')}
              </Button>
            </div>
          )}
        </SectionCard>
      )}

      {/* М3: «Оплачено» и примечание — только когда платежи есть, и проявляются (fade) на месте ушедших способов оплаты:
          блок способов снимается сразу, а не «тает» под вставкой сверху — так ничего не едет (CLS после оплаты 0,106 → 0) */}
      {groups.length > 0 && (
        <div className="flex animate-fade-in flex-col gap-4">
        {/* F-07-039/181/043 — платежи визита: один платёж — одна строка (Ф11), возврат — отдельно (Ф7/Ф8) */}
        <SectionCard
          title={
            <span className="flex items-center gap-2">
              <Receipt aria-hidden className="size-4 text-muted" />
              {t('bookingPayment.history')}
            </span>
          }
          padding="sm"
          actions={
            refundable > 0 && canDeletePaidBooking ? (
              <Button
                data-f="F-07-066"
                size="sm"
                variant="ghost"
                leftIcon={<RotateCcw aria-hidden className="size-4" />}
                className="text-danger hover:bg-danger-soft"
                onClick={() => setRefundTarget({ mode: 'full', amount: refundable })}
              >
                {t('bookingPayment.refundFull')}
              </Button>
            ) : undefined
          }
        >
          {groups.length === 0 ? (
            <p className="py-2 text-sm text-muted">{t('bookingPayment.nothingPaidYet')}</p>
          ) : (
            <PaymentHistory
              groups={groups}
              canRefund={canEditPayments}
              canCancel={canEditPayments}
              cancelling={removeM.isPending}
              onRefund={openPartialRefund}
              onCancel={handleRemove}
              loyaltyKeys={summaryQ.data.loyaltyGroupKeys ?? []}
            />
          )}
          {alreadyPaid && refundState === 'none' && fiscalQ.data?.armenia?.remindToPrint && (
            <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-info-soft px-3 py-2 text-xs text-info">
              <Receipt aria-hidden className="mt-0.5 size-3.5 shrink-0" />
              {t('bookingPayment.fiscalReminder')}
            </p>
          )}
          {(alreadyPaid || status === 'partial') && !noShow && (
            <Link
              data-f="F-07-043 F-07-148"
              href={`/biz/finance/receipt/${bookingId}`}
              className="mt-2 inline-flex min-h-10 items-center gap-2 rounded-lg px-1 text-sm text-primary-text underline decoration-border-strong underline-offset-2"
            >
              <Printer aria-hidden className="size-4" />
              {t('bookingPayment.printReceipt')}
            </Link>
          )}
        </SectionCard>

        {/* F-07-047 — примечание к оплате: пишется в комментарий операций-оплат; причина возврата его не трогает (Ф14) */}
        <SectionCard title={t('bookingPayment.noteLabel')} padding="sm">
          <div data-f="F-07-047" className="flex flex-col gap-2">
            <Input
              value={note ?? summaryQ.data.note ?? ''}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('bookingPayment.notePlaceholder')}
            />
            <Button size="sm" variant="secondary" className="self-end" loading={noteM.isPending} disabled={note === null || note === (summaryQ.data.note ?? '')} onClick={handleSaveNote}>
              {t('bookingPayment.noteSave')}
            </Button>
          </div>
        </SectionCard>

        </div>
      )}

      {/* b05 — F-07-113/114/117/118/121: снимок и решения политики оплаты этой записи. Внизу — поздняя загрузка не
          сдвигает оплату (fin-review М2) */}
      <PolicyBookingBlock
        bookingId={bookingId}
        businessId={businessId}
        clientId={clientId}
        bookingTotal={booking.total}
        cancelledLate={booking.cancelledLate}
        noShow={noShow}
        hasPrepayment={Boolean(booking.prepayment)}
      />

      <QuickPayModal tile={quickTile} amount={due} pending={quickM.isPending} onClose={() => setQuickTile(null)} onConfirm={handleQuickPay} />

      <RefundModal target={refundTarget} pending={refundFullM.isPending || refundPartM.isPending} onClose={() => setRefundTarget(null)} onConfirm={handleRefund} />

      {/* F-07-041 — скидка по акции */}
      <Modal open={promoOpen} onOpenChange={setPromoOpen} title={t('bookingPayment.promoTitle')}>
        <div data-f="F-07-041" className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">{t('bookingPayment.promoLabel')}</span>
            <Input value={promoLabel} onChange={(e) => setPromoLabel(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">{t('bookingPayment.promoAmount')}</span>
            <MoneyInput value={promoAmount} onValueChange={setPromoAmount} max={due} />
          </label>
          <Button loading={promoM.isPending} disabled={!promoLabel.trim() || !promoAmount} onClick={handlePromo}>
            {t('bookingPayment.promoApply')}
          </Button>
        </div>
      </Modal>

      {/* F-07-061/062 — оплата со счёта клиента, включая долг */}
      <Modal
        open={accountOpen}
        onOpenChange={setAccountOpen}
        title={t('bookingPayment.clientAccount')}
        description={t('bookingPayment.clientAccountBalance', { amount: format.money(accountBalance) })}
      >
        <div data-f="F-07-061" className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">{t('bookingPayment.amount')}</span>
            <MoneyInput value={accountAmount} onValueChange={setAccountAmount} max={due} />
          </label>
          {debtAfter > 0 && (
            <p data-f="F-07-062" className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">
              {t('bookingPayment.debtWarningText', { amount: format.money(debtAfter) })}
            </p>
          )}
          <Button loading={accountM.isPending} disabled={!accountAmount || accountAmount <= 0} onClick={handleAccountPay}>
            {t('bookingPayment.payFromAccount')}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
