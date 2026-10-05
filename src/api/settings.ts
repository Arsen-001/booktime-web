'use client';

/**
 * API раздела «settings». Принадлежит разделу.
 * Движок цены/срока подписки (F-15-033/034/041/044/045/047, F-00-011…018): getSubscription, quotePrice,
 * previewPriceChange, getBillingSeats, isBusinessVisible, subscriptionWarnings, grantFreeMonth — сигнатуры
 * держим стабильными (другие разделы попросят их в qa/requests/<area>.md — см. qa/requests/settings.md).
 * Монеты (F-00-026/027) считает ЯДРО (coreTx.chargeCoins/grantCoins, getCoinBalance/listCoinMoves из '@/api/core') —
 * здесь только пакеты покупки и тонкие обёртки spendCoins/refundCoins для других разделов.
 */
import { mutateArea, readArea, readCore } from '@/api/area';
import { assertCan, coreCreate, coreGet, coreTx, coreUpdate } from '@/api/core';
import { http, isApiMode } from '@/api/http';
import { apiIdentity } from '@/api/identity';
import * as S from '@/api/settings.server';
import { syncCore } from '@/api/mirror';
import { setSessionMode } from '@/api/session';
import { myDataFilename } from '@/lib/saveJsonFile';
import {
  cancelMyAccountDeletion,
  confirmPhoneChangeApi,
  getAccount,
  listLoginEvents,
  listMyDataExports,
  logoutAll,
  requestMyAccountDeletion,
  requestMyDataBlock,
  fetchMyDataExport,
  requestMyDataExport,
  sendPhoneChangeCodeApi,
  setAccountTwoFactor,
} from '@/api/session';
import { changeAdminPassword } from '@/api/client';
import { updateLocationPlace } from '@/api/online';
import { getJournalSettings, setJournalSettings } from '@/api/journal';
import type { ModerationKind, PromoCode } from '@/domain/platform';
import { createSphereRequest } from '@/api/platform/sphereRequests';
import {
  getModerationStatus,
  submitForModeration,
} from '@/api/platform/moderation';
import {
  ApiError,
  request,
  useApiQuery,
  type QueryOptions,
} from '@/api/request';
import type {
  Business,
  BusinessKind,
  CoinMove,
  Id,
  ISODateTime,
  Location,
  SocialLinks,
} from '@/domain/core';
import type {
  BillingPaymentMethod,
  CompanyProfileSummary,
  CoinPackage,
  DataExportRequest,
  HelpRequest,
  Invoice,
  InvoicePurpose,
  LegalInfo,
  MobileAppOrderRequest,
  ModerationRefKey,
  NotificationPrefs,
  OnboardingInvite,
  OnboardingStep,
  OnboardingStepId,
  PersonalAccount,
  PriceBreakdownLine,
  PriceQuote,
  PriceRuleChange,
  RecordCategory,
  SeatLine,
  SettingsChangeLogEntry,
  SettingsChangeSection,
  SettingsLang,
  SphereRequest,
  SphereRequestChecklistItem,
  StartPage,
  Subscription,
  SubscriptionPayment,
  SubscriptionWarning,
  SystemSettings,
  WebhookEntity,
  WebhookSettings,
} from '@/domain/settings';
import { isAssistantStaff } from '@/domain/staff';
import { dayjs, toISODate, toISODateTime } from '@/lib/date';
import { newId } from '@/lib/id';
import { pickText } from '@/lib/text';

// ─────────────────────────── Цена подписки (⭐ наши решения) ───────────────────────────

export const INDIVIDUAL_PRICE = 5000;
export const MASTER_SEAT_PRICE = 4000;
export const ADMIN_EXTRA_SEAT_PRICE = 2000;
export const MIN_PAID_MASTERS = 2;

function business(businessId: Id): Business {
  const b = readCore().businesses.find((x) => x.id === businessId);
  if (!b) throw new ApiError('not_found', 'Бизнес не найден');
  return b;
}

/**
 * Мастер салона для тарифа (F-00-014/047, F-02-022 · В-11 «платный мастер = есть услуга и график в месяце,
 * включая работающего владельца»): владелец/администратор платный, если ему назначена услуга И у него есть
 * график, не закончившийся до текущего месяца — оба условия разом, не блокируем добавление, только считаем.
 */
function isBillableMaster(staffId: Id): boolean {
  const core = readCore();
  const hasService = core.services.some((s) => s.staffIds.includes(staffId));
  if (!hasService) return false;
  const monthStart = dayjs().startOf('month').format('YYYY-MM-DD');
  return core.schedules.some((w) => w.staffId === staffId && (!w.openUntil || w.openUntil >= monthStart));
}

function computeSeats(biz: Business): {
  seats: SeatLine[];
  breakdown: PriceBreakdownLine[];
  monthlyTotal: number;
} {
  // F-00-016: отключённый (status: 'disabled') сотрудник больше не работает в бизнесе — не должен занимать
  // платное место. Раньше отсекался только 'fired', 'disabled' проходил дальше и всё ещё считался в плате.
  const staff = readCore()
    .staff.filter(
      (s) =>
        s.businessId === biz.id &&
        s.status !== 'fired' &&
        s.status !== 'disabled',
    )
    .sort((a, b) => a.hiredAt.localeCompare(b.hiredAt));

  if (biz.kind === 'individual') {
    const owner = staff.find((s) => s.role === 'owner');
    const seats: SeatLine[] = owner
      ? [
          {
            staffId: owner.id,
            name: owner.name,
            role: 'owner',
            paid: true,
            price: INDIVIDUAL_PRICE,
            reasonKey: 'individual',
          },
        ]
      : [];
    return {
      seats,
      breakdown: [
        {
          labelKey: 'billing.breakdown.individual',
          count: 1,
          unitPrice: INDIVIDUAL_PRICE,
          amount: INDIVIDUAL_PRICE,
        },
      ],
      monthlyTotal: INDIVIDUAL_PRICE,
    };
  }

  const seats: SeatLine[] = [];
  let masterCount = 0;
  const admins = staff.filter((s) => s.role === 'admin');

  staff.forEach((s) => {
    if (s.role === 'owner') {
      const paid = isBillableMaster(s.id);
      if (paid) masterCount++;
      seats.push({
        staffId: s.id,
        name: s.name,
        role: 'owner',
        paid,
        price: paid ? MASTER_SEAT_PRICE : 0,
        reasonKey: paid ? 'ownerAsMaster' : 'ownerFree',
      });
      return;
    }
    if (s.role === 'admin') {
      const isFirst = admins[0]?.id === s.id;
      seats.push({
        staffId: s.id,
        name: s.name,
        role: 'admin',
        paid: !isFirst,
        price: isFirst ? 0 : ADMIN_EXTRA_SEAT_PRICE,
        reasonKey: isFirst ? 'adminFirstFree' : 'adminExtra',
      });
      return;
    }
    // master
    // F-09-044: отдельный ассистент («Только просмотр», без графика и своих услуг) — бесплатное место,
    // не платный мастер, даже если формально роль в ядре та же.
    // С9 обзора «Сотрудники» (27.09.2026): ассистент — галочка ИЛИ должность «Ассистент…» (то же правило,
    // что в строке списка сотрудников — isAssistantStaff, src/areas/staff/pricing.ts)
    if (isAssistantStaff(s)) {
      seats.push({
        staffId: s.id,
        name: s.name,
        role: 'master',
        paid: false,
        price: 0,
        reasonKey: 'assistantFree',
      });
      return;
    }
    // Приглашённый мастер, ещё не принявший приглашение, не платный до первого входа (С9)
    if (s.status === 'invited') {
      seats.push({ staffId: s.id, name: s.name, role: 'master', paid: false, price: 0, reasonKey: 'invitedPending' });
      return;
    }
    masterCount++;
    seats.push({
      staffId: s.id,
      name: s.name,
      role: 'master',
      paid: true,
      price: MASTER_SEAT_PRICE,
      reasonKey: 'master',
    });
  });

  const paidAdmins = admins.length > 0 ? admins.length - 1 : 0;
  const breakdown: PriceBreakdownLine[] = [];
  if (masterCount > 0) {
    breakdown.push({
      labelKey: 'billing.breakdown.masters',
      count: masterCount,
      unitPrice: MASTER_SEAT_PRICE,
      amount: masterCount * MASTER_SEAT_PRICE,
    });
  }
  if (masterCount < MIN_PAID_MASTERS) {
    breakdown.push({
      labelKey: 'billing.breakdown.minimum',
      count: MIN_PAID_MASTERS - masterCount,
      unitPrice: MASTER_SEAT_PRICE,
      amount: (MIN_PAID_MASTERS - masterCount) * MASTER_SEAT_PRICE,
    });
  }
  if (paidAdmins > 0) {
    breakdown.push({
      labelKey: 'billing.breakdown.admins',
      count: paidAdmins,
      unitPrice: ADMIN_EXTRA_SEAT_PRICE,
      amount: paidAdmins * ADMIN_EXTRA_SEAT_PRICE,
    });
  }
  const monthlyTotal = breakdown.reduce((sum, l) => sum + l.amount, 0);
  return { seats, breakdown, monthlyTotal };
}

/**
 * Разбивка и сумма подписки (F-15-033/034/041/044/045/047, F-00-011…018).
 * Скидка (F-15-062/063, F-00-021): только личный промокод, применённый при регистрации, и только пока не
 * потрачен — общих кодов «для всех» и лестницы скидок за срок нет (Снято 16). Остаток бесплатного месяца
 * (F-15-059) прибавляется отдельной строкой в UI, здесь — количество дней, чтобы посчитать «с–по».
 */
export function quotePrice(businessId: Id, months = 1): Promise<PriceQuote> {
  if (isApiMode()) return S.quotePrice(businessId, months);
  return request(() => {
    const biz = business(businessId);
    const sub = subscriptionOf(businessId);
    const { seats, breakdown, monthlyTotal } = computeSeats(biz);
    const regularTotal = monthlyTotal * months;
    const discountPercent = promoPercentFor(businessId, sub, months);
    const discountAmount = discountPercent
      ? Math.round((regularTotal * discountPercent) / 100)
      : undefined;
    const total = discountAmount ? regularTotal - discountAmount : regularTotal;
    const now = dayjs();
    const paidUntil = dayjs(sub.paidUntil);
    const freeMonthDaysCarried = sub.freeMonthUntil
      ? Math.max(paidUntil.diff(now, 'day'), 0)
      : undefined;
    return {
      businessId,
      kind: biz.kind,
      months,
      seats,
      breakdown,
      monthlyTotal,
      regularTotal,
      total,
      discountPercent,
      discountAmount,
      freeMonthDaysCarried,
    };
  });
}

export function useQuotePrice(
  businessId: Id | undefined,
  months: number,
  options?: QueryOptions,
) {
  return useApiQuery(
    ['settings', 'quote', businessId, months],
    () => quotePrice(businessId ?? '', months),
    {
      ...options,
      enabled: Boolean(businessId) && (options?.enabled ?? true),
    },
  );
}

/** Кто занимает платные места сейчас — для «Тарифа» и ссылки «Кто в плате» (F-15-045) */
export function getBillingSeats(businessId: Id): Promise<SeatLine[]> {
  if (isApiMode()) return S.getBillingSeats(businessId);
  return request(() => computeSeats(business(businessId)).seats);
}

