'use client';

/**
 * F-06-062…067/074/083/084/096…098/123: «Лояльность в оплате визита» — вкладка «Лояльность» окна записи.
 *
 * Л1 (27.09.2026): одно место оплаты с окном «Оплата». Выбранные здесь строки проводятся движком
 * @/api/loyalty (payVisitWithLoyalty) и ложатся строками в платежи визита (refId = id транзакции лояльности),
 * поэтому «К оплате» здесь и в окне «Оплата» — одна цифра (total − платежи визита), проведённое видно на обеих
 * вкладках, а отмена строки на любой из них возвращает списанное.
 * Л2: сам подставляется только абонемент и акция из «Автоприменения»; сертификат — кнопкой.
 * Л4: скидка на визит одна — самая выгодная по умолчанию, остальные — «Заменить»; личная скидка клиента
 * (по тратам) тоже скидка: акция применяется только сверх неё.
 * Л7: до оплаты видно, сколько бонусов начислится. Л15: списки не перечитываются от каждой строки.
 */
import { useEffect, useState } from 'react';
import { Banknote, CheckCircle2, CreditCard, Gift, Percent, Search, Users, Wallet } from 'lucide-react';
import { changeBookingStatus } from '@/api/core';
import { referralPublicName } from '@/domain/rules/referral';
import { getBookingPaymentSummary } from '@/api/finance';
// F-01-208: «первая ли это запись клиента» — getClientVisitStats чужого раздела (journal), только чтение
import { getBookingExtras, getClientVisitStats } from '@/api/journal';
import {
  cancelVisitPaymentLine,
  findLoyaltyByCode,
  getAutoApply,
  getBonusChargeInfo,
  getLoyaltyBookingSummary,
  getPromotion,
  getReferralEligibility,
  type ReferralEligibility,
  isDiscountPayment,
  isLoyaltyPaymentRef,
  listApplicablePromotions,
  listClientAccounts,
  payVisitWithLoyalty,
  previewCashback,
  syncBookingCashback,
  visitPaymentsForCashback,
  visitSums,
  type LoyaltyCodeSearchResult,
  type LoyaltyVisit,
  type VisitServiceLine,
} from '@/api/loyalty';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useCan } from '@/demo/hooks';
import type { BookingStatus, Id } from '@/domain/core';
import type { JournalPaymentLine } from '@/domain/journal';
import type { LoyaltyPaymentLineInput, LoyaltyPaymentLineKind } from '@/domain/loyalty';
import type { BookingWindowExtProps } from '@/extensions/types';
import { useAfterSaveStep } from '@/extensions/saveHooks';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { DiscountOffers, type DiscountOffer } from '@/areas/loyalty/components/pay/DiscountOffers';
import { PayLineRow } from '@/areas/loyalty/components/pay/PayLineRow';
import { PayPanelSkeleton } from '@/areas/loyalty/components/pay/PayPanelSkeleton';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { FormField } from '@/ui/FormField';
import { Modal } from '@/ui/Modal';
import { MoneyInput } from '@/ui/MoneyInput';
import { PhoneInput } from '@/ui/PhoneInput';
import { SearchInput } from '@/ui/SearchInput';
import { useConfirm, useToast } from '@/ui/Toast';

export interface LoyaltyPaymentPanelProps {
  businessId: Id;
  locationId: Id;
  clientId: Id;
  bookingId?: Id;
  total: number;
  status?: BookingStatus;
  visitLines: VisitServiceLine[];
  onDraftChange?: BookingWindowExtProps['onDraftChange'];
  registerAfterSave?: BookingWindowExtProps['registerAfterSave'];
}

interface AppliedLine extends LoyaltyPaymentLineInput {
  key: string;
  label: string;
  /** Подпись для вкладки «Оплата» (finance сама пишет «Скидка по акции «…»») — у акции это её название */
  financeLabel?: string;
}

const KIND_ICON: Record<LoyaltyPaymentLineKind, typeof Percent> = {
  promo: Percent,
  bonus: Wallet,
  certificate: Gift,
  membership: CreditCard,
  referral: Users,
  account: Banknote,
};

const METHOD_ICON: Record<string, typeof Percent> = {
  promotion: Percent,
  card_bonus: Wallet,
  certificate: Gift,
  membership: CreditCard,
  personal_account: Banknote,
};

// F-06-069: как у вкладки «Оплата» (finance markArrivedIfNeeded) — любое ожидание визита, включая «Клиент подтвердил»
const ARRIVABLE: BookingStatus[] = ['scheduled', 'awaiting_confirmation', 'awaiting_prepayment', 'client_confirmed'];

const isDiscountLine = (l: { kind: LoyaltyPaymentLineKind }) => l.kind === 'promo' || l.kind === 'referral';

export function LoyaltyPaymentPanel({ businessId, locationId, clientId, bookingId, total, status, visitLines, onDraftChange, registerAfterSave }: LoyaltyPaymentPanelProps) {
  const t = useT('loyalty');
  const format = useFormat();
  const toast = useToast();
  const confirm = useConfirm();
  /** F-06-175: без права «Оплата сертификатом/абонементом без кода» — только поиск по коду ниже */
  const canApplyWithoutCode = useCan('loyalty.applyWithoutCode');

  const [lines, setLines] = useState<AppliedLine[]>([]);
  const [autoLineKeys, setAutoLineKeys] = useState<Set<string>>(new Set());
  const [splitCard, setSplitCard] = useState<{ id: Id; max: number } | null>(null);
  const [splitAmount, setSplitAmount] = useState<number | undefined>(undefined);
  const [splitAccount, setSplitAccount] = useState<Id | null>(null);
  const [code, setCode] = useState('');
  const [codeResult, setCodeResult] = useState<LoyaltyCodeSearchResult | null>(null);
  const [codeSearching, setCodeSearching] = useState(false);
  const [referrerPhone, setReferrerPhone] = useState('');
  const [referralError, setReferralError] = useState<string | null>(null);
  const [cancelingId, setCancelingId] = useState<Id | null>(null);

  const visit: LoyaltyVisit = { lines: visitLines, locationId, bookingId };
  // Л15: ключ — состав услуг визита, а не остаток: применённая строка не перечитывает предложения
  const visitKey = visitLines.map((l) => `${l.serviceId}:${l.price}:${l.listPrice ?? l.price}`).join('|');
  const { list: listTotal, personalDiscount } = visitSums(visit);
  /** Строка «Скидка за приглашение»: скидка приглашённой + бонус пригласившей (карта выдастся, если её нет) */
  const referralLine = (r: Extract<ReferralEligibility, { ok: true }>, amount: number): AppliedLine => ({
    key: 'referral',
    kind: 'referral',
    label: r.attributed ? t('bookingWindow.pay.lines.referralBy', { name: referralPublicName(r.referrerName) }) : t('bookingWindow.pay.lines.referral'),
    amount,
    referrerClientId: r.referrerClientId,
    referrerCardId: r.referrerCardId,
    referrerCardTypeId: r.referrerCardTypeId,
    referrerBonusAmount: r.referrerBonus,
  });

  // Платежи визита — тот же кэш, что у окна записи и окна «Оплата»
  const extrasQ = useApiQuery(['journal', 'extras', bookingId], () => getBookingExtras(bookingId as Id), { enabled: Boolean(bookingId) }); // arch-ok: общий ключ с окном записи
  const payments: JournalPaymentLine[] = extrasQ.data?.payments ?? [];
  const paid = extrasQ.data?.paidAmount ?? 0;
  const committed = payments.filter((p) => isLoyaltyPaymentRef(p.refId));
  const committedDiscount = payments.find((p) => isDiscountPayment(p.method));
  const moneyPaid = payments.filter((p) => p.method === 'cash' || p.method === 'card' || p.method === 'personal_account').reduce((sum, p) => sum + p.amount, 0);

  // Л1: вкладка «Оплата» (finance) ведёт свои платежи визита — «К оплате» берём то, что знает больше оплат:
  // так цифра здесь совпадает и с окном «Оплата визита», и с вкладкой «Оплата»
  const financeQ = useApiQuery(['finance', 'bookingPayment', businessId, bookingId], () => getBookingPaymentSummary(businessId, bookingId as Id), { enabled: Boolean(bookingId), keepPrevious: true });
  const financeDue = financeQ.data && financeQ.data.booking.total === total ? financeQ.data.due : undefined;
  const toPay = Math.max(0, Math.round(Math.min(total - paid, financeDue ?? Number.POSITIVE_INFINITY)));
  const pendingSum = lines.reduce((sum, l) => sum + l.amount, 0);
  const remaining = Math.max(0, toPay - pendingSum);

  const summaryQ = useApiQuery(['loyalty', 'bookingSummary', businessId, clientId, visitKey], () => getLoyaltyBookingSummary(businessId, clientId, visit), { keepPrevious: true });
  const promotionsQ = useApiQuery(['loyalty', 'applicablePromotions', businessId, clientId, locationId, bookingId, visitKey], () => listApplicablePromotions(businessId, clientId, visit), { keepPrevious: true });
  // Без телефона: «пришла по приглашению» по личной ссылке — пригласившая уже известна (rules/referral)
  const referralGateQ = useApiQuery(['loyalty', 'referralGate', businessId, clientId, bookingId, visitKey], () => getReferralEligibility(businessId, '', clientId, 0, visit), { keepPrevious: true });
  const attributedReferral = referralGateQ.data?.ok && referralGateQ.data.attributed ? referralGateQ.data : undefined;
  const accountsQ = useApiQuery(['loyalty', 'clientAccounts', businessId, clientId], () => listClientAccounts(businessId, clientId));
  // Л7: превью — если всё, что останется после выбранного, заплатить деньгами
  const financeMoney = (financeQ.data?.payments ?? []).filter((p) => !p.cancelled && p.kind !== 'discount').reduce((sum, p) => sum + p.amount - (p.refundedAmount ?? 0), 0);
  const cashbackBase = moneyPaid + financeMoney + remaining;
  const cashbackQ = useApiQuery(['loyalty', 'cashbackPreview', businessId, clientId, bookingId, visitKey, cashbackBase], () => previewCashback(businessId, clientId, visit, cashbackBase), { keepPrevious: true });
  /** F-01-208: настройка автоприменения акции к записям из журнала — акция и «каждая/только первая» */
  const autoApplyQ = useApiQuery(['loyalty', 'autoApply', businessId], () => getAutoApply(businessId));
  const autoPromoId = autoApplyQ.data?.enabled ? autoApplyQ.data.journal.promotionId : undefined;
  const autoPromoQ = useApiQuery(['loyalty', 'autoPromo', businessId, autoPromoId], () => getPromotion(businessId, autoPromoId as Id), { enabled: Boolean(autoPromoId) });
  const visitStatsQ = useApiQuery(['loyalty', 'visitStatsForAutoApply', businessId, clientId], () => getClientVisitStats(clientId, [businessId]), { enabled: Boolean(autoPromoId) });

  // Л2: сам подставляется только абонемент, покрывающий услуги визита, и акция из «Автоприменения» (F-01-208) —
  // сертификат и бонусы только кнопкой. Один раз на сессию оплаты, во время рендера (не в эффекте), и только
  // пока у визита нет ни одного платежа — чтобы не подставлять поверх уже проведённого.
  const autoApplySessionKey = `${clientId}:${bookingId ?? 'draft'}`;
  const [autoAppliedFor, setAutoAppliedFor] = useState<string | null>(null);
  const autoApplyReady =
    Boolean(summaryQ.data) &&
    (!bookingId || extrasQ.data !== undefined || extrasQ.isError) &&
    (autoApplyQ.data !== undefined || autoApplyQ.isError) &&
    (referralGateQ.data !== undefined || referralGateQ.isError) &&
    (!autoPromoId || ((autoPromoQ.data !== undefined || autoPromoQ.isError) && (visitStatsQ.data !== undefined || visitStatsQ.isError)));
  if (autoApplyReady && autoAppliedFor !== autoApplySessionKey) {
    setAutoAppliedFor(autoApplySessionKey);
    if (lines.length === 0 && payments.length === 0 && toPay > 0) {
      const membership = visitLines.length > 0 ? summaryQ.data!.memberships.find((m) => m.applicable && m.coverAmount > 0) : undefined;
      let auto: AppliedLine | null = null;
      if (membership) {
        auto = {
          key: `mem_${membership.id}`,
          kind: 'membership',
          label: t('bookingWindow.pay.lines.membership', { name: membership.typeName }),
          amount: Math.min(membership.coverAmount, toPay),
          membershipId: membership.id,
        };
      } else if (attributedReferral && Math.min(Math.max(0, attributedReferral.inviteeDiscount - personalDiscount), toPay) > 0) {
        // ⭐ Пришла по личной ссылке подруги — скидка первого визита и бонус пригласившей подставляются сами
        auto = referralLine(attributedReferral, Math.min(Math.max(0, attributedReferral.inviteeDiscount - personalDiscount), toPay));
      } else if (autoPromoQ.data && autoPromoQ.data.kind.startsWith('discount')) {
        const when = autoApplyQ.data?.journal.when;
        const isFirstVisit = (visitStatsQ.data?.totalVisits ?? 0) === 0;
        if (when === 'every' || (when === 'firstOnly' && isFirstVisit)) {
          const promo = autoPromoQ.data;
          const full = promo.valueType === 'percent' ? Math.round((listTotal * promo.value) / 100) : Math.min(promo.value, listTotal);
          // Л4: личная скидка клиента уже стоит — акция только сверх неё
          const extra = Math.min(Math.max(0, full - personalDiscount), toPay);
          if (extra > 0) auto = { key: `autopromo_${promo.id}`, kind: 'promo', label: t('bookingWindow.pay.lines.promo', { name: promo.name }), financeLabel: promo.name, amount: extra, promotionId: promo.id };
        }
      }
      if (auto) {
        setLines([auto]);
        setAutoLineKeys(new Set([auto.key]));
      }
    }
  }

  // Л6: деньги могли принять во вкладке «Оплата» (finance) — она лояльность не зовёт. Открыли вкладку — кэшбэк
  // визита сверяется с текущей оплатой (syncBookingCashback идемпотентен: совпало — ничего не пишет).
  const moneySignature = `${moneyPaid}:${financeMoney}`;
  const paymentsReady = Boolean(bookingId) && extrasQ.data !== undefined && financeQ.data !== undefined;
  useEffect(() => {
    if (!paymentsReady || !bookingId) return;
    void visitPaymentsForCashback(businessId, bookingId, payments)
      .then((all) => syncBookingCashback(businessId, locationId, clientId, bookingId, all, visit))
      .catch(() => undefined); // сверка фоновая: не вышло — кэшбэк досчитает следующая оплата или «Сохранить»
    // визит и деньги — по подписи, а не по ссылкам на объекты запросов
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentsReady, bookingId, moneySignature, visitKey]);

  const commitMutation = useApiMutation(async (args: { bookingId: Id; lines: AppliedLine[] }) => {
    const extras = await payVisitWithLoyalty({
      businessId,
      locationId,
      bookingId: args.bookingId,
      clientId,
      lines: args.lines.map((l) => ({
        kind: l.kind,
        amount: l.amount,
        cardId: l.cardId,
        promotionId: l.promotionId,
        certificateId: l.certificateId,
        membershipId: l.membershipId,
        accountId: l.accountId,
        referrerClientId: l.referrerClientId,
        referrerCardId: l.referrerCardId,
        referrerCardTypeId: l.referrerCardTypeId,
        referrerBonusAmount: l.referrerBonusAmount,
      })),
      visit: { ...visit, bookingId: args.bookingId },
      labelOf: (_line, index) => args.lines[index].label,
      financeLabelOf: (_line, index) => args.lines[index].financeLabel ?? args.lines[index].label,
    });
    // F-06-069: оплата переводит запись из ожидания в «Клиент пришёл» — как и окно «Оплата»
    if (status && ARRIVABLE.includes(status)) {
      await changeBookingStatus(args.bookingId, 'arrived', 'business');
      onDraftChange?.({ status: 'arrived' });
    }
    return extras;
  });
  const cancelMutation = useApiMutation((line: JournalPaymentLine) => cancelVisitPaymentLine({ businessId, locationId, bookingId: bookingId as Id, clientId, visit }, line));

  // Новая запись: выбранное проводится шагом «после сохранения», когда у записи появился id
  useAfterSaveStep(registerAfterSave, async (savedBookingId) => {
    if (bookingId || lines.length === 0) return;
    await commitMutation.mutate({ bookingId: savedBookingId, lines });
    setLines([]);
  });

  const commitPayment = async () => {
    if (!bookingId || lines.length === 0) return;
    try {
      await commitMutation.mutate({ bookingId, lines });
      setLines([]);
      setAutoLineKeys(new Set());
      toast.success(t('bookingWindow.pay.committed'));
    } catch {
      toast.error(t('bookingWindow.pay.commitFailed'));
    }
  };

  const cancelCommitted = async (line: JournalPaymentLine) => {
    setCancelingId(line.id);
    try {
      await cancelMutation.mutate(line);
      toast.success(t('bookingWindow.pay.lineCancelled'));
    } catch {
      toast.error(t('bookingWindow.pay.cancelFailed'));
    } finally {
      setCancelingId(null);
    }
  };

  const cancelAll = async () => {
    const ok = await confirm({ title: t('bookingWindow.pay.cancelConfirmTitle'), description: t('bookingWindow.pay.cancelConfirmText'), tone: 'danger' });
    if (!ok) return;
    setCancelingId('all');
    try {
      for (const line of committed) await cancelMutation.mutate(line);
      toast.success(t('bookingWindow.pay.cancelled'));
    } catch {
      toast.error(t('bookingWindow.pay.cancelFailed'));
    } finally {
      setCancelingId(null);
    }
  };

  if (!clientId) return null;

  const addLine = (line: AppliedLine) => setLines((prev) => [...prev, line]);
  const removeLine = (key: string) => {
    setLines((prev) => prev.filter((l) => l.key !== key));
    setAutoLineKeys((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };

  const pendingDiscount = lines.find(isDiscountLine);
  const hasDiscount = Boolean(pendingDiscount || committedDiscount);

  /**
   * Л4: скидка на визит одна. Новая встаёт вместо выбранной (ещё не проведённой) или проведённой — та сначала
   * отменяется и возвращает своё; сумма — сверх личной скидки клиента.
   */
  const putDiscount = async (line: AppliedLine) => {
    const freed = pendingDiscount?.amount ?? 0;
    if (committedDiscount) {
      try {
        await cancelMutation.mutate(committedDiscount);
      } catch {
        toast.error(t('bookingWindow.pay.cancelFailed'));
        return;
      }
    }
    const room = remaining + freed + (committedDiscount?.amount ?? 0);
    setLines((prev) => [...prev.filter((l) => !isDiscountLine(l)), { ...line, amount: Math.min(line.amount, room) }]);
  };

  const pickOffer = (o: DiscountOffer) =>
    putDiscount({ key: `promo_${o.id}_${o.cardId}`, kind: 'promo', label: t('bookingWindow.pay.lines.promo', { name: o.name }), financeLabel: o.name, amount: o.extra, cardId: o.cardId, promotionId: o.id });

  const applyBonus = async (cardId: Id, custom?: number) => {
    const info = await getBonusChargeInfo(businessId, cardId, remaining, visit);
    const amount = Math.max(0, Math.min(custom ?? info.max, info.max));
    if (amount <= 0) {
      toast.error(t('bookingWindow.pay.bonusUnavailable'));
      return;
    }
    addLine({ key: `bonus_${cardId}`, kind: 'bonus', label: t('bookingWindow.pay.lines.bonus'), amount, cardId });
    setSplitCard(null);
    setSplitAmount(undefined);
  };

  const openSplit = async (cardId: Id) => {
    const info = await getBonusChargeInfo(businessId, cardId, remaining, visit);
    setSplitCard({ id: cardId, max: info.max });
    setSplitAmount(info.max);
  };

  const applyCertificate = (id: Id, name: string, amount: number) => {
    addLine({ key: `cert_${id}`, kind: 'certificate', label: t('bookingWindow.pay.lines.certificate', { name }), amount: Math.min(amount, remaining), certificateId: id });
    setCode('');
    setCodeResult(null);
  };

  const applyMembership = (id: Id, name: string, cover: number) => {
    addLine({ key: `mem_${id}`, kind: 'membership', label: t('bookingWindow.pay.lines.membership', { name }), amount: Math.min(cover, remaining), membershipId: id });
    setCode('');
    setCodeResult(null);
  };

  /** F-06-139/140: оплата со счёта — можно списать в минус до maxCharge (разрешённого лимита типа счёта) */
  const applyAccount = (accountId: Id, typeName: string, amount: number) => {
    addLine({ key: `acc_${accountId}`, kind: 'account', label: t('bookingWindow.pay.lines.account', { name: typeName }), amount, accountId });
    setSplitAccount(null);
    setSplitAmount(undefined);
  };

  const openAccountSplit = (accountId: Id, max: number) => {
    setSplitAccount(accountId);
    setSplitAmount(Math.min(max, remaining));
  };

  const searchCode = async () => {
    if (!code.trim()) return;
    setCodeSearching(true);
    try {
      const result = await findLoyaltyByCode(businessId, code);
      setCodeResult(result);
      if (result.kind === 'none') toast.error(t('bookingWindow.pay.codeNotFound'));
    } finally {
      setCodeSearching(false);
    }
  };

  const applyReferral = async (byLink?: boolean) => {
    setReferralError(null);
    const result = await getReferralEligibility(businessId, byLink ? '' : referrerPhone, clientId, toPay, visit);
    if (!result.ok) {
      setReferralError(t(`bookingWindow.pay.referral.reason.${result.reason}`));
      return;
    }
    const extra = Math.max(0, result.inviteeDiscount - personalDiscount);
    if (extra <= 0) {
      setReferralError(t('bookingWindow.pay.personalBetter'));
      return;
    }
    await putDiscount(referralLine(result, extra));
    setReferrerPhone('');
  };

  const appliedBonusCardIds = new Set(lines.filter((l) => l.kind === 'bonus').map((l) => l.cardId));
  const appliedCertIds = new Set(lines.filter((l) => l.kind === 'certificate').map((l) => l.certificateId));
  const appliedMembershipIds = new Set(lines.filter((l) => l.kind === 'membership').map((l) => l.membershipId));
  const appliedAccountIds = new Set(lines.filter((l) => l.kind === 'account').map((l) => l.accountId));
  const referralApplied = lines.some((l) => l.kind === 'referral');

  const showReferral = referralGateQ.data ? referralGateQ.data.ok || referralGateQ.data.reason === 'notFound' : false;
  const cards = (summaryQ.data?.cards ?? []).filter((c) => c.balance > 0 && !appliedBonusCardIds.has(c.id));
  const certificates = (summaryQ.data?.certificates ?? []).filter((c) => !appliedCertIds.has(c.id) && c.coverAmount > 0);
  // F-06-066: абонемент с раздельным балансом на чужую услугу не предлагается (coverAmount — из движка)
  const memberships = (summaryQ.data?.memberships ?? []).filter((m) => !appliedMembershipIds.has(m.id) && visitLines.length > 0 && m.applicable && m.coverAmount > 0);
  const accounts = (accountsQ.data ?? []).filter((a) => !appliedAccountIds.has(a.id) && a.maxCharge > 0);
  const offers: DiscountOffer[] = (promotionsQ.data ?? []).map((p) => ({ id: p.id, cardId: p.cardId, name: p.name, extra: p.discount - personalDiscount })).filter((o) => o.extra > 0);
  const personalBetter = personalDiscount > 0 && (promotionsQ.data ?? []).length > 0 && offers.length === 0;
  const nothingToOffer = cards.length === 0 && certificates.length === 0 && memberships.length === 0 && accounts.length === 0 && offers.length === 0 && lines.length === 0 && committed.length === 0;
  const cashbackAhead = Math.max(0, (cashbackQ.data?.total ?? 0) - (cashbackQ.data?.accrued ?? 0));
  const accrued = cashbackQ.data?.accrued ?? 0;
  const busy = commitMutation.isPending || cancelingId !== null;

  return (
    <div
      data-f="F-06-061 F-06-193 F-06-062 F-06-063 F-06-064 F-06-065 F-06-066 F-06-067 F-06-069 F-06-070 F-06-073 F-06-074 F-06-083 F-06-084 F-06-096 F-06-097 F-06-098 F-06-123 F-06-124 F-06-131 F-06-139 F-06-140 F-04-172 F-04-173 F-01-145 F-01-208 F-01-209 F-01-210"
      className="@container flex flex-col gap-3 rounded-lg border border-border p-3"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">{t('bookingWindow.pay.title')}</p>
        {/* Л1: та же цифра, что «К оплате» в окне «Оплата» */}
        <p className="text-sm font-semibold text-fg">{t('bookingWindow.pay.remaining', { amount: format.money(toPay) })}</p>
      </div>

      {(personalDiscount > 0 || committed.length > 0) && (
        <ul className="flex flex-col gap-1.5">
          {personalDiscount > 0 && <PayLineRow icon={<Percent aria-hidden />} label={t('bookingWindow.pay.personalDiscount')} amount={personalDiscount} note={t('bookingWindow.pay.personalDiscountHint')} removeLabel="" />}
          {committed.map((p) => {
            const Icon = METHOD_ICON[p.method] ?? Wallet;
            return (
              <PayLineRow
                key={p.id}
                icon={<Icon aria-hidden />}
                label={p.label}
                amount={p.amount}
                note={t('bookingWindow.pay.committedNote')}
                removeLabel={t('bookingWindow.pay.cancelLine')}
                busy={busy}
                onRemove={() => cancelCommitted(p)}
              />
            );
          })}
        </ul>
      )}

      {lines.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {lines.map((l) => {
            const Icon = KIND_ICON[l.kind];
            const isAuto = autoLineKeys.has(l.key);
            return (
              <PayLineRow
                key={l.key}
                icon={<Icon aria-hidden />}
                label={l.label}
                amount={l.amount}
                note={isAuto ? t('bookingWindow.pay.autoAppliedHint') : undefined}
                removeLabel={isAuto ? t('bookingWindow.pay.dontCharge') : t('bookingWindow.pay.removeLine')}
                busy={busy}
                onRemove={() => removeLine(l.key)}
              />
            );
          })}
        </ul>
      )}

      {cashbackAhead > 0 && toPay > 0 ? (
        <p data-f="F-06-070" className="flex items-center gap-2 text-sm text-muted">
          <Gift aria-hidden className="size-4 shrink-0 text-primary-text" />
          {t('bookingWindow.pay.cashbackPreview', { amount: format.money(cashbackAhead) })}
        </p>
      ) : accrued > 0 ? (
        <p data-f="F-06-070" className="flex items-center gap-2 text-sm text-muted">
          <CheckCircle2 aria-hidden className="size-4 shrink-0 text-success" />
          {t('bookingWindow.pay.cashbackAccrued', { amount: format.money(accrued) })}
        </p>
      ) : null}

      {lines.length > 0 && (
        <div className="flex flex-col gap-1.5 border-t border-border pt-2.5">
          <p className="text-sm text-muted">{t('bookingWindow.pay.afterLines', { amount: format.money(remaining) })}</p>
          {bookingId ? (
            <Button loading={commitMutation.isPending} disabled={cancelingId !== null} onClick={commitPayment} className="self-start">
              {t('bookingWindow.pay.commitButton')}
            </Button>
          ) : (
            <p className="text-sm text-muted">{t('bookingWindow.pay.saveFirst')}</p>
          )}
        </div>
      )}

      {committed.length > 1 && lines.length === 0 && (
        <Button variant="outline" size="sm" loading={cancelingId === 'all'} disabled={busy} onClick={cancelAll} className="self-start text-danger">
          {t('bookingWindow.pay.cancelButton')}
        </Button>
      )}

      {summaryQ.isLoading && <PayPanelSkeleton />}
      {summaryQ.isError && !summaryQ.data && <p className="text-sm text-danger">{t('bookingWindow.loadFailed')}</p>}

      {summaryQ.data && remaining > 0 && (
        <div className="flex flex-col gap-2">
          <DiscountOffers offers={offers} currentPromotionId={pendingDiscount?.promotionId} hasDiscount={hasDiscount} busy={busy} onPick={pickOffer} />
          {personalBetter && <p className="text-xs text-muted">{t('bookingWindow.pay.personalBetter')}</p>}

          {cards.length > 0 && (
            <ul className="flex flex-col gap-1.5">
              {cards.map((c) => (
                <li key={c.id} className="flex flex-col gap-2 rounded-lg border border-border px-3 py-2 text-sm @md:flex-row @md:items-center">
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    <Wallet aria-hidden className="size-4 shrink-0 text-primary-text" />
                  <span className="min-w-0 flex-1 text-fg @md:truncate">
                    {c.cardTypeName} · {format.money(c.balance)}
                  </span>
                  </span>
                  <span className="flex flex-wrap items-center gap-2 @md:shrink-0">
                  <Button size="sm" variant="outline" onClick={() => applyBonus(c.id)}>
                    {t('bookingWindow.pay.chargeMax')}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => openSplit(c.id)}>
                    {t('bookingWindow.pay.split')}
                  </Button>
                  </span>
                </li>
              ))}
            </ul>
          )}

          {certificates.length > 0 && (
            <ul className="flex flex-col gap-1.5" data-f="F-06-175 F-06-088">
              {certificates.map((c) => {
                const amount = Math.min(c.balance, c.coverAmount, remaining);
                const burns = c.single && c.balance > amount ? c.balance - amount : 0;
                return (
                  <li key={c.id} className="flex flex-col gap-2 rounded-lg border border-border px-3 py-2 text-sm @md:flex-row @md:items-center">
                    <span className="flex min-w-0 flex-1 items-center gap-2">
                      <Gift aria-hidden className="size-4 shrink-0 text-primary-text" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-fg @md:truncate">
                        {c.typeName} · № {c.code} · {format.money(c.balance)}
                      </span>
                      {burns > 0 && <span className="block text-xs text-warning">{t('bookingWindow.pay.singleBurnHint', { amount: format.money(burns) })}</span>}
                    </span>
                    </span>
                    <span className="flex flex-wrap items-center gap-2 @md:shrink-0">
                    {canApplyWithoutCode ? (
                      <Button size="sm" variant="outline" onClick={() => applyCertificate(c.id, c.typeName, amount)}>
                        {t('bookingWindow.pay.applyCertificate')}
                      </Button>
                    ) : (
                      <span className="text-xs text-muted">{t('bookingWindow.pay.needsCodeRight')}</span>
                    )}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          {memberships.length > 0 && (
            <ul className="flex flex-col gap-1.5" data-f="F-06-175">
              {memberships.map((m) => (
                <li key={m.id} className="flex flex-col gap-2 rounded-lg border border-border px-3 py-2 text-sm @md:flex-row @md:items-center">
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    <CreditCard aria-hidden className="size-4 shrink-0 text-primary-text" />
                  <span className="min-w-0 flex-1 text-fg @md:truncate">
                    {m.typeName} · {t('bookingWindow.visitsLeft', { balance: m.balanceVisits, total: m.totalVisits })}
                  </span>
                  </span>
                  <span className="flex flex-wrap items-center gap-2 @md:shrink-0">
                  {canApplyWithoutCode ? (
                    <Button size="sm" variant="outline" onClick={() => applyMembership(m.id, m.typeName, m.coverAmount)}>
                      {t('bookingWindow.pay.applyMembership')}
                    </Button>
                  ) : (
                    <span className="text-xs text-muted">{t('bookingWindow.pay.needsCodeRight')}</span>
                  )}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {accounts.length > 0 && (
            <ul className="flex flex-col gap-1.5">
              {accounts.map((a) => (
                <li key={a.id} className="flex flex-col gap-2 rounded-lg border border-border px-3 py-2 text-sm @md:flex-row @md:items-center">
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    <Banknote aria-hidden className="size-4 shrink-0 text-primary-text" />
                  <span className="min-w-0 flex-1 text-fg @md:truncate">
                    {a.typeName} · {a.balance < 0 ? <span className="text-danger">{format.money(a.balance)}</span> : format.money(a.balance)}
                    {a.allowNegative && <span className="text-muted"> · {t('bookingWindow.pay.accountDebtAllowed', { limit: format.money(a.negativeLimit) })}</span>}
                  </span>
                  </span>
                  <span className="flex flex-wrap items-center gap-2 @md:shrink-0">
                  <Button size="sm" variant="outline" onClick={() => applyAccount(a.id, a.typeName, Math.min(a.maxCharge, remaining))}>
                    {t('bookingWindow.pay.chargeAccount')}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => openAccountSplit(a.id, a.maxCharge)}>
                    {t('bookingWindow.pay.split')}
                  </Button>
                  </span>
                </li>
              ))}
            </ul>
          )}

          {nothingToOffer && <EmptyState compact icon={<Wallet aria-hidden />} title={t('bookingWindow.empty')} />}

          <div className="flex flex-col gap-1.5 border-t border-border pt-2.5">
            <p className="text-xs font-medium text-muted">{t('bookingWindow.pay.codeTitle')}</p>
            <div className="flex items-end gap-2">
              <SearchInput value={code} onValueChange={setCode} placeholder={t('bookingWindow.pay.codePlaceholder')} className="flex-1" />
              <Button size="sm" variant="outline" leftIcon={<Search aria-hidden />} loading={codeSearching} onClick={searchCode}>
                {t('bookingWindow.pay.codeSearch')}
              </Button>
            </div>
            {codeResult?.kind === 'certificate' && (
              <div className="flex flex-col gap-2 rounded-lg border border-border px-3 py-2 text-sm @md:flex-row @md:items-center">
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  <Gift aria-hidden className="size-4 shrink-0 text-primary-text" />
                <span className="min-w-0 flex-1 text-fg @md:truncate">
                  {codeResult.certificate.typeName} · {codeResult.certificate.clientName || t('bookingWindow.pay.codeNoOwner')} · {format.money(codeResult.certificate.balance)}
                </span>
                </span>
                <span className="flex flex-wrap items-center gap-2 @md:shrink-0">
                  <Button size="sm" onClick={() => applyCertificate(codeResult.certificate.id, codeResult.certificate.typeName, codeResult.certificate.balance)}>
                    {t('bookingWindow.pay.applyCertificate')}
                  </Button>
                </span>
              </div>
            )}
            {codeResult?.kind === 'membership' && (
              <div className="flex flex-col gap-2 rounded-lg border border-border px-3 py-2 text-sm @md:flex-row @md:items-center">
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  <CreditCard aria-hidden className="size-4 shrink-0 text-primary-text" />
                  <span className="min-w-0 flex-1 text-fg @md:truncate">
                    {codeResult.membership.typeName} · {codeResult.membership.clientName} · {t('bookingWindow.visitsLeft', { balance: codeResult.membership.balanceVisits, total: codeResult.membership.totalVisits })}
                  </span>
                </span>
                <span className="flex flex-wrap items-center gap-2 @md:shrink-0">
                  <Button size="sm" onClick={() => applyMembership(codeResult.membership.id, codeResult.membership.typeName, remaining)}>
                    {t('bookingWindow.pay.applyMembership')}
                  </Button>
                </span>
              </div>
            )}
          </div>

          {showReferral && !referralApplied && (
            <div className="flex flex-col gap-1.5 border-t border-border pt-2.5">
              <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
                <Users aria-hidden className="size-3.5" />
                {t('bookingWindow.pay.referral.title')}
              </p>
              {attributedReferral ? (
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 text-sm text-fg">{t('bookingWindow.pay.referral.byLink', { name: referralPublicName(attributedReferral.referrerName) })}</p>
                  <Button size="sm" variant="outline" onClick={() => applyReferral(true)}>
                    {hasDiscount ? t('bookingWindow.pay.referral.replace') : t('bookingWindow.pay.referral.apply')}
                  </Button>
                </div>
              ) : (
                <div className="flex items-end gap-2">
                  <PhoneInput value={referrerPhone} onValueChange={(v) => setReferrerPhone(v)} className="flex-1" />
                  <Button size="sm" variant="outline" onClick={() => applyReferral()}>
                    {hasDiscount ? t('bookingWindow.pay.referral.replace') : t('bookingWindow.pay.referral.apply')}
                  </Button>
                </div>
              )}
              {referralError && <p className="text-sm text-danger">{referralError}</p>}
            </div>
          )}
        </div>
      )}

      <Modal
        open={Boolean(splitCard)}
        onOpenChange={(open) => !open && setSplitCard(null)}
        title={t('bookingWindow.pay.split')}
        footer={
          <>
            <Button variant="outline" onClick={() => setSplitCard(null)}>
              {t('clientCard.cancel')}
            </Button>
            <Button disabled={!splitAmount} onClick={() => splitCard && applyBonus(splitCard.id, splitAmount)}>
              {t('bookingWindow.pay.applyButton')}
            </Button>
          </>
        }
      >
        {splitCard && (
          <FormField label={t('bookingWindow.pay.splitAmountLabel', { max: format.money(splitCard.max) })}>
            <MoneyInput value={splitAmount} onValueChange={setSplitAmount} max={splitCard.max} />
          </FormField>
        )}
      </Modal>

      <Modal
        open={Boolean(splitAccount)}
        onOpenChange={(open) => !open && setSplitAccount(null)}
        title={t('bookingWindow.pay.split')}
        footer={
          <>
            <Button variant="outline" onClick={() => setSplitAccount(null)}>
              {t('clientCard.cancel')}
            </Button>
            <Button
              disabled={!splitAmount}
              onClick={() => {
                const account = accounts.find((a) => a.id === splitAccount);
                if (splitAccount && account && splitAmount) applyAccount(splitAccount, account.typeName, splitAmount);
              }}
            >
              {t('bookingWindow.pay.applyButton')}
            </Button>
          </>
        }
      >
        {splitAccount &&
          (() => {
            const account = accounts.find((a) => a.id === splitAccount);
            if (!account) return null;
            return (
              <FormField label={t('bookingWindow.pay.splitAmountLabel', { max: format.money(Math.min(account.maxCharge, remaining)) })}>
                <MoneyInput value={splitAmount} onValueChange={setSplitAmount} max={Math.min(account.maxCharge, remaining)} />
              </FormField>
            );
          })()}
      </Modal>
    </div>
  );
}