/** Как изменится сумма при добавлении/увольнении сотрудников (F-15-051, F-00-013) — предпросмотр для формы staff */
export function previewPriceChange(
  businessId: Id,
  delta: { masters?: number; admins?: number },
): Promise<{ before: number; after: number }> {
  if (isApiMode()) return S.previewPriceChange(businessId, delta);
  return request(() => {
    const biz = business(businessId);
    const { monthlyTotal: before } = computeSeats(biz);
    if (biz.kind === 'individual') return { before, after: before };
    const staff = readCore().staff.filter(
      (s) => s.businessId === businessId && s.status !== 'fired',
    );
    const masterCount =
      staff.filter(
        (s) =>
          (s.role === 'master' && !s.assistantOnly) ||
          (s.role === 'owner' && isBillableMaster(s.id)),
      ).length + (delta.masters ?? 0);
    const adminCount =
      staff.filter((s) => s.role === 'admin').length + (delta.admins ?? 0);
    const billedMasters = Math.max(masterCount, MIN_PAID_MASTERS);
    const paidAdmins = Math.max(adminCount - 1, 0);
    const after =
      billedMasters * MASTER_SEAT_PRICE + paidAdmins * ADMIN_EXTRA_SEAT_PRICE;
    return { before, after };
  });
}

// ─────────────────────────── Подписка, срок, автопродление ───────────────────────────

function subscriptionOf(businessId: Id): Subscription {
  const record = readArea('settings').subscriptions[businessId];
  // Бизнес без записи подписки — только что зарегистрирован сам (F-00-019): пробный период 7 дней
  const base: Subscription = record ?? introTrial(businessId);
  // Промокод, погашенный при регистрации (F-00-020, api/client.registerBusiness → platform.redeemPromo), живёт в
  // срезе нашей панели — подписка раньше о нём не знала, и скидка не появлялась нигде (QA 30.09)
  if (base.promoApplied) return base;
  const promo = registrationPromo(businessId);
  return promo ? { ...base, promoApplied: promo.code } : base;
}

/** Пробный период самостоятельной регистрации (F-00-019, владелец 01.10.2026): 7 дней, потом обычное «продлите» */
export const INTRO_TRIAL_DAYS = 7;

function introTrial(businessId: Id): Subscription {
  const until = toISODate(dayjs().add(INTRO_TRIAL_DAYS, 'day'));
  return { businessId, paidUntil: until, trialUntil: until, autoRenew: true, frozen: false };
}

/**
 * Открыть пробный период новому бизнесу (F-00-019) — конец регистрации. Бизнес, подключённый на визите, получает
 * бесплатный месяц через нашу панель (grantFreeMonth), а не это. Промокод регистрации действует на первую оплату.
 */
export function startIntroTrial(businessId: Id): Promise<Subscription> {
  return request(() => {
    const trial = introTrial(businessId);
    mutateArea('settings', (s) => {
      s.subscriptions[businessId] = trial;
    });
    return trial;
  });
}

/** Скидочный промокод, который этот бизнес погасил при регистрации (срез нашей панели) */
function registrationPromo(businessId: Id): PromoCode | undefined {
  const codes = (readArea('platform') as { promoCodes?: PromoCode[] } | undefined)?.promoCodes ?? [];
  return codes.find((p) => p.usedByBusinessId === businessId && p.kind === 'discount' && !p.revokedAt);
}

/**
 * Скидка промокода на оплату `months` месяцев (F-00-020/021): одна оплата, пока код не потрачен; у кода регистрации
 * процент зависит от срока — берём ступень с наибольшим числом месяцев, не больше выбранного (1 мес. — 0 %).
 */
function promoPercentFor(businessId: Id, sub: Subscription, months: number): number | undefined {
  if (sub.promoUsed) return undefined;
  if (sub.promoDiscountPercent) return sub.promoDiscountPercent;
  const promo = registrationPromo(businessId);
  if (!promo) return undefined;
  const tier = promo.tiers.filter((x) => x.months <= months).sort((a, b) => b.months - a.months)[0];
  return tier && tier.percent > 0 ? tier.percent : undefined;
}

export type SubscriptionStatus =
  'active' | 'freeMonth' | 'trial' | 'endingSoon' | 'frozen';

export interface SubscriptionView extends Subscription {
  status: SubscriptionStatus;
  daysLeft: number;
  quote: PriceQuote;
  /** Сервер: принимает ли оплату картой / Idram / Telcell (нет — `false`); демо — всегда можно (поля нет) */
  paymentsAvailable?: boolean;
}

/**
 * Можно ли платить картой / Idram / Telcell (06.10.2026, F-00-022/026). Платёжный провайдер ещё не подключён —
 * на сервере оплата выключена (`paymentsAvailable: false`, 503 `payments_unavailable`); экраны вместо оплаты
 * показывают «Оплата картой скоро — напишите нам». Демо — оплата работает как раньше.
 */
export function cardPaymentsAvailable(sub: Pick<SubscriptionView, 'paymentsAvailable'> | undefined): boolean {
  return sub?.paymentsAvailable !== false;
}

/** Ошибка «оплата картой пока недоступна» от сервера */
export function isPaymentsUnavailable(e: unknown): boolean {
  return e instanceof ApiError && e.code === 'payments_unavailable';
}

/** Подписка бизнеса + срок + тариф — карточки «Срок действия»/«Тариф» (F-15-070/071/091, F-15-058) */
export function getSubscription(businessId: Id): Promise<SubscriptionView> {
  if (isApiMode()) return S.getSubscription(businessId);
  return request(() => {
    const sub = subscriptionOf(businessId);
    const biz = business(businessId);
    const { seats, breakdown, monthlyTotal } = computeSeats(biz);
    const daysLeft = dayjs(sub.paidUntil)
      .startOf('day')
      .diff(dayjs().startOf('day'), 'day');
    // F-15-092: предупреждаем за 7, 3 и 1 день до конца лицензии (F-00-023) — не только за 3.
    const inTrial = Boolean(sub.trialUntil) && daysLeft >= 0;
    const status: SubscriptionStatus = sub.frozen
      ? 'frozen'
      : sub.freeMonthUntil
        ? 'freeMonth'
        : inTrial
          ? 'trial'
          : daysLeft <= 7
          ? 'endingSoon'
          : 'active';
    return {
      ...sub,
      status,
      daysLeft,
      quote: {
        businessId,
        kind: biz.kind,
        months: 1,
        seats,
        breakdown,
        monthlyTotal,
        regularTotal: monthlyTotal,
        total: monthlyTotal,
      },
    };
  });
}

export function useSubscription(
  businessId: Id | undefined,
  options?: QueryOptions,
) {
  return useApiQuery(
    ['settings', 'subscription', businessId],
    () => getSubscription(businessId ?? ''),
    {
      ...options,
      enabled: Boolean(businessId) && (options?.enabled ?? true),
    },
  );
}

export function toggleAutoRenew(input: {
  businessId: Id;
  autoRenew: boolean;
}): Promise<Subscription> {
  if (isApiMode()) return S.toggleAutoRenew(input.businessId, input.autoRenew);
  return request(
    () => {
      assertCan('billing.manage'); // F-15-069
      return mutateArea('settings', (s) => {
        const current =
          s.subscriptions[input.businessId] ?? subscriptionOf(input.businessId);
        s.subscriptions[input.businessId] = {
          ...current,
          autoRenew: input.autoRenew,
        };
      }).subscriptions[input.businessId];
    },
  );
}

/**
 * Оплатить/продлить лицензию (F-15-070/074) — мок: реального биллинга нет, продлевает paidUntil на
 * месяцы от максимума(сегодня, текущего paidUntil) и добавляет запись в историю оплат. Снимает заморозку.
 */
export function payNow(input: {
  businessId: Id;
  months?: number;
}): Promise<Subscription> {
  if (isApiMode()) return S.pay(input.businessId, input.months ?? 1, 'card').then(() => S.getSubscription(input.businessId));
  return request(() => {
    assertCan('billing.manage'); // F-15-069: деньги бизнеса — не только спрятать экран, но и закрыть действие
    const months = input.months ?? 1;
    const biz = business(input.businessId);
    const { monthlyTotal } = computeSeats(biz);
    const amount = monthlyTotal * months;
    const updated = mutateArea('settings', (s) => {
      const current =
        s.subscriptions[input.businessId] ?? subscriptionOf(input.businessId);
      const now = dayjs();
      const currentUntil = dayjs(current.paidUntil);
      const base = currentUntil.isAfter(now) ? currentUntil : now;
      const paidUntil = toISODate(base.add(months, 'month'));
      s.subscriptions[input.businessId] = {
        ...current,
        paidUntil,
        frozen: false,
        freeMonthUntil: undefined,
        trialUntil: undefined,
      };
      const invoiceId = newId('inv');
      s.payments.unshift({
        id: `pay_${Date.now()}`,
        businessId: input.businessId,
        date: dayjs().toISOString(),
        periodMonths: months,
        amount,
        method: 'card',
        status: 'success',
        invoiceId,
      });
      s.invoices.unshift({
        id: invoiceId,
        businessId: input.businessId,
        number: String(1000 + s.invoices.length),
        purpose: 'subscription',
        amount,
        status: 'paid',
        date: dayjs().toISOString(),
        periodFrom: toISODate(dayjs()),
        periodTo: toISODate(dayjs().add(months, 'month')),
        method: 'card',
      });
    });
    return updated.subscriptions[input.businessId];
  });
}

/**
 * Оплата на /biz/billing/checkout (F-15-083/084, F-00-022): продление лицензии выбранным способом.
 * «Счёт для фирмы» (F-15-084) — деньги ещё не пришли: выставляем неоплаченный счёт, срок НЕ продлеваем;
 * остальные способы — мок сразу успешен, продлевает срок и тратит промокод (F-00-021), если он был.
 */
export function checkoutPay(input: {
  businessId: Id;
  months: number;
  method: BillingPaymentMethod;
}): Promise<{ invoiceId: Id; status: 'paid' | 'unpaid' }> {
  if (isApiMode()) return S.pay(input.businessId, input.months, input.method).then((r) => ({ invoiceId: r.invoiceId ?? '', status: r.status === 'paid' ? ('paid' as const) : ('unpaid' as const) }));
  return request(() => {
    assertCan('billing.manage'); // F-15-069: деньги бизнеса — не только спрятать экран, но и закрыть действие
    const biz = business(input.businessId);
    const quote = { businessId: input.businessId, ...computeSeats(biz) };
    const sub = subscriptionOf(input.businessId);
    const promoPercent = promoPercentFor(input.businessId, sub, input.months);
    const regularTotal = quote.monthlyTotal * input.months;
    const amount = promoPercent
      ? regularTotal - Math.round((regularTotal * promoPercent) / 100)
      : regularTotal;
    const now = dayjs();
    const invoiceId = newId('inv');

    if (input.method === 'invoice') {
      mutateArea('settings', (s) => {
        const legal = s.legalInfo[input.businessId];
        s.invoices.unshift({
          id: invoiceId,
          businessId: input.businessId,
          number: String(1000 + s.invoices.length),
          purpose: 'subscription',
          amount,
          status: 'unpaid',
          date: now.toISOString(),
          periodFrom: toISODate(now),
          periodTo: toISODate(now.add(input.months, 'month')),
          method: 'card',
          payer: legal?.companyName
            ? {
                name: legal.companyName,
                address: legal.billingAddress ?? legal.legalAddress ?? '',
                taxId: legal.taxId,
              }
            : undefined,
        });
      });
      return { invoiceId, status: 'unpaid' };
    }

    mutateArea('settings', (s) => {
      const current =
        s.subscriptions[input.businessId] ?? subscriptionOf(input.businessId);
      const currentUntil = dayjs(current.paidUntil);
      const base = currentUntil.isAfter(now) ? currentUntil : now;
      const paidUntil = toISODate(base.add(input.months, 'month'));
      s.subscriptions[input.businessId] = {
        ...current,
        paidUntil,
        frozen: false,
        freeMonthUntil: undefined,
        trialUntil: undefined,
        promoApplied: current.promoApplied ?? sub.promoApplied,
        promoUsed: promoPercent ? true : current.promoUsed,
        savedPaymentMethod:
          input.method === 'card'
            ? current.savedPaymentMethod
            : { method: input.method, label: t_methodLabel(input.method) },
      };
      s.payments.unshift({
        id: `pay_${Date.now()}`,
        businessId: input.businessId,
        date: now.toISOString(),
        periodMonths: input.months,
        amount,
        method: promoPercent ? 'promo' : 'card',
        status: 'success',
        invoiceId,
      });
      const legal = s.legalInfo[input.businessId];
      s.invoices.unshift({
        id: invoiceId,
        businessId: input.businessId,
        number: String(1000 + s.invoices.length),
        purpose: 'subscription',
        amount,
        status: 'paid',
        date: now.toISOString(),
        periodFrom: toISODate(base),
        periodTo: toISODate(base.add(input.months, 'month')),
        method: 'card',
        payer: legal?.companyName
          ? {
              name: legal.companyName,
              address: legal.billingAddress ?? legal.legalAddress ?? '',
              taxId: legal.taxId,
            }
          : undefined,
      });
    });
    return { invoiceId, status: 'paid' };
  });
}

function t_methodLabel(method: string): string {
  return method === 'idram'
    ? 'Idram'
    : method === 'telcell'
      ? 'Telcell'
      : method;
}

export function getInvoice(businessId: Id, invoiceId: Id): Promise<Invoice> {
  if (isApiMode()) return S.getInvoice(businessId, invoiceId);
  return request(() => {
    const invoice = readArea('settings').invoices.find(
      (i) => i.id === invoiceId && i.businessId === businessId,
    );
    if (!invoice) throw new ApiError('not_found', 'Счёт не найден');
    return invoice;
  });
}

export function getLegalInfo(businessId: Id): Promise<LegalInfo> {
  if (isApiMode()) return S.getLegalInfo(businessId);
  return request(() => readArea('settings').legalInfo[businessId] ?? {});
}

/** Плитки шага анкеты «Цели» (F-15-007) — переводы в client.registerBusiness.goal.<id> */
export const ONBOARDING_GOAL_IDS = [
  'retainClients',
  'onlineBooking',
  'teamPerformance',
  'inventory',
  'financialRecords',
  'automateComms',
  'clientFeedback',
  'payroll',
  'discountsLoyalty',
  'clientBase',
] as const;
export type OnboardingGoalId = (typeof ONBOARDING_GOAL_IDS)[number];

/** Цели выбранные при регистрации (F-15-007) — сохраняются в карточке бизнеса, ни одна не обязательна */
export function saveOnboardingGoals(input: { businessId: Id; goals: OnboardingGoalId[] }): Promise<void> {
  if (isApiMode()) return S.saveOnboarding(input.businessId, { goals: input.goals }).then(() => undefined);
  // Пробный период (F-00-019) открывает сама регистрация — RegisterBusinessScreen зовёт startIntroTrial сразу после
  // registerBusiness; анкета целей его больше не трогает (иначе повторное сохранение целей начинало бы пробный заново)
  return request(() => {
    mutateArea('settings', (s) => {
      s.onboardingGoals[input.businessId] = input.goals;
    });
  });
}

export function getOnboardingGoals(businessId: Id): Promise<OnboardingGoalId[]> {
  if (isApiMode()) return S.getOnboarding(businessId).then((o) => (o.goals ?? []) as OnboardingGoalId[]);
  return request(
    () => (readArea('settings').onboardingGoals[businessId] ?? []) as OnboardingGoalId[],
  );
}

/** Адрес для счёта / реквизиты плательщика (F-15-088) — правка со страницы оплаты и со счёта */
export function saveBillingAddress(input: {
  businessId: Id;
  billingAddress: string;
}): Promise<void> {
  if (isApiMode()) return S.saveBillingAddress(input.businessId, input.billingAddress).then(() => undefined);
  return request(() => {
    assertCan('billing.manage'); // F-15-069: деньги бизнеса — не только спрятать экран, но и закрыть действие
    mutateArea('settings', (s) => {
      const current = s.legalInfo[input.businessId] ?? {};
      s.legalInfo[input.businessId] = {
        ...current,
        billingAddress: input.billingAddress,
      };
    });
  });
}

/** Бесплатный месяц при подключении на визите (F-00-019) — зовёт platform; здесь наша сторона */
export function grantFreeMonth(businessId: Id): Promise<Subscription> {
  return request(
    () =>
      mutateArea('settings', (s) => {
        const current =
          s.subscriptions[businessId] ?? subscriptionOf(businessId);
        const until = toISODate(dayjs().add(30, 'day'));
        s.subscriptions[businessId] = {
          ...current,
          freeMonthUntil: until,
          paidUntil: until,
          frozen: false,
        };
      }).subscriptions[businessId],
  );
}

/** Бизнес виден клиентам и в каталоге (F-00-024) — заморозка за неоплату прячет его */
export function isBusinessVisible(businessId: Id): Promise<boolean> {
  if (isApiMode()) return S.getSubscription(businessId).then((sub) => !sub.frozen && sub.serverStatus !== 'unpaid');
  return request(() => !subscriptionOf(businessId).frozen);
}

/** Полоса предупреждений «заканчивается через 7/3/1 день» (F-00-023, F-15-058/064) */
export function subscriptionWarnings(
  businessId: Id,
): Promise<SubscriptionWarning[]> {
  if (isApiMode()) return S.subscriptionWarnings(businessId);
  return request(() => {
    const sub = subscriptionOf(businessId);
    if (sub.frozen)
      return [
        {
          level: 'danger',
          daysLeft: 0,
          messageKey: 'billing.warning.frozen',
        } as const,
      ];
    const daysLeft = dayjs(sub.paidUntil)
      .startOf('day')
      .diff(dayjs().startOf('day'), 'day');
    if (daysLeft > 7) return [];
    const level = daysLeft <= 1 ? 'danger' : daysLeft <= 3 ? 'warning' : 'info';
    return [
      {
        level,
        daysLeft: Math.max(daysLeft, 0),
        messageKey: 'billing.warning.endingSoon',
      },
    ];
  });
}

/** Сохранённый способ оплаты для автопродления (F-15-082) — может быть недоступен (F-15-090) */
export function getSavedPaymentMethod(businessId: Id) {
  if (isApiMode()) return S.getSubscription(businessId).then((sub) => sub.savedPaymentMethod ?? null);
  return request(() => subscriptionOf(businessId).savedPaymentMethod ?? null);
}

/**
 * Калькулятор цены до регистрации (F-15-178) — та же формула, что и после (⭐ индивидуал 5 000, мастер 4 000,
 * администратор сверх первого 2 000, минимум 2 платных мастера у салона), без привязки к businessId.
 * Переключателя «с промокодом для всех» нет — калькулятор всегда показывает цену без скидки (Снято 16).
 */
export function calculatePriceForPlan(input: {
  kind: BusinessKind;
  masters: number;
  admins: number;
  months: number;
}): PriceQuote {
  const masters = Math.max(0, Math.round(input.masters));
  const admins = Math.max(0, Math.round(input.admins));
  const months = Math.max(1, Math.round(input.months));
  if (input.kind === 'individual') {
    return {
      businessId: '',
      kind: 'individual',
      months,
      seats: [],
      breakdown: [
        {
          labelKey: 'billing.breakdown.individual',
          count: 1,
          unitPrice: INDIVIDUAL_PRICE,
          amount: INDIVIDUAL_PRICE,
        },
      ],
      monthlyTotal: INDIVIDUAL_PRICE,
      regularTotal: INDIVIDUAL_PRICE * months,
      total: INDIVIDUAL_PRICE * months,
    };
  }
  const billedMasters = Math.max(masters, MIN_PAID_MASTERS);
  const paidAdmins = Math.max(admins - 1, 0);
  const breakdown: PriceBreakdownLine[] = [
    {
      labelKey: 'billing.breakdown.masters',
      count: billedMasters,
      unitPrice: MASTER_SEAT_PRICE,
      amount: billedMasters * MASTER_SEAT_PRICE,
    },
  ];
  if (paidAdmins > 0)
    breakdown.push({
      labelKey: 'billing.breakdown.admins',
      count: paidAdmins,
      unitPrice: ADMIN_EXTRA_SEAT_PRICE,
      amount: paidAdmins * ADMIN_EXTRA_SEAT_PRICE,
    });
  const monthlyTotal = breakdown.reduce((sum, l) => sum + l.amount, 0);
  return {
    businessId: '',
    kind: 'salon',
    months,
    seats: [],
    breakdown,
    monthlyTotal,
    regularTotal: monthlyTotal * months,
    total: monthlyTotal * months,
  };
}

// ─────────────────────────── История оплат и счета ───────────────────────────

export function listPayments(businessId: Id): Promise<SubscriptionPayment[]> {
  if (isApiMode()) return S.listPayments(businessId);
  return request(() =>
    readArea('settings')
      .payments.filter((p) => p.businessId === businessId)
      .sort((a, b) => b.date.localeCompare(a.date)),
  );
}

export function listInvoices(
  businessId: Id,
  filter?: { purpose?: InvoicePurpose },
): Promise<Invoice[]> {
  if (isApiMode()) return S.listInvoices(businessId, filter?.purpose);
  return request(() =>
    readArea('settings')
      .invoices.filter(
        (i) =>
          i.businessId === businessId &&
          (!filter?.purpose || i.purpose === filter.purpose),
      )
      .sort((a, b) => b.date.localeCompare(a.date)),
  );
}

// ─────────────────────────── Монеты (F-00-026/027) — баланс/движения считает ЯДРО ───────────────────────────

/** Пакеты покупки монет (F-00-026) — суммы предложены, владелец их не утвердил (пометка на экране) */
const COIN_PACKAGES: CoinPackage[] = [
  // В-15: 1 монета = 10 ֏, пакеты 100 / 500 (+5 %) / 2 000 (+10 %) — те же, что таблица сервера (этап 18)
  { id: 'coins_100', coins: 100, price: 1000 },
  { id: 'coins_500', coins: 500, price: 5000, bonusPercent: 5, popular: true },
  { id: 'coins_2000', coins: 2000, price: 20000, bonusPercent: 10 },
];

export function listCoinPackages(): Promise<CoinPackage[]> {
  if (isApiMode() && apiIdentity()?.businessId) return S.listCoinPackages(apiIdentity()?.businessId ?? '');
  return request(() => COIN_PACKAGES);
}

export function purchaseCoinPackage(input: {
  businessId: Id;
  packageId: string;
}): Promise<CoinMove> {
  if (isApiMode()) return S.purchaseCoinPackage(input.businessId, input.packageId);
  return request(() => {
    assertCan('billing.manage'); // F-15-069: деньги бизнеса — не только спрятать экран, но и закрыть действие
    const pkg = COIN_PACKAGES.find((p) => p.id === input.packageId);
    if (!pkg) throw new ApiError('not_found', 'Пакет не найден');
    const amount = Math.round(pkg.coins * (1 + (pkg.bonusPercent ?? 0) / 100));
    return coreTx.grantCoins({
      businessId: input.businessId,
      amount,
      reason: 'purchase',
      area: 'settings',
      kind: 'topup',
    });
  });
}

/** Списать монеты (сторис, фото сверх 6…) — для других разделов (F-00-027); нет средств → ApiError('not_enough_coins') */
export function spendCoins(input: {
  businessId: Id;
  amount: number;
  reason: string;
  area: string;
  refId?: Id;
}): Promise<CoinMove> {
  if (isApiMode()) return S.spendCoins(input);
  return request(() => coreTx.chargeCoins(input));
}

/** Вернуть монеты (отказ модерации и т.п.) — для других разделов */
export function refundCoins(input: {
  businessId: Id;
  amount: number;
  reason: string;
  area: string;
  refId?: Id;
}): Promise<CoinMove> {
  return request(() => coreTx.grantCoins({ ...input, kind: 'refund' }));
}

// ─────────────────────────── Профиль компании и чек-лист старта (F-15-022/023) ───────────────────────────

function companyProfileOf(businessId: Id): CompanyProfileSummary {
  const biz = business(businessId);
  const legal = readArea('settings').legalInfo[businessId];
  const fields: CompanyProfileSummary['fields'] = [
    { id: 'name', done: biz.name.trim().length > 0 },
    {
      id: 'description',
      done: Boolean(pickText(biz.description, 'ru').trim()),
    },
    { id: 'logo', done: Boolean(biz.logoUrl) },
    { id: 'contacts', done: Boolean(biz.phone) },
    { id: 'photos', done: biz.photos.length > 0 },
    { id: 'legal', done: Boolean(legal?.taxId) },
  ];
  const percent = Math.round(
    (fields.filter((f) => f.done).length / fields.length) * 100,
  );
  return { businessId, kind: biz.kind, fields, percent };
}

export function getCompanyProfile(
  businessId: Id,
): Promise<CompanyProfileSummary> {
  if (isApiMode()) return S.getCompanyProfile(businessId);
  return request(() => companyProfileOf(businessId));
}

export function useCompanyProfile(
  businessId: Id | undefined,
  options?: QueryOptions,
) {
  return useApiQuery(
    ['settings', 'companyProfile', businessId],
    () => getCompanyProfile(businessId ?? ''),
    {
      ...options,
      enabled: Boolean(businessId) && (options?.enabled ?? true),
    },
  );
}

/** Чек-лист первых шагов (F-15-022) — отметки по данным ядра, каждый пункт ведёт на свой экран */
export function getOnboardingChecklist(
  businessId: Id,
): Promise<OnboardingStep[]> {
  if (isApiMode()) return S.getOnboardingChecklist(businessId);
  return request(() => {
    const core = readCore();
    const staff = core.staff.filter(
      (s) => s.businessId === businessId && s.status !== 'fired',
    );
    const services = core.services.filter((s) => s.businessId === businessId);
    const hasSchedule = core.schedules.some((sch) =>
      staff.some((s) => s.id === sch.staffId),
    );
    const profile = companyProfileOf(businessId);
    const steps: OnboardingStep[] = [
      { id: 'services', done: services.length > 0, href: '/biz/services' },
      // Индивидуал сам себе мастер: «добавьте сотрудников» ему не нужно (и права staff.manage у него нет) —
      // раньше шаг навсегда оставался невыполненным и вёл на недоступный экран (QA 30.09)
      {
        id: 'staff',
        done: staff.length > 1 || core.businesses.find((b) => b.id === businessId)?.kind === 'individual',
        href: '/biz/staff',
      },
      // Переезд с Altegio / Excel (04.10.2026): база клиентов загружена или уже набралась из записей
      { id: 'clients', done: core.clients.some((c) => c.businessId === businessId && !c.deletedAt), href: '/biz/clients/import' },
      {
        id: 'staffServices',
        done: services.some((s) => s.staffIds.length > 0),
        href: '/biz/services',
      },
      { id: 'schedule', done: hasSchedule, href: '/biz/schedule' },
      {
        id: 'online',
        done: services.some((s) => s.onlineBookable),
        href: '/biz/online',
      },
      // percent===100, не «>=80»: иначе чек-лист может показать «профиль готов», пока в самой карточке
      // профиля ещё виден незачёркнутый пункт — те же данные должны говорить одно и то же (F-15-022/023).
      {
        id: 'profile',
        done: profile.percent >= 100,
        href: '/biz/settings/brand',
      },
    ];
    return steps;
  });
}

export function useOnboardingChecklist(
  businessId: Id | undefined,
  options?: QueryOptions,
) {
  return useApiQuery(
    ['settings', 'onboardingChecklist', businessId],
    () => getOnboardingChecklist(businessId ?? ''),
    {
      ...options,
      enabled: Boolean(businessId) && (options?.enabled ?? true),
    },
  );
}

// ─────────────────────────── Помощь и поддержка (F-15-001) ───────────────────────────
// «Из любого экрана кабинета есть вход в помощь и поддержку». Полноценная переписка с реальным агентом —
// пачка b05; здесь — рабочий канал обращения (форма → список своих обращений), сигнатуры стабильны, так что
// b05 сможет достроить статусы/ответы сверху без переезда.

export function listHelpRequests(businessId: Id): Promise<HelpRequest[]> {
  if (isApiMode()) return S.listHelpRequests(businessId);
  return request(() =>
    readArea('settings')
      .helpRequests.filter((r) => r.businessId === businessId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  );
}

export function createHelpRequest(input: {
  businessId: Id;
  authorStaffId: Id;
  topic: HelpRequest['topic'];
  message: string;
}): Promise<HelpRequest> {
  if (isApiMode()) return S.createHelpRequest(input.businessId, input.topic, input.message);
  return request(() => {
    const item: HelpRequest = {
      id: newId('help'),
      businessId: input.businessId,
      authorStaffId: input.authorStaffId,
      topic: input.topic,
      message: input.message,
      createdAt: toISODateTime(new Date()),
      status: 'open',
    };
    mutateArea('settings', (s) => {
      s.helpRequests.push(item);
    });
    return item;
  });
}

// ────────── Мобильные приложения: заявка на своё приложение (F-03-048, F-14-164, F-14-171, В-29) ──────────

/** Есть ли уже отправленная заявка на своё приложение (не показываем кнопку заново, пока не появился второй сценарий) */
export function listMobileAppOrderRequests(businessId: Id): Promise<MobileAppOrderRequest[]> {
  if (isApiMode()) return S.listMobileAppOrderRequests(businessId);
  return request(() =>
    readArea('settings')
      .mobileAppOrderRequests.filter((r) => r.businessId === businessId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  );
}

export function createMobileAppOrderRequest(input: {
  businessId: Id;
  authorStaffId: Id;
}): Promise<MobileAppOrderRequest> {
  if (isApiMode()) return S.createMobileAppOrderRequest(input.businessId);
  return request(() => {
    const item: MobileAppOrderRequest = {
      id: newId('appreq'),
      businessId: input.businessId,
      authorStaffId: input.authorStaffId,
      createdAt: toISODateTime(new Date()),
      status: 'open',
    };
    mutateArea('settings', (s) => {
      s.mobileAppOrderRequests.push(item);
    });
    return item;
  });
}

// ─────────────────────────── Моей сферы нет (F-15-005, b02) ───────────────────────────

export function listSphereRequests(businessId: Id): Promise<SphereRequest[]> {
  if (isApiMode()) return S.listSphereRequests(businessId);
  return request(() =>
    readArea('settings')
      .sphereRequests.filter((r) => r.businessId === businessId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  );
}

export function submitSphereRequest(input: {
  businessId: Id;
  authorStaffId: Id;
  name: string;
  message?: string;
}): Promise<SphereRequest> {
  if (isApiMode()) return S.submitSphereRequest(input.businessId, input.name, input.message);
  return request(() => {
    const item: SphereRequest = {
      id: newId('sphreq'),
      businessId: input.businessId,
      authorStaffId: input.authorStaffId,
      name: input.name,
      message: input.message,
      createdAt: toISODateTime(new Date()),
      status: 'open',
    };
    mutateArea('settings', (s) => {
      s.sphereRequests.push(item);
    });
    return item;
  }).then(async (item) => {
    // F-00-151 «его запрос появляется в нашей панели»: очередь заявок нашей панели живёт в её срезе — раньше
    // заявка оставалась только у бизнеса и до нас не доходила (QA 30.09)
    const core = readCore();
    const author = core.staff.find((x) => x.id === input.authorStaffId);
    const biz = core.businesses.find((b) => b.id === input.businessId);
    await createSphereRequest({
      kind: 'noSphere',
      businessId: input.businessId,
      masterName: author?.name || biz?.name || input.name,
      phone: author?.phone || biz?.phone || '',
      sphereName: input.name,
      note: input.message,
    });
    return item;
  });
}

/**
 * Заявка на новую сферу с деталями (F-00-152) — чек-лист «что нужно» и срок готовности; заполняется, когда
 * заявку берут в работу (status = 'answered'). Годовая подписка на сферу начинается со дня, когда она готова
 * (readyAt) — видно в самой заявке; связь с /biz/billing («ждёт готовности сферы») — просьба фундаменту.
 */
export function getSphereRequestDetail(
  businessId: Id,
  requestId: Id,
): Promise<SphereRequest> {
  if (isApiMode()) return S.getSphereRequest(businessId, requestId);
  return request(() => {
    const item = readArea('settings').sphereRequests.find(
      (r) => r.id === requestId && r.businessId === businessId,
    );
    if (!item) throw new ApiError('not_found', 'Заявка не найдена');
    return item;
  });
}

/** Пункты чек-листа «что нужно» переведены — суффикс settings.sphereRequest.checklistStep.<labelKey> */
export type { SphereRequestChecklistItem };

// ─────────────────────────── Журнал изменений настроек компании (F-15-180) ───────────────────────────
// Каждая правка из «Компания/Системные/Категории» (b04) пишет сюда одну строку «было → стало». Просмотр —
// /biz/settings/history; передача записи в общий журнал сотрудников (F-00-040) — просьба (qa/requests/settings.md).

function logSettingsChange(
  businessId: Id,
  section: SettingsChangeSection,
  fieldKey: string,
  before: string,
  after: string,
  staffId: Id | undefined,
): void {
  if (!staffId || before === after) return;
  const staffName =
    readCore().staff.find((s) => s.id === staffId)?.name ?? '—';
  const entry: SettingsChangeLogEntry = {
    id: newId('schlog'),
    businessId,
    section,
    fieldKey,
    before,
    after,
    staffId,
    staffName,
    at: toISODateTime(new Date()),
  };
  mutateArea('settings', (s) => {
    s.changeLog.push(entry);
  });
}

export function getSettingsChangeLog(
  businessId: Id,
  section?: SettingsChangeSection,
): Promise<SettingsChangeLogEntry[]> {
  if (isApiMode()) return S.getSettingsChangeLog(businessId, section);
  return request(() =>
    readArea('settings')
      .changeLog.filter(
        (e) =>
          e.businessId === businessId && (!section || e.section === section),
      )
      .sort((a, b) => b.at.localeCompare(a.at)),
  );
}

// ─────────────────────────── Правила подписки (F-15-048/056/066/179) ───────────────────────────
// Новые цены объявляются заранее и действуют только с новой покупки — оплаченный срок идёт по старым
// условиям (F-15-048); история изменений — ниже (F-15-056); пока цена не наступила, можно продлить по
// старой цене (F-15-066, кнопка на /biz/billing и /biz/billing/terms).

export function listPriceRuleChanges(): Promise<PriceRuleChange[]> {
  if (isApiMode()) return S.listPriceRuleChanges(apiIdentity()?.businessId ?? '');
  return request(() =>
    [...readArea('settings').priceRuleChanges].sort((a, b) =>
      a.effectiveFrom.localeCompare(b.effectiveFrom),
    ),
  );
}

/** «Продлить по старой цене» (F-15-066) — покупка на months месяцев по цене, действовавшей до объявленного повышения */
export function lockInOldPrice(input: {
  businessId: Id;
  months: number;
}): Promise<Subscription> {
  return payNow({ businessId: input.businessId, months: input.months });
}

/** «Документы об оплате на почту» (F-15-093) — право billing.manage */
export function setPaymentDocsEmail(
  businessId: Id,
  value: boolean,
): Promise<Subscription> {
  if (isApiMode()) return S.setPaymentDocsEmail(businessId, value);
  return request(() => {
    mutateArea('settings', (s) => {
      const sub = s.subscriptions[businessId];
      if (sub) sub.paymentDocsEmail = value;
    });
    return subscriptionOf(businessId);
  });
}

// ─────────────────────────── Обучающий тур (F-15-021) ───────────────────────────
// «Структура платформы»: 4 карточки, показывается после быстрого старта и снова по запросу из /biz/onboarding.

export function getTourSeen(businessId: Id): Promise<boolean> {
  if (isApiMode()) return S.getOnboarding(businessId).then((o) => Boolean(o.tourSeen));
  return request(() => Boolean(readArea('settings').tourSeen[businessId]));
}

export function markTourSeen(businessId: Id): Promise<void> {
  if (isApiMode()) return S.saveOnboarding(businessId, { tourSeen: true }).then(() => undefined);
  return request(() => {
    mutateArea('settings', (s) => {
      s.tourSeen[businessId] = true;
    });
  });
}

// ─────────────────────────── Приглашение по ссылке (F-15-146) ───────────────────────────
// Упрощённый мок: ищет приглашение по токену из адреса. Настоящая связь с приглашениями сотрудников
// (`StaffInvite`, src/api/staff.ts) не сделана — см. qa/requests/settings.md.

/** Принять на сервере и сразу войти в этот бизнес («Мой бизнес», В-21) */
async function acceptOnServer(
  token: string,
  body: { name?: string; consent?: boolean },
): Promise<{ businessId: Id; businessName: string; role: OnboardingInvite['role'] }> {
  const res = await http<{ businessId: Id; businessName: string; role: OnboardingInvite['role'] }>(
    'POST',
    `/v1/me/invites/${encodeURIComponent(token)}/accept`,
    body,
  );
  await setSessionMode('business', res.businessId);
  await syncCore(res.businessId);
  return res;
}

export function getInviteByToken(
  token: string,
): Promise<OnboardingInvite | null> {
  // Живой сайт: приглашение сотрудника с сервера (этап 3, F-00-042) — номер под маской, в базе только хэш токена
  if (isApiMode()) return http<OnboardingInvite | null>('GET', `/v1/public/invites/${encodeURIComponent(token)}`);
  return request(
    () => readArea('settings').invites.find((i) => i.token === token) ?? null,
  );
}

/** Приглашённый без аккаунта заводит его и сразу попадает в салон (F-15-146) */
export function acceptInviteAsNew(input: {
  token: string;
  name: string;
  phone: string;
  consent: boolean;
  marketingOptIn: boolean;
}): Promise<{
  businessId: Id;
  businessName: string;
  role: OnboardingInvite['role'];
}> {
  if (isApiMode()) {
    // Кабинет открыт только вошедшему по коду: принимает приглашение человек с тем же номером (сервер сверяет)
    if (!input.consent) return Promise.reject(new ApiError('consent_required', 'Нужно принять условия'));
    return acceptOnServer(input.token, { name: input.name, consent: true });
  }
  return request(() => {
    if (!input.consent)
      throw new ApiError('consent_required', 'Нужно принять условия');
    let invite: OnboardingInvite | undefined;
    mutateArea('settings', (s) => {
      invite = s.invites.find((i) => i.token === input.token);
      if (!invite)
        throw new ApiError('not_found', 'Приглашение не найдено или отозвано');
      if (invite.status !== 'pending')
        throw new ApiError('already_used', 'Приглашение уже использовано');
      invite.status = 'accepted';
      invite.phone = input.phone;
    });
    if (!invite) throw new ApiError('not_found');
    return {
      businessId: invite.businessId,
      businessName: invite.businessName,
      role: invite.role,
    };
  });
}

/** Приглашённый с аккаунтом принимает приглашение своим обычным входом — просто отмечаем принятым (F-15-146) */
export function acceptInviteAsExisting(token: string): Promise<{
  businessId: Id;
  businessName: string;
  role: OnboardingInvite['role'];
}> {
  if (isApiMode()) return acceptOnServer(token, {});
  return request(() => {
    let invite: OnboardingInvite | undefined;
    mutateArea('settings', (s) => {
      invite = s.invites.find((i) => i.token === token);
      if (!invite)
        throw new ApiError('not_found', 'Приглашение не найдено или отозвано');
      invite.status = 'accepted';
    });
    if (!invite) throw new ApiError('not_found');
    return {
      businessId: invite.businessId,
      businessName: invite.businessName,
      role: invite.role,
    };
  });
}

// ─────────────────────────── Проверка бренда и фото (⭐ F-00-168, b04) ───────────────────────────
// «Бренд» (имя для клиентов, описание, логотип) и «Галерея» отправляются на нашу проверку; refKey — 'brand',
// 'logo' или url фото. moderationRefs[businessId][refKey] хранит id последней заявки — по нему смотрим статус.

/**
 * Короткий стабильный хеш (не крипто — только повторяемость): `ModerationItem.refId` — VARCHAR(64) на сервере, а
 * фото у нас data: URL в десятки килобайт (`ImageUpload`), сам url туда не влезает (этап 21, лейн rest: тот же
 * url раньше слали как есть — сервер бы отверг INSERT `Data too long for column 'ref_id'`, не поймано ни разу
 * живьём, потому что заглушка ниже никогда не доходила до сервера с этим значением).
 */
function fnv1a(s: string): string {
  let h1 = 0x811c9dc5,
    h2 = 0x9e3779b9;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619);
    h2 = Math.imul(h2 ^ c, 2246822519);
  }
  return (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36);
}

/**
 * refId стабильный, а не случайный (этап 21, лейн rest: было `newId('modref')` для текстовых полей — в api-режиме
 * его негде хранить между запросом и последующим getMediaReviewStatus, там нет мока с moderationRefs). Фото —
 * хеш их url (та же картинка → тот же refId, даже без стороннего хранилища); текстовые поля вроде 'brand' —
 * businessId+refKey. getMediaReviewStatus на чтении считает то же самое.
 */
function mediaRefId(businessId: Id, refKey: ModerationRefKey, imageUrl: string | undefined): string {
  return imageUrl ? `img_${fnv1a(imageUrl)}` : `${businessId}:${refKey}`;
}

async function submitMediaForReview(
  businessId: Id,
  refKey: ModerationRefKey,
  input: { kind: ModerationKind; text?: string; imageUrl?: string },
): Promise<void> {
  const item = await submitForModeration({
    kind: input.kind,
    businessId,
    refId: mediaRefId(businessId, refKey, input.imageUrl),
    text: input.text,
    imageUrl: input.imageUrl,
  });
  await request(() =>
    mutateArea('settings', (s) => {
      if (!s.moderationRefs[businessId]) s.moderationRefs[businessId] = {};
      s.moderationRefs[businessId][refKey] = item.id;
    }),
  );
}

/**
 * Статус последней проверки поля: 'auto' — ничего не отправляли (старый контент, виден сразу) или прошло без очереди.
 * Этап 21, лейн rest: было `if (isApiMode()) return 'auto'` — заглушка всегда говорила «видно», в живом режиме
 * фото в галерее и лого не показывали бейдж «на проверке»/«отклонено» вообще (F-00-168, найдено 28.09).
 */
export async function getMediaReviewStatus(
  businessId: Id,
  refKey: ModerationRefKey,
): Promise<'pending' | 'approved' | 'rejected' | 'auto'> {
  if (isApiMode()) {
    // Галерея зовёт этой же функцией с refKey = сам url фото (см. GalleryScreen) — mediaRefId хеширует его как
    // при отправке; именованные поля ('brand') передаются без url → составной ключ businessId:refKey.
    const isImageRef = /^(data:|https?:\/\/|\/)/.test(refKey);
    const refId = mediaRefId(businessId, refKey, isImageRef ? refKey : undefined);
    const item = await getModerationStatus(refId);
    return item?.status ?? 'auto';
  }
  const refId = await request(
    () => readArea('settings').moderationRefs[businessId]?.[refKey],
  );
  if (!refId) return 'auto';
  const item = await getModerationStatus(refId);
  return item?.status ?? 'auto';
}

export function useMediaReviewStatus(
  businessId: Id | undefined,
  refKey: ModerationRefKey,
  options?: QueryOptions,
) {
  return useApiQuery(
    ['settings', 'mediaReview', businessId, refKey],
    () => getMediaReviewStatus(businessId ?? '', refKey),
    {
      ...options,
      enabled: Boolean(businessId) && (options?.enabled ?? true),
    },
  );
}

// ─────────────────────────── Бренд (F-15-100…103) ───────────────────────────

export interface BrandData {
  brandName: string;
  descriptionRu: string;
  descriptionAutoLangs: ('hy' | 'en')[];
  logoUrl?: string;
}

export function getBrand(businessId: Id): Promise<BrandData> {
  if (isApiMode()) return S.getBrand(businessId);
  return request(() => {
    const biz = business(businessId);
    return {
      brandName: biz.brandName ?? '',
      descriptionRu: pickText(biz.description, 'ru'),
      descriptionAutoLangs:
        readArea('settings').descriptionAutoLangs[businessId] ?? [],
      logoUrl: biz.logoUrl,
    };
  });
}

export function useBrand(businessId: Id | undefined, options?: QueryOptions) {
  return useApiQuery(
    ['settings', 'brand', businessId],
    () => getBrand(businessId ?? ''),
    {
      ...options,
      enabled: Boolean(businessId) && (options?.enabled ?? true),
    },
  );
}

/**
 * Сохраняет имя для клиентов, описание и логотип (F-15-100…102) и отправляет изменившееся на проверку.
 * ⭐ Описание пишется на своём языке (ru) и переводится автоматически на hy/en с пометкой (F-00-174) — сам
 * перевод здесь заглушка (копия текста), реальный движок перевода не подключён.
 */
export async function saveBrand(input: {
  businessId: Id;
  brandName: string;
  descriptionRu: string;
  logoUrl?: string;
  /** Кто правит (F-15-180) — если не передано, изменение не пишется в журнал */
  staffId?: Id;
}): Promise<BrandData> {
  if (isApiMode()) return S.saveBrand(input.businessId, { brandName: input.brandName, descriptionRu: input.descriptionRu, logoUrl: input.logoUrl });
  const before = await request(() => business(input.businessId));
  const nameChanged = (before.brandName ?? '') !== input.brandName;
  const descriptionChanged =
    pickText(before.description, 'ru') !== input.descriptionRu;
  const logoChanged = (before.logoUrl ?? '') !== (input.logoUrl ?? '');
  if (nameChanged)
    logSettingsChange(
      input.businessId,
      'brand',
      'name',
      before.brandName ?? '',
      input.brandName,
      input.staffId,
    );
  if (descriptionChanged)
    logSettingsChange(
      input.businessId,
      'brand',
      'description',
      pickText(before.description, 'ru'),
      input.descriptionRu,
      input.staffId,
    );

  await coreUpdate('businesses', input.businessId, {
    brandName: input.brandName,
    description: input.descriptionRu
      ? {
          ru: input.descriptionRu,
          hy: input.descriptionRu,
          en: input.descriptionRu,
        }
      : undefined,
    logoUrl: input.logoUrl,
  });
  await request(() =>
    mutateArea('settings', (s) => {
      s.descriptionAutoLangs[input.businessId] = input.descriptionRu
        ? ['hy', 'en']
        : [];
    }),
  );

  if (nameChanged || descriptionChanged) {
    await submitMediaForReview(input.businessId, 'brand', {
      kind: 'text',
      text: `${input.brandName} — ${input.descriptionRu}`,
    });
  }
  if (logoChanged && input.logoUrl) {
    await submitMediaForReview(input.businessId, 'logo', {
      kind: 'salonPhoto',
      imageUrl: input.logoUrl,
    });
  }
  return getBrand(input.businessId);
}

// ─────────────────────────── Контакты (F-15-104…110) ───────────────────────────

export interface ContactsData {
  locationId?: Id;
  addressRu: string;
  district: Location['district'] | undefined;
  yandexMapsUrl?: string;
  hasPin: boolean;
  hoursText?: string;
  phones: string[];
  socials: SocialLinks;
}

function primaryLocation(businessId: Id): Location | undefined {
  const biz = business(businessId);
  return (
    readCore().locations.find((l) => l.businessId === businessId) ??
    readCore().locations.find((l) => l.id === biz.locationIds[0])
  );
}

export function getContacts(businessId: Id): Promise<ContactsData> {
  if (isApiMode()) return S.getContacts<ContactsData>(businessId);
  return request(() => {
    const biz = business(businessId);
    const loc = primaryLocation(businessId);
    return {
      locationId: loc?.id,
      addressRu: pickText(loc?.address, 'ru'),
      district: loc?.district,
      yandexMapsUrl: loc?.yandexMapsUrl,
      hasPin: Boolean(loc?.coords),
      hoursText: loc?.hoursText,
      phones: [biz.phone, ...(loc?.extraPhones ?? [])].filter(Boolean),
      socials: biz.socials ?? {},
    };
  });
}

export function useContacts(
  businessId: Id | undefined,
  options?: QueryOptions,
) {
  return useApiQuery(
    ['settings', 'contacts', businessId],
    () => getContacts(businessId ?? ''),
    {
      ...options,
      enabled: Boolean(businessId) && (options?.enabled ?? true),
    },
  );
}

const TELEGRAM_URL_RE = /^https:\/\/t\.me\/[a-zA-Z0-9_]{3,}$/;

/** Формат ссылки Telegram (F-15-108) — «https://t.me/username»; неверный формат не сохраняется */
export function isValidTelegramUrl(value: string): boolean {
  return TELEGRAM_URL_RE.test(value.trim());
}

export async function saveContacts(input: {
  businessId: Id;
  addressRu: string;
  yandexMapsUrl?: string;
  hoursText?: string;
  phones: string[];
  socials: SocialLinks;
  /** Кто правит (F-15-180) */
  staffId?: Id;
}): Promise<ContactsData> {
  if (isApiMode()) return S.saveContacts<ContactsData>(input.businessId, { addressRu: input.addressRu, yandexMapsUrl: input.yandexMapsUrl, hoursText: input.hoursText, phones: input.phones, socials: { ...input.socials } });
  if (
    input.socials.telegramUrl &&
    !isValidTelegramUrl(input.socials.telegramUrl)
  ) {
    throw new ApiError(
      'bad_telegram_url',
      'Ссылка Telegram должна быть в формате https://t.me/username',
    );
  }
  const loc = await request(() => primaryLocation(input.businessId));
  const biz = await request(() => business(input.businessId));
  const [firstPhone, ...restPhones] = input.phones.filter(Boolean);
  if ((loc?.address?.ru ?? '') !== input.addressRu)
    logSettingsChange(
      input.businessId,
      'contacts',
      'address',
      loc?.address?.ru ?? '',
      input.addressRu,
      input.staffId,
    );
  if ((biz.phone ?? '') !== (firstPhone ?? ''))
    logSettingsChange(
      input.businessId,
      'contacts',
      'phone',
      biz.phone ?? '',
      firstPhone ?? '',
      input.staffId,
    );
  if (loc) {
    await coreUpdate('locations', loc.id, {
      address: { ...loc.address, ru: input.addressRu },
      yandexMapsUrl: input.yandexMapsUrl,
      hoursText: input.hoursText,
      phone: firstPhone,
      extraPhones: restPhones,
    });
  }
  await coreUpdate('businesses', input.businessId, {
    phone: firstPhone ?? biz.phone,
    socials: input.socials,
  });
  return getContacts(input.businessId);
}

/** «📍 Я сейчас на месте работы» (F-00-075/F-15-104) — демо-точка в центре Еревана */
export async function markHereNow(locationId: Id): Promise<void> {
  await updateLocationPlace(locationId, {
    coords: {
      lat: 40.1792 + (Math.random() - 0.5) * 0.01,
      lng: 44.4991 + (Math.random() - 0.5) * 0.01,
    },
  });
}

// ─────────────────────────── Галерея (F-15-111) ───────────────────────────

export const GALLERY_MAX_PHOTOS = 6;

export function getGalleryPhotos(businessId: Id): Promise<string[]> {
  if (isApiMode()) return S.getGallery(businessId);
  return request(() => business(businessId).photos);
}

export function useGalleryPhotos(
  businessId: Id | undefined,
  options?: QueryOptions,
) {
  return useApiQuery(
    ['settings', 'gallery', businessId],
    () => getGalleryPhotos(businessId ?? ''),
    {
      ...options,
      enabled: Boolean(businessId) && (options?.enabled ?? true),
    },
  );
}

/** Новые фото (не бывшие в старом списке) уходят на проверку (F-00-168); старые — без изменений */
export async function saveGalleryPhotos(input: {
  businessId: Id;
  photos: string[];
}): Promise<string[]> {
  if (isApiMode()) return S.saveGallery(input.businessId, input.photos);
  const { businessId, photos } = input;
  const beforeBiz = await request(() => business(businessId));
  const before = new Set(beforeBiz.photos);
  await coreUpdate('businesses', businessId, { photos });
  const added = photos.filter((p) => !before.has(p));
  for (const url of added) {
    await submitMediaForReview(businessId, url, {
      kind: 'salonPhoto',
      imageUrl: url,
    });
  }
  return photos;
}

// ─────────────────────────── Реквизиты (F-15-112, F-15-085, F-15-086) ───────────────────────────

export function useLegalInfo(
  businessId: Id | undefined,
  options?: QueryOptions,
) {
  return useApiQuery(
    ['settings', 'legalInfo', businessId],
    () => getLegalInfo(businessId ?? ''),
    {
      ...options,
      enabled: Boolean(businessId) && (options?.enabled ?? true),
    },
  );
}

const AM_TAX_ID_RE = /^\d{8}$/;

/** ՀՎՀՀ — 8 цифр (F-15-085, армянский аналог проверки НДС-номера) */
export function isValidTaxId(value: string): boolean {
  return AM_TAX_ID_RE.test(value.trim());
}

const BRAZIL_CNPJ_RE = /^\d{14}$/;
const BRAZIL_CPF_RE = /^\d{11}$/;

/** CNPJ — 14 цифр, формат-проверка при вводе (F-07-179, демо · только Бразилия) */
export function isValidCnpj(value: string): boolean {
  return BRAZIL_CNPJ_RE.test(value.trim());
}

/** CPF — 11 цифр, формат-проверка при вводе (F-07-179, демо · только Бразилия) */
export function isValidCpf(value: string): boolean {
  return BRAZIL_CPF_RE.test(value.trim());
}

export function saveLegalInfoFull(
  input: { businessId: Id; staffId?: Id } & LegalInfo,
): Promise<LegalInfo> {
  if (isApiMode()) {
    const { businessId, staffId: _staffId, ...legal } = input;
    return S.saveLegalInfo(businessId, legal);
  }
  return request(() => {
    if (input.taxId && !isValidTaxId(input.taxId))
      throw new ApiError('bad_tax_id', 'ՀՎՀՀ — 8 цифр');
    if (input.payerTax) {
      const { type, cnpj, cpf } = input.payerTax;
      if (type === 'business' && cnpj && !isValidCnpj(cnpj))
        throw new ApiError('bad_cnpj', 'CNPJ — 14 цифр');
      if (type === 'individual' && cpf && !isValidCpf(cpf))
        throw new ApiError('bad_cpf', 'CPF — 11 цифр');
    }
    const before = readArea('settings').legalInfo[input.businessId] ?? {};
    mutateArea('settings', (s) => {
      const { businessId, staffId: _staffId, ...rest } = input;
      s.legalInfo[businessId] = rest;
    });
    if ((before.companyName ?? '') !== (input.companyName ?? ''))
      logSettingsChange(
        input.businessId,
        'legal',
        'companyName',
        before.companyName ?? '',
        input.companyName ?? '',
        input.staffId,
      );
    if ((before.taxId ?? '') !== (input.taxId ?? ''))
      logSettingsChange(
        input.businessId,
        'legal',
        'taxId',
        before.taxId ?? '',
        input.taxId ?? '',
        input.staffId,
      );
    return readArea('settings').legalInfo[input.businessId];
  });
}

// ─────────────────────────── Системные настройки (F-15-113…117, F-15-030, F-15-136) ───────────────────────────

/**
 * Н5 (настройки-ревью 27.09.2026): формат времени — ОДИН источник. Его читает журнал (JournalSettings.hourFormat,
 * useJournalHourFormat), поэтому «Системные» читают и пишут именно его, а своё поле dateTimeFormat держат копией.
 */
async function withJournalHourFormat(settings: SystemSettings): Promise<SystemSettings> {
  try {
    const journal = await getJournalSettings();
    return { ...settings, dateTimeFormat: journal.hourFormat };
  } catch {
    return settings;
  }
}

export function getSystemSettings(businessId: Id): Promise<SystemSettings> {
  if (isApiMode()) return S.getSystemSettings(businessId).then(withJournalHourFormat);
  return request(
    () =>
      readArea('settings').systemSettings[businessId] ?? {
        businessId,
        city: 'Yerevan',
        dateTimeFormat: '24' as const,
        messageLanguage: 'ru' as const,
      },
  ).then(withJournalHourFormat);
}

/**
 * Язык сообщений клиентам (F-15-135/136), выбранный в «Системных». Для разделов, которые шлют клиенту
 * сообщения (уведомления, напоминания): `getMessageLanguage(businessId)` или хук `useMessageLanguage`.
 */
export function getMessageLanguage(businessId: Id): Promise<SettingsLang> {
  return getSystemSettings(businessId).then((s) => s.messageLanguage);
}

export function useMessageLanguage(businessId: Id | undefined, options?: QueryOptions): SettingsLang {
  return useSystemSettings(businessId, options).data?.messageLanguage ?? 'ru';
}

export function useSystemSettings(
  businessId: Id | undefined,
  options?: QueryOptions,
) {
  return useApiQuery(
    ['settings', 'systemSettings', businessId],
    () => getSystemSettings(businessId ?? ''),
    {
      ...options,
      enabled: Boolean(businessId) && (options?.enabled ?? true),
    },
  );
}

/** «Основные» (F-15-113): внутреннее имя пишет ядро (Business.name, F-15-114), остальное — свой срез */
export async function saveSystemSettings(
  input: { businessId: Id; internalName?: string; staffId?: Id } & Omit<
    SystemSettings,
    'businessId'
  >,
): Promise<SystemSettings> {
  if (isApiMode()) {
    const { businessId, staffId: _staffId, ...rest } = input;
    const before = await getSystemSettings(businessId);
    const saved = await S.saveSystemSettings(businessId, rest);
    if (before.dateTimeFormat !== input.dateTimeFormat) await setJournalSettings({ hourFormat: input.dateTimeFormat });
    return { ...saved, dateTimeFormat: input.dateTimeFormat };
  }
  const before = await getSystemSettings(input.businessId);
  if (before.dateTimeFormat !== input.dateTimeFormat) await setJournalSettings({ hourFormat: input.dateTimeFormat });
  if (input.internalName !== undefined)
    await coreUpdate('businesses', input.businessId, {
      name: input.internalName,
    });
  const settings: SystemSettings = {
    businessId: input.businessId,
    city: input.city,
    dateTimeFormat: input.dateTimeFormat,
    messageLanguage: input.messageLanguage,
    sphereSubtype: input.sphereSubtype,
  };
  await request(() =>
    mutateArea('settings', (s) => {
      s.systemSettings[input.businessId] = settings;
    }),
  );
  if (before.dateTimeFormat !== settings.dateTimeFormat)
    logSettingsChange(
      input.businessId,
      'system',
      'dateTimeFormat',
      before.dateTimeFormat,
      settings.dateTimeFormat,
      input.staffId,
    );
  if (before.messageLanguage !== settings.messageLanguage)
    logSettingsChange(
      input.businessId,
      'system',
      'messageLanguage',
      before.messageLanguage,
      settings.messageLanguage,
      input.staffId,
    );
  if (before.city !== settings.city)
    logSettingsChange(
      input.businessId,
      'system',
      'city',
      before.city,
      settings.city,
      input.staffId,
    );
  return settings;
}

// ─────────────────────────── «Для разработчиков» — вебхуки (F-15-119) ───────────────────────────
// ❓ не решено, будем ли мы вообще давать вебхуки (00-decisions) — экран демо-интерфейс 1:1 с Altegio, ничего
// никуда реально не шлёт; сохраняется только форма (адрес, сущности, вкл/выкл).

export const WEBHOOK_ENTITIES: WebhookEntity[] = [
  'location',
  'staff',
  'services',
  'serviceCategories',
  'clients',
  'bookings',
  'loyaltyEvents',
  'goodsSales',
  'goods',
];

export function getWebhookSettings(businessId: Id): Promise<WebhookSettings> {
  if (isApiMode())
    return S.getWebhooks(businessId).then((w) => ({ businessId, enabled: w.enabled, url: w.url, entities: w.entities as WebhookEntity[] }));
  return request(
    () =>
      readArea('settings').webhookSettings[businessId] ?? {
        businessId,
        enabled: false,
        entities: [],
      },
  );
}

export function useWebhookSettings(
  businessId: Id | undefined,
  options?: QueryOptions,
) {
  return useApiQuery(
    ['settings', 'webhookSettings', businessId],
    () => getWebhookSettings(businessId ?? ''),
    { ...options, enabled: Boolean(businessId) && (options?.enabled ?? true) },
  );
}

export async function saveWebhookSettings(input: {
  businessId: Id;
  staffId?: Id;
  enabled: boolean;
  url?: string;
  entities: WebhookEntity[];
}): Promise<WebhookSettings> {
  if (isApiMode())
    return S.saveWebhooks(input.businessId, { enabled: input.enabled, url: input.url, entities: input.entities }).then((w) => ({
      businessId: input.businessId,
      enabled: w.enabled,
      url: w.url,
      entities: w.entities as WebhookEntity[],
    }));
  const before = await request(() => getWebhookSettings(input.businessId));
  const settings: WebhookSettings = {
    businessId: input.businessId,
    enabled: input.enabled,
    url: input.url,
    entities: input.entities,
  };
  await request(() =>
    mutateArea('settings', (s) => {
      s.webhookSettings[input.businessId] = settings;
    }),
  );
  if (before.enabled !== settings.enabled)
    logSettingsChange(
      input.businessId,
      'system',
      'webhookEnabled',
      String(before.enabled),
      String(settings.enabled),
      input.staffId,
    );
  return settings;
}

// ─────────────────────────── Категории записи (F-15-121…124) ───────────────────────────
// Три справочника живут на одной странице (F-15-121): «Записи» — наш (ниже), «Клиенты»/«События» ведут в
// справочники clients/resources (просьба — qa/requests/settings.md). Сигнатура listRecordCategories стабильна —
// её попросят journal/online.

export function listRecordCategories(
  businessId: Id,
): Promise<RecordCategory[]> {
  if (isApiMode()) return S.listRecordCategories(businessId);
  return request(() =>
    readArea('settings')
      .recordCategories.filter((c) => c.businessId === businessId)
      .sort((a, b) => Number(b.system) - Number(a.system)),
  );
}

export function useRecordCategories(
  businessId: Id | undefined,
  options?: QueryOptions,
) {
  return useApiQuery(
    ['settings', 'recordCategories', businessId],
    () => listRecordCategories(businessId ?? ''),
    {
      ...options,
      enabled: Boolean(businessId) && (options?.enabled ?? true),
    },
  );
}

/** Своя категория (F-15-123/124) — без названия не сохранить; системные (system: true) сюда не попадают */
export function saveRecordCategory(input: {
  id?: Id;
  businessId: Id;
  name: string;
  colorIndex: number;
  icon?: string;
  /** Кто правит (F-15-180 F-15-132) */
  staffId?: Id;
}): Promise<RecordCategory> {
  if (isApiMode()) return S.saveRecordCategory(input.businessId, input.id, { name: input.name, colorIndex: input.colorIndex, icon: input.icon });
  return request(() => {
    if (!input.name.trim())
      throw new ApiError('name_required', 'Укажите название категории');
    let result!: RecordCategory;
    const before = input.id
      ? readArea('settings').recordCategories.find((c) => c.id === input.id)
      : undefined;
    mutateArea('settings', (s) => {
      if (input.id) {
        const idx = s.recordCategories.findIndex(
          (c) => c.id === input.id && !c.system,
        );
        if (idx < 0) throw new ApiError('not_found', 'Категория не найдена');
        s.recordCategories[idx] = {
          ...s.recordCategories[idx],
          name: input.name.trim(),
          colorIndex: input.colorIndex,
          icon: input.icon,
        };
        result = s.recordCategories[idx];
      } else {
        result = {
          id: newId('rcat'),
          businessId: input.businessId,
          name: input.name.trim(),
          colorIndex: input.colorIndex,
          icon: input.icon,
        };
        s.recordCategories.push(result);
      }
    });
    logSettingsChange(
      input.businessId,
      'categories',
      before ? 'edit' : 'add',
      before?.name ?? '',
      result.name,
      input.staffId,
    );
    return result;
  });
}

/** Системные категории нельзя удалить (F-15-122, F-15-132) */
export function deleteRecordCategory(
  id: Id,
  staffId?: Id,
): Promise<void> {
  if (isApiMode()) return S.deleteRecordCategory(apiIdentity()?.businessId ?? '', id);
  return request(() => {
    const item = readArea('settings').recordCategories.find(
      (c) => c.id === id,
    );
    mutateArea('settings', (s) => {
      const found = s.recordCategories.find((c) => c.id === id);
      if (!found) throw new ApiError('not_found');
      if (found.system)
        throw new ApiError('forbidden', 'Системную категорию нельзя удалить');
      s.recordCategories = s.recordCategories.filter((c) => c.id !== id);
    });
    if (item)
      logSettingsChange(
        item.businessId,
        'categories',
        'delete',
        item.name,
        '—',
        staffId,
      );
  });
}

// ─────────────────────────── Личный кабинет пользователя (F-15-147…158, b05) ───────────────────────────
// Аккаунт человека: профиль, вход (телефон/email/пароль), уведомления, приватность, стартовая страница,
// удаление. Профиль/логины — поля ядра Staff (coreUpdate), личные настройки — свой срез (personalAccounts).

const DEMO_CODE = '0000';

function defaultPersonalAccount(staffId: Id): PersonalAccount {
  return {
    staffId,
    notificationPrefs: { news: true, marketing: true, system: true },
    emailVerified: true,
    dataExportRequests: [],
    loginHistory: [],
    twoFactorEnabled: false,
  };
}

/** Время сервера (ISO UTC) → местное 'YYYY-MM-DDTHH:mm' экранов */
function localFromServer(iso: string | null): ISODateTime | undefined {
  return iso ? toISODateTime(dayjs(iso).toDate()) : undefined;
}

export async function getPersonalAccount(staffId: Id): Promise<PersonalAccount> {
  const base = await request(() => readArea('settings').personalAccounts[staffId] ?? defaultPersonalAccount(staffId));
  if (!isApiMode()) return base;
  // Режим api: вход, сеансы, 2FA, удаление, журнал входов (этап 2); уведомления, стартовая страница (этап 18);
  // выгрузки и блокировка данных (F-15-154/155) — этап 20
  const bizId = apiIdentity()?.businessId;
  const [account, events, prefs, exports, emailStatus] = await Promise.all([
    getAccount(),
    listLoginEvents(20),
    bizId ? S.getPrefs(bizId) : Promise.resolve(undefined),
    listMyDataExports(),
    bizId ? S.getEmailStatus(bizId) : Promise.resolve(undefined),
  ]);
  return {
    ...base,
    // Этап 18: уведомления и стартовая страница — с сервера (личные настройки сотрудника)
    ...(prefs ? { notificationPrefs: prefs.notificationPrefs, startPage: prefs.startPage, startLocationId: prefs.startLocationId } : {}),
    // Этап 21 «Сдача»: подтверждение почты (F-15-150) — с сервера (staff.emailVerified/emailConfirmSentAt)
    ...(emailStatus ? { emailVerified: emailStatus.emailVerified, emailConfirmSentAt: localFromServer(emailStatus.emailConfirmSentAt ?? null) } : {}),
    twoFactorEnabled: account.twoFactorEnabled,
    sessionsTerminatedAt: localFromServer(account.sessionsRevokedAt),
    deletionRequestedAt: localFromServer(account.deleteRequestedAt),
    dataBlockRequestedAt: localFromServer(account.dataBlockRequestedAt),
    dataExportRequests: exports.map((e) => ({ id: e.id, requestedAt: localFromServer(e.requestedAt) ?? '', ready: e.ready })),
    loginHistory: events
      .filter((e) => e.result === 'ok')
      .map((e) => ({ id: e.id, at: localFromServer(e.at) ?? '', device: e.device, location: e.ip, current: e.current })),
  };
}

function ensurePersonalAccount(s: { personalAccounts: Record<Id, PersonalAccount> }, staffId: Id): PersonalAccount {
  if (!s.personalAccounts[staffId]) s.personalAccounts[staffId] = defaultPersonalAccount(staffId);
  return s.personalAccounts[staffId];
}

/** Включить/выключить двухэтапную проверку входа email/пуш-кодом (F-15-159) — демо, ничего реально не шлёт */
export async function setTwoFactorEnabled(staffId: Id, enabled: boolean): Promise<void> {
  if (isApiMode()) {
    await setAccountTwoFactor(enabled);
    return;
  }
  return request(() => {
    mutateArea('settings', (s) => {
      ensurePersonalAccount(s, staffId).twoFactorEnabled = enabled;
    });
  });
}

/** «Профиль»: фото, имя (F-15-148) — телефон и email меняются только своими шагами с подтверждением */
export async function updateProfile(input: { staffId: Id; name: string; avatarUrl?: string }): Promise<void> {
  if (isApiMode()) {
    const name = input.name.trim();
    if (!name) throw new ApiError('name_required', 'Укажите имя');
    const bizId = apiIdentity()?.businessId ?? '';
    // Свой профиль сотрудника (этап 3: PATCH staff — сам мастер правит часть полей), затем ядро браузера перечитывается
    await http('PATCH', `/v1/biz/${bizId}/staff/${input.staffId}`, { name, avatarUrl: input.avatarUrl ?? null });
    await syncCore(bizId);
    return;
  }
  return request(async () => {
    const name = input.name.trim();
    if (!name) throw new ApiError('name_required', 'Укажите имя');
    await coreUpdate('staff', input.staffId, { name, avatarUrl: input.avatarUrl });
  });
}

/** Отправить код на НОВЫЙ номер (F-15-149) — в демо код всегда «0000» */
export async function sendPhoneChangeCode(phone: string, channel?: 'telegram' | 'whatsapp' | 'sms'): Promise<{ demoCode: string }> {
  if (isApiMode()) {
    await sendPhoneChangeCodeApi(phone, channel);
    return { demoCode: '' };
  }
  return request(() => ({ demoCode: DEMO_CODE }));
}

/** Подтвердить код и сменить номер входа (F-15-149) — номер, уже занятый другим сотрудником, отклоняется */
export async function confirmPhoneChange(input: { staffId: Id; phone: string; code: string }): Promise<void> {
  if (isApiMode()) {
    // Номер входа — у человека (users.phone); номер сотрудника в кабинете переводит этап 3
    await confirmPhoneChangeApi({ phone: input.phone, code: input.code });
    return;
  }
  return request(async () => {
    if (input.code !== DEMO_CODE) throw new ApiError('bad_code', 'Код не подошёл');
    const core = readCore();
    const taken = core.staff.some((s) => s.id !== input.staffId && s.phone === input.phone);
    if (taken) throw new ApiError('phone_taken', 'Этот номер уже занят другим аккаунтом');
    await coreUpdate('staff', input.staffId, { phone: input.phone });
  });
}

/** «Отправить письмо для подтверждения» / смена email (F-15-150) — ссылку в демо заменяет отдельная кнопка */
export function sendEmailConfirmation(staffId: Id, email?: string): Promise<void> {
  if (isApiMode()) {
    const bizId = apiIdentity()?.businessId ?? '';
    return S.sendEmailConfirmationApi(bizId, email).then(async () => {
      // Email лежит в ядре (Staff.email, как и телефон) — перечитываем зеркало, иначе coreGet('staff', …) в
      // EmailTab ещё показывает старую почту после смены (тот же приём, что у updateProfile выше)
      if (email) await syncCore(bizId);
    });
  }
  return request(async () => {
    if (email) await coreUpdate('staff', staffId, { email });
    mutateArea('settings', (s) => {
      const acc = ensurePersonalAccount(s, staffId);
      acc.emailVerified = false;
      acc.emailConfirmSentAt = toISODateTime(new Date());
    });
  });
}

/** Демо-имитация перехода по ссылке из письма — email становится подтверждённым (F-15-150) */
export function confirmEmailLinkDemo(staffId: Id): Promise<void> {
  if (isApiMode()) {
    const bizId = apiIdentity()?.businessId ?? '';
    return S.confirmEmailDemoApi(bizId).then(() => undefined);
  }
  return request(() => {
    mutateArea('settings', (s) => {
      const acc = ensurePersonalAccount(s, staffId);
      acc.emailVerified = true;
      acc.emailConfirmSentAt = undefined;
    });
  });
}

/** Смена пароля (F-15-151) — только для роли admin (F-00-034); мастер/владелец входят по коду */
export function changePassword(input: {
  staffId: Id;
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  if (isApiMode()) return changeAdminPassword('', input.newPassword, input.currentPassword);
  return request(() => {
    if (!input.currentPassword) throw new ApiError('bad_current', 'Введите текущий пароль');
    if (input.newPassword.length < 6) throw new ApiError('weak_password', 'Пароль слишком короткий');
  });
}

/** «Завершить все сеансы» (F-15-152) — прочие устройства потребуют повторный вход */
export async function terminateOtherSessions(staffId: Id): Promise<void> {
  if (isApiMode()) {
    await logoutAll(true);
    return;
  }
  return request(() => {
    mutateArea('settings', (s) => {
      ensurePersonalAccount(s, staffId).sessionsTerminatedAt = toISODateTime(new Date());
    });
  });
}

/** «Уведомления»: письма и пуши сервиса (F-15-153) — служебные сообщения этими галочками не отключаются */
export function saveNotificationPrefs(staffId: Id, prefs: NotificationPrefs): Promise<void> {
  if (isApiMode()) return S.savePrefs(apiIdentity()?.businessId ?? '', { notificationPrefs: prefs }).then(() => undefined);
  return request(() => {
    mutateArea('settings', (s) => {
      ensurePersonalAccount(s, staffId).notificationPrefs = prefs;
    });
  });
}

/** «Выгрузить мои данные» (F-15-154) — не чаще раза в сутки, готовность в демо (и на сервере, этап 20) мгновенная */
export function requestDataExport(staffId: Id): Promise<DataExportRequest> {
  if (isApiMode()) return requestMyDataExport().then((r) => ({ id: r.id, requestedAt: toISODateTime(dayjs(r.requestedAt).toDate()), ready: r.ready }));
  return request(() => {
    let created: DataExportRequest | undefined;
    mutateArea('settings', (s) => {
      const acc = ensurePersonalAccount(s, staffId);
      const last = acc.dataExportRequests.at(-1);
      if (last && Date.now() - new Date(last.requestedAt).getTime() < 24 * 60 * 60 * 1000)
        throw new ApiError('too_soon', 'Уже отправляли сегодня — не чаще раза в сутки');
      created = { id: newId('export'), requestedAt: toISODateTime(new Date()), ready: true };
      acc.dataExportRequests.push(created);
    });
    if (!created) throw new ApiError('unknown');
    return created;
  });
}

/**
 * «Скачать мои данные» (F-15-154): JSON-файл своих данных сразу, без писем. Живой сайт — GET /v1/me/data-export
 * (профиль, записи как клиента, входы, свои карточки сотрудника; сервер записывает выгрузку в историю), демо — то же
 * из данных браузера. Базу клиентов салона выгружают отдельно (Клиенты → Выгрузить).
 */
export async function downloadMyData(staffId: Id): Promise<{ filename: string; content: string }> {
  const filename = myDataFilename();
  if (isApiMode()) return { filename, content: JSON.stringify(await fetchMyDataExport(), null, 2) };
  return request(() => {
    const core = readCore();
    const staff = core.staff.find((x) => x.id === staffId);
    if (!staff) throw new ApiError('not_found');
    let account: PersonalAccount | undefined;
    mutateArea('settings', (s) => {
      const acc = ensurePersonalAccount(s, staffId);
      acc.dataExportRequests.push({ id: newId('export'), requestedAt: toISODateTime(new Date()), ready: true });
      account = structuredClone(acc);
    });
    const business = core.businesses.find((b) => b.id === staff.businessId);
    const data = {
      exportedAt: new Date().toISOString(),
      staffProfile: staff,
      business: business ? { id: business.id, name: business.name } : null,
      account,
    };
    return { filename, content: JSON.stringify(data, null, 2) };
  });
}

/** «Запрос на блокировку данных» (F-15-155) — это заявка, а не мгновенное действие */
export async function requestDataBlock(staffId: Id): Promise<void> {
  if (isApiMode()) {
    await requestMyDataBlock();
    return;
  }
  return request(() => {
    mutateArea('settings', (s) => {
      ensurePersonalAccount(s, staffId).dataBlockRequestedAt = toISODateTime(new Date());
    });
  });
}

/** «Управление аккаунтом»: стартовая локация и страница (F-15-157) */
export function saveAccountStart(input: { staffId: Id; locationId?: Id; startPage?: StartPage }): Promise<void> {
  if (isApiMode()) return S.savePrefs(apiIdentity()?.businessId ?? '', { startPage: input.startPage ?? null, startLocationId: input.locationId ?? null }).then(() => undefined);
  return request(() => {
    mutateArea('settings', (s) => {
      const acc = ensurePersonalAccount(s, input.staffId);
      acc.startLocationId = input.locationId;
      acc.startPage = input.startPage;
    });
  });
}

/** Удаление аккаунта — наступает через 25 дней, можно отменить (F-15-158) */
export async function requestAccountDeletion(staffId: Id): Promise<void> {
  if (isApiMode()) {
    await requestMyAccountDeletion();
    return;
  }
  return request(() => {
    mutateArea('settings', (s) => {
      ensurePersonalAccount(s, staffId).deletionRequestedAt = toISODateTime(new Date());
    });
  });
}

export async function cancelAccountDeletion(staffId: Id): Promise<void> {
  if (isApiMode()) {
    await cancelMyAccountDeletion();
    return;
  }
  return request(() => {
    mutateArea('settings', (s) => {
      ensurePersonalAccount(s, staffId).deletionRequestedAt = undefined;
    });
  });
}

/** Сколько дней осталось до наступления удаления — для полосы предупреждения в шапке личного кабинета */
export const ACCOUNT_DELETION_DAYS = 25;

export type {
  BusinessKind,
  InvoicePurpose,
  OnboardingInvite,
  OnboardingStepId,
  SphereRequest,
};
export type {
  HelpRequestTopic,
  BillingPaymentMethod,
  Invoice,
  InvoicePayer,
  SavedPaymentMethod,
  PriceQuote,
} from '@/domain/settings';

// ─────────────────────────── Новое место / филиал (F-15-104) ───────────────────────────

export interface AddBusinessLocationInput {
  businessId: Id;
  name: string;
  address: string;
  district: Location['district'];
}

/** Добавить место бизнеса. Живой сайт — на сервере (этап 3), бизнес и его филиалы перечитываются в ядро браузера. */
export async function addBusinessLocation(input: AddBusinessLocationInput): Promise<Location> {
  if (isApiMode()) {
    const location = await http<Location>('POST', `/v1/biz/${input.businessId}/locations`, {
      name: { ru: input.name.trim() },
      address: { ru: input.address.trim() },
      district: input.district,
    });
    await syncCore(input.businessId);
    return location;
  }
  const business = await coreGet('businesses', input.businessId);
  const location = await coreCreate('locations', {
    businessId: input.businessId,
    name: { ru: input.name.trim() },
    address: { ru: input.address.trim() },
    district: input.district,
  });
  await coreUpdate('businesses', input.businessId, { locationIds: [...business.locationIds, location.id] });
  return location;
}
